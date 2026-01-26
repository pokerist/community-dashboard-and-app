import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { BookingStatus } from '@prisma/client';
import { BookingApprovedEvent } from '../../events/contracts/booking-approved.event';
import { BookingCancelledEvent } from '../../events/contracts/booking-cancelled.event';
import { paginate } from '../../common/utils/pagination.util';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';

interface EffectiveSlotConfig {
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  slotCapacity?: number;
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async getFacility(dto: CreateBookingDto) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: dto.facilityId },
      include: {
        slotConfig: true,
        slotExceptions: true,
      },
    });

    if (!facility) throw new NotFoundException('Facility not found');
    if (!facility.isActive) throw new BadRequestException('Facility inactive');

    return facility;
  }

  private resolveSlotConfig(
    facility: any,
    dateStr: string,
  ): EffectiveSlotConfig | null {
    const date = new Date(dateStr);
    const dayIndex = date.getUTCDay();

    const exception = facility.slotExceptions.find(
      (e: any) => e.date.toISOString().split('T')[0] === dateStr.split('T')[0],
    );

    if (exception?.isClosed) return null;

    if (exception) {
      return {
        startTime: exception.startTime ?? '00:00',
        endTime: exception.endTime ?? '23:59',
        slotDurationMinutes: exception.slotDurationMinutes ?? undefined,
        slotCapacity: exception.slotCapacity ?? facility.capacity ?? undefined,
      };
    } else {
      const config = facility.slotConfig.find(
        (c: any) => c.dayOfWeek === dayIndex,
      );
      if (!config) return null;
      return {
        startTime: config.startTime,
        endTime: config.endTime,
        slotDurationMinutes: config.slotDurationMinutes ?? undefined,
        slotCapacity: config.slotCapacity ?? facility.capacity ?? undefined,
      };
    }
  }

  private validateTime(
    dto: CreateBookingDto,
    config: EffectiveSlotConfig,
  ): boolean {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const start = toMinutes(dto.startTime);
    const end = toMinutes(dto.endTime);
    const open = toMinutes(config.startTime);
    const close = toMinutes(config.endTime);

    if (start < open || end > close) return false;
    if (end <= start) return false;

    if (config.slotDurationMinutes) {
      const diff = end - start;
      if (diff !== config.slotDurationMinutes) return false;
    }

    return true;
  }

  private async enforceLimits(dto: CreateBookingDto, facility: any) {
    const date = new Date(dto.date);

    // Check maxReservationsPerDay
    if (facility.maxReservationsPerDay) {
      const dailyCount = await this.prisma.booking.count({
        where: {
          userId: dto.userId,
          facilityId: dto.facilityId,
          date,
        },
      });

      if (dailyCount >= facility.maxReservationsPerDay)
        throw new BadRequestException(
          `Max reservations per day exceeded (${facility.maxReservationsPerDay})`,
        );
    }

    // Cooldown check
    if (facility.cooldownMinutes) {
      const last = await this.prisma.booking.findFirst({
        where: {
          userId: dto.userId,
          facilityId: dto.facilityId,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (last) {
        const diff =
          (Date.now() - new Date(last.createdAt).getTime()) / 1000 / 60;

        if (diff < facility.cooldownMinutes)
          throw new BadRequestException(
            `Cooldown active. Wait ${
              facility.cooldownMinutes - Math.floor(diff)
            } minutes`,
          );
      }
    }
  }

  private async checkSlotCapacity(
    dto: CreateBookingDto,
    facility: any,
    config: EffectiveSlotConfig,
  ) {
    if (config.slotCapacity) {
      const slotCount = await this.prisma.booking.count({
        where: {
          facilityId: dto.facilityId,
          date: new Date(dto.date),
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: { in: [BookingStatus.PENDING, BookingStatus.APPROVED] },
        },
      });

      if (slotCount >= config.slotCapacity) {
        throw new BadRequestException(
          `Slot capacity exceeded (${config.slotCapacity})`,
        );
      }
    }
  }

  private async saveBooking(dto: CreateBookingDto) {
    const date = new Date(dto.date);

    return this.prisma.booking.create({
      data: {
        userId: dto.userId,
        facilityId: dto.facilityId,
        residentId: dto.residentId,
        unitId: dto.unitId,
        date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: BookingStatus.PENDING,
      },
    });
  }

  async create(dto: CreateBookingDto) {
    if (!dto.unitId) {
      throw new BadRequestException('Unit ID is required for booking');
    }

    // Access Control: Check if user has active access to the unit
    const access = await getActiveUnitAccess(
      this.prisma,
      dto.userId,
      dto.unitId,
    );

    // Feature Gating: Bookings only available after delivery
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { status: true },
    });

    if (unit?.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Facility bookings are only available after delivery',
      );
    }

    // Check if user has permission to book facilities
    if (!access.canBookFacilities) {
      throw new BadRequestException(
        'User does not have permission to book facilities',
      );
    }

    const facility = await this.getFacility(dto);
    const config = this.resolveSlotConfig(facility, dto.date);

    if (!config)
      throw new BadRequestException(
        'Facility closed or no slots configured for this day',
      );

    if (!this.validateTime(dto, config)) {
      throw new BadRequestException('Requested time does not match slot rules');
    }

    return this.prisma.$transaction(async (prisma) => {
      await this.enforceLimits(dto, facility);
      await this.checkSlotCapacity(dto, facility, config);
      return this.saveBooking(dto);
    });
  }

  async findAll(query: BookingsQueryDto) {
    const {
      status,
      facilityId,
      userId,
      unitId,
      dateFrom,
      dateTo,
      ...baseQuery
    } = query;

    const filters: Record<string, any> = {
      status,
      facilityId,
      userId,
      unitId,
    };

    if (dateFrom || dateTo) {
      filters.date = {};
      if (dateFrom) filters.date.gte = new Date(dateFrom);
      if (dateTo) filters.date.lte = new Date(dateTo);
    }

    return paginate(this.prisma.booking, baseQuery, {
      searchFields: ['facility.name', 'user.nameEN', 'unit.unitNumber'],
      additionalFilters: filters,
      include: {
        facility: { select: { name: true } },
        user: { select: { nameEN: true, email: true } },
        resident: { select: { nationalId: true } },
        unit: { select: { unitNumber: true } },
      },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { facility: true, user: true, resident: true, unit: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { facility: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: { status: dto.status },
    });

    // Emit events based on status change
    if (dto.status === BookingStatus.APPROVED) {
      this.eventEmitter.emit(
        'booking.approved',
        new BookingApprovedEvent(
          booking.id,
          booking.userId,
          booking.facility.name,
          booking.date,
          booking.startTime,
          booking.endTime,
        ),
      );
    } else if (
      dto.status === BookingStatus.CANCELLED ||
      dto.status === BookingStatus.REJECTED
    ) {
      this.eventEmitter.emit(
        'booking.cancelled',
        new BookingCancelledEvent(
          booking.id,
          booking.userId,
          booking.facility.name,
          booking.date,
          booking.startTime,
          booking.endTime,
        ),
      );
    }

    return updatedBooking;
  }

  async findByFacility(facilityId: string) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
    });

    if (!facility) throw new NotFoundException('Facility not found');

    return this.prisma.booking.findMany({
      where: { facilityId },
      include: { facility: true, user: true, resident: true, unit: true },
      orderBy: { date: 'asc' },
    });
  }

  async findByUser(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      include: { facility: true, resident: true, unit: true },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });
  }

  async cancelOwn(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { facility: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.userId !== userId) {
      throw new BadRequestException('You cannot cancel someone else’s booking');
    }

    if (booking.cancelledAt) {
      throw new BadRequestException('Booking already cancelled');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    // Emit booking cancelled event
    this.eventEmitter.emit(
      'booking.cancelled',
      new BookingCancelledEvent(
        booking.id,
        booking.userId,
        booking.facility.name,
        booking.date,
        booking.startTime,
        booking.endTime,
      ),
    );

    return updatedBooking;
  }

  async remove(id: string) {
    return this.prisma.booking.delete({
      where: { id },
    });
  }
}
