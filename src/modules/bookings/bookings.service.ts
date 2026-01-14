import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-status.dto';
import { BookingStatus } from '@prisma/client';
import { BookingApprovedEvent } from '../../events/contracts/booking-approved.event';
import { BookingCancelledEvent } from '../../events/contracts/booking-cancelled.event';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateBookingDto) {
    const facility = await this.prisma.facility.findUnique({
      where: { id: dto.facilityId },
      include: {
        slotConfig: true,
        slotExceptions: true,
        bookings: true,
      },
    });

    if (!facility) throw new NotFoundException('Facility not found');
    if (!facility.isActive) throw new BadRequestException('Facility inactive');

    const date = new Date(dto.date);
    const dayIndex = date.getUTCDay();

    // 1 — Handle Exceptions
    const exception = facility.slotExceptions.find(
      (e) => e.date.toISOString().split('T')[0] === dto.date.split('T')[0],
    );

    if (exception?.isClosed)
      throw new BadRequestException('Facility closed on this date');

    // 2 — Determine Effective Slot Config
    let config: any;

    if (exception) {
      config = {
        startTime: exception.startTime ?? '00:00',
        endTime: exception.endTime ?? '23:59',
        slotDurationMinutes: exception.slotDurationMinutes ?? null,
        slotCapacity: exception.slotCapacity ?? facility.capacity ?? null,
      };
    } else {
      config = facility.slotConfig.find((c) => c.dayOfWeek === dayIndex);
    }

    if (!config)
      throw new BadRequestException('No slots configured for this day');

    // Validate that requested times match slot boundaries
    const valid = await this.validateTime(dto, config);
    if (!valid) {
      throw new BadRequestException('Requested time does not match slot rules');
    }

    // 3 — Check maxReservationsPerDay
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

    // 4 — Cooldown check
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

    // 5 — Save Booking
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

  // slot validation helper
  async validateTime(dto: CreateBookingDto, config: any) {
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

  async findAll() {
    return this.prisma.booking.findMany({
      include: { facility: true, user: true, resident: true, unit: true },
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
