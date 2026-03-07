import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AddSlotExceptionDto } from './dto/add-slot-exception.dto';
import { CreateFacilityDto } from './dto/create-facility.dto';
import {
  AmenityStatsByFacilityDto,
  AmenityStatsDto,
  FacilityAvailableSlotItemDto,
  FacilityAvailableSlotsDto,
  FacilityDetailDto,
  FacilityListItemDto,
  FacilitySlotConfigItemDto,
  FacilitySlotExceptionItemDto,
} from './dto/facility-response.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { UpsertSlotConfigDto } from './dto/upsert-slot-config.dto';

type FacilityListRecord = Prisma.FacilityGetPayload<{
  include: { slotConfig: { select: { id: true } } };
}>;

type FacilityDetailRecord = Prisma.FacilityGetPayload<{
  include: {
    slotConfig: true;
    slotExceptions: true;
  };
}>;

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private getStartOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getEndOfDay(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private toFacilityListItem(
    row: FacilityListRecord,
    todayBookingsByFacilityId: Map<string, number>,
  ): FacilityListItemDto {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      iconName: row.iconName,
      color: row.color,
      rules: row.rules,
      isActive: row.isActive,
      isBookable: row.isBookable,
      requiresPrepayment: row.requiresPrepayment,
      capacity: row.capacity,
      price: row.price,
      billingCycle: row.billingCycle,
      reminderMinutesBefore: row.reminderMinutesBefore,
      maxReservationsPerDay: row.maxReservationsPerDay,
      cooldownMinutes: row.cooldownMinutes,
      slotCount: row.slotConfig.length,
      upcomingBookingsToday: todayBookingsByFacilityId.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toSlotConfigDto(row: {
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    slotCapacity: number | null;
  }): FacilitySlotConfigItemDto {
    return {
      id: row.id,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      slotDurationMinutes: row.slotDurationMinutes,
      slotCapacity: row.slotCapacity,
    };
  }

  private toSlotExceptionDto(row: {
    id: string;
    date: Date;
    isClosed: boolean;
    startTime: string | null;
    endTime: string | null;
    slotDurationMinutes: number | null;
    slotCapacity: number | null;
  }): FacilitySlotExceptionItemDto {
    return {
      id: row.id,
      date: row.date.toISOString(),
      isClosed: row.isClosed,
      startTime: row.startTime,
      endTime: row.endTime,
      slotDurationMinutes: row.slotDurationMinutes,
      slotCapacity: row.slotCapacity,
    };
  }

  private async getTodayBookingsByFacilityId(): Promise<Map<string, number>> {
    const now = new Date();
    const dayStart = this.getStartOfDay(now);
    const dayEnd = this.getEndOfDay(now);

    const grouped = await this.prisma.booking.groupBy({
      by: ['facilityId'],
      where: {
        date: { gte: dayStart, lte: dayEnd },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.APPROVED],
        },
      },
      _count: { _all: true },
    });

    return new Map(grouped.map((row) => [row.facilityId, row._count._all]));
  }

  async listFacilities(includeInactive = false): Promise<FacilityListItemDto[]> {
    const [rows, todayBookingsByFacilityId] = await Promise.all([
      this.prisma.facility.findMany({
        where: includeInactive ? undefined : { isActive: true },
        include: {
          slotConfig: { select: { id: true } },
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.getTodayBookingsByFacilityId(),
    ]);

    return rows.map((row) => this.toFacilityListItem(row, todayBookingsByFacilityId));
  }

  async getFacilityDetail(id: string): Promise<FacilityDetailDto> {
    const now = new Date();
    const next30Days = new Date(now);
    next30Days.setDate(next30Days.getDate() + 30);

    const row = await this.prisma.facility.findUnique({
      where: { id },
      include: {
        slotConfig: {
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
        slotExceptions: {
          where: {
            date: {
              gte: this.getStartOfDay(now),
              lte: this.getEndOfDay(next30Days),
            },
          },
          orderBy: [{ date: 'asc' }],
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Facility ${id} not found`);
    }

    const [todayBookingsByFacilityId, totalBookings, pendingBookings, revenueThisMonth] =
      await Promise.all([
        this.getTodayBookingsByFacilityId(),
        this.prisma.booking.count({ where: { facilityId: id } }),
        this.prisma.booking.count({
          where: { facilityId: id, status: { in: [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT] } },
        }),
        this.getFacilityRevenueForCurrentMonth(id),
      ]);

    return {
      ...this.toFacilityListItem(row, todayBookingsByFacilityId),
      slotConfig: row.slotConfig.map((slot) => this.toSlotConfigDto(slot)),
      slotExceptions: row.slotExceptions.map((item) => this.toSlotExceptionDto(item)),
      bookingStats: {
        totalBookings,
        pendingBookings,
        revenueThisMonth,
      },
    };
  }

  private async getFacilityRevenueForCurrentMonth(facilityId: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const aggregate = await this.prisma.invoice.aggregate({
      where: {
        type: InvoiceType.BOOKING_FEE,
        status: InvoiceStatus.PAID,
        paidDate: { gte: monthStart, lt: nextMonth },
        booking: { facilityId },
      },
      _sum: { amount: true },
    });

    return Number(aggregate._sum.amount ?? 0);
  }

  async createFacility(dto: CreateFacilityDto): Promise<FacilityDetailDto> {
    const created = await this.prisma.facility.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        iconName: dto.iconName?.trim() || null,
        color: dto.color?.trim() || null,
        rules: dto.rules?.trim() || null,
        isActive: dto.isActive ?? true,
        capacity: dto.capacity,
        price: dto.price,
        billingCycle: dto.billingCycle,
        isBookable: dto.isBookable ?? true,
        requiresPrepayment: dto.requiresPrepayment ?? false,
        reminderMinutesBefore: dto.reminderMinutesBefore ?? 60,
        maxReservationsPerDay: dto.maxReservationsPerDay,
        cooldownMinutes: dto.cooldownMinutes,
        slotConfig: dto.slotConfig
          ? {
              create: dto.slotConfig.map((slot) => ({
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                slotDurationMinutes: slot.slotDurationMinutes,
                slotCapacity: slot.slotCapacity,
              })),
            }
          : undefined,
        slotExceptions: dto.slotExceptions
          ? {
              create: dto.slotExceptions.map((slotException) => ({
                date: new Date(slotException.date),
                isClosed: slotException.isClosed ?? false,
                startTime: slotException.startTime ?? null,
                endTime: slotException.endTime ?? null,
                slotDurationMinutes: slotException.slotDurationMinutes ?? null,
                slotCapacity: slotException.slotCapacity ?? null,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });

    return this.getFacilityDetail(created.id);
  }

  async updateFacility(id: string, dto: UpdateFacilityDto): Promise<FacilityDetailDto> {
    const facility = await this.prisma.facility.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!facility) {
      throw new NotFoundException(`Facility ${id} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.facility.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description === undefined ? undefined : dto.description.trim() || null,
          type: dto.type,
          iconName: dto.iconName === undefined ? undefined : dto.iconName.trim() || null,
          color: dto.color === undefined ? undefined : dto.color.trim() || null,
          rules: dto.rules === undefined ? undefined : dto.rules.trim() || null,
          isActive: dto.isActive,
          capacity: dto.capacity,
          price: dto.price,
          billingCycle: dto.billingCycle,
          isBookable: dto.isBookable,
          requiresPrepayment: dto.requiresPrepayment,
          reminderMinutesBefore: dto.reminderMinutesBefore,
          maxReservationsPerDay: dto.maxReservationsPerDay,
          cooldownMinutes: dto.cooldownMinutes,
        },
      });

      if (dto.slotConfig !== undefined) {
        await tx.facilitySlotConfig.deleteMany({ where: { facilityId: id } });
        if (dto.slotConfig.length > 0) {
          await tx.facilitySlotConfig.createMany({
            data: dto.slotConfig.map((slot) => ({
              facilityId: id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              slotDurationMinutes: slot.slotDurationMinutes,
              slotCapacity: slot.slotCapacity,
            })),
          });
        }
      }

      if (dto.slotExceptions !== undefined) {
        await tx.facilitySlotException.deleteMany({ where: { facilityId: id } });
        if (dto.slotExceptions.length > 0) {
          await tx.facilitySlotException.createMany({
            data: dto.slotExceptions.map((slotException) => ({
              facilityId: id,
              date: new Date(slotException.date),
              isClosed: slotException.isClosed ?? false,
              startTime: slotException.startTime ?? null,
              endTime: slotException.endTime ?? null,
              slotDurationMinutes: slotException.slotDurationMinutes ?? null,
              slotCapacity: slotException.slotCapacity ?? null,
            })),
          });
        }
      }
    });

    return this.getFacilityDetail(id);
  }

  async toggleFacility(id: string): Promise<FacilityDetailDto> {
    const row = await this.prisma.facility.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!row) {
      throw new NotFoundException(`Facility ${id} not found`);
    }

    await this.prisma.facility.update({
      where: { id },
      data: { isActive: !row.isActive },
    });

    return this.getFacilityDetail(id);
  }

  async upsertSlotConfig(
    facilityId: string,
    dayOfWeek: number,
    dto: UpsertSlotConfigDto,
  ): Promise<FacilitySlotConfigItemDto> {
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException('dayOfWeek must be a number between 0 and 6');
    }

    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    });
    if (!facility) {
      throw new NotFoundException(`Facility ${facilityId} not found`);
    }

    const existing = await this.prisma.facilitySlotConfig.findFirst({
      where: { facilityId, dayOfWeek },
      select: { id: true },
    });

    const row = existing
      ? await this.prisma.facilitySlotConfig.update({
          where: { id: existing.id },
          data: {
            startTime: dto.startTime,
            endTime: dto.endTime,
            slotDurationMinutes: dto.slotDurationMinutes,
            slotCapacity: dto.slotCapacity ?? null,
          },
        })
      : await this.prisma.facilitySlotConfig.create({
          data: {
            facilityId,
            dayOfWeek,
            startTime: dto.startTime,
            endTime: dto.endTime,
            slotDurationMinutes: dto.slotDurationMinutes,
            slotCapacity: dto.slotCapacity ?? null,
          },
        });

    return this.toSlotConfigDto(row);
  }

  async removeSlotConfig(id: string): Promise<FacilitySlotConfigItemDto> {
    const row = await this.prisma.facilitySlotConfig.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(`Slot config ${id} not found`);
    }

    await this.prisma.facilitySlotConfig.delete({ where: { id } });
    return this.toSlotConfigDto(row);
  }

  async addSlotException(
    facilityId: string,
    dto: AddSlotExceptionDto,
  ): Promise<FacilitySlotExceptionItemDto> {
    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    });
    if (!facility) {
      throw new NotFoundException(`Facility ${facilityId} not found`);
    }

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date must be a valid datetime');
    }

    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('Exception date must be in the future');
    }

    const dayStart = this.getStartOfDay(date);
    const dayEnd = this.getEndOfDay(date);
    const existing = await this.prisma.facilitySlotException.findFirst({
      where: {
        facilityId,
        date: { gte: dayStart, lte: dayEnd },
      },
    });

    const row = existing
      ? await this.prisma.facilitySlotException.update({
          where: { id: existing.id },
          data: {
            isClosed: dto.isClosed,
            startTime: dto.startTime ?? null,
            endTime: dto.endTime ?? null,
            slotDurationMinutes: dto.slotDurationMinutes ?? null,
            slotCapacity: dto.slotCapacity ?? null,
          },
        })
      : await this.prisma.facilitySlotException.create({
          data: {
            facilityId,
            date,
            isClosed: dto.isClosed,
            startTime: dto.startTime ?? null,
            endTime: dto.endTime ?? null,
            slotDurationMinutes: dto.slotDurationMinutes ?? null,
            slotCapacity: dto.slotCapacity ?? null,
          },
        });

    return this.toSlotExceptionDto(row);
  }

  async removeSlotException(id: string): Promise<FacilitySlotExceptionItemDto> {
    const row = await this.prisma.facilitySlotException.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException(`Slot exception ${id} not found`);
    }

    await this.prisma.facilitySlotException.delete({ where: { id } });
    return this.toSlotExceptionDto(row);
  }

  private parseTimeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private formatMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const mins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${mins}`;
  }

  async getAvailableSlots(facilityId: string, dateInput?: string): Promise<FacilityAvailableSlotsDto> {
    const dateValue = dateInput ? new Date(dateInput) : new Date();
    if (Number.isNaN(dateValue.getTime())) {
      throw new BadRequestException('date must be a valid date');
    }

    const dayStart = this.getStartOfDay(dateValue);
    const dayEnd = this.getEndOfDay(dateValue);
    const dayOfWeek = dayStart.getDay();

    const facility = await this.prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        slotConfig: {
          where: { dayOfWeek },
          orderBy: [{ startTime: 'asc' }],
        },
        slotExceptions: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          orderBy: [{ date: 'asc' }],
          take: 1,
        },
      },
    });
    if (!facility) {
      throw new NotFoundException(`Facility ${facilityId} not found`);
    }

    const baseConfig = facility.slotConfig[0] ?? null;
    const exception = facility.slotExceptions[0] ?? null;

    let startTime = baseConfig?.startTime ?? null;
    let endTime = baseConfig?.endTime ?? null;
    let slotDurationMinutes = baseConfig?.slotDurationMinutes ?? null;

    if (exception) {
      startTime = exception.startTime ?? startTime;
      endTime = exception.endTime ?? endTime;
      slotDurationMinutes = exception.slotDurationMinutes ?? slotDurationMinutes;
    }

    if (!startTime || !endTime || !slotDurationMinutes) {
      return { date: dayStart.toISOString(), slots: [] };
    }

    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('Invalid slot configuration for selected date');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        facilityId,
        date: { gte: dayStart, lte: dayEnd },
        status: { in: [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.APPROVED] },
      },
      select: { id: true, startTime: true, endTime: true },
    });

    const bookingByKey = new Map(
      bookings.map((booking) => [`${booking.startTime}-${booking.endTime}`, booking.id]),
    );

    const slots: FacilityAvailableSlotItemDto[] = [];
    for (
      let pointer = startMinutes;
      pointer + slotDurationMinutes <= endMinutes;
      pointer += slotDurationMinutes
    ) {
      const slotStart = this.formatMinutes(pointer);
      const slotEnd = this.formatMinutes(pointer + slotDurationMinutes);
      const key = `${slotStart}-${slotEnd}`;
      const bookingId = bookingByKey.get(key) ?? null;

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        status: exception?.isClosed ? 'CLOSED' : bookingId ? 'BOOKED' : 'AVAILABLE',
        bookingId,
      });
    }

    return {
      date: dayStart.toISOString(),
      slots,
    };
  }

  async getAmenityStats(): Promise<AmenityStatsDto> {
    const now = new Date();
    const dayStart = this.getStartOfDay(now);
    const dayEnd = this.getEndOfDay(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalFacilities,
      activeFacilities,
      bookingsToday,
      pendingApprovals,
      bookingStatusRows,
      bookingFacilityRows,
      paidBookingInvoices,
      facilities,
    ] = await Promise.all([
      this.prisma.facility.count(),
      this.prisma.facility.count({ where: { isActive: true } }),
      this.prisma.booking.count({
        where: {
          date: { gte: dayStart, lte: dayEnd },
          status: {
            in: [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.APPROVED],
          },
        },
      }),
      this.prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['facilityId'],
        _count: { _all: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          type: InvoiceType.BOOKING_FEE,
          status: InvoiceStatus.PAID,
          paidDate: { gte: monthStart, lt: nextMonthStart },
          bookingId: { not: null },
        },
        select: {
          amount: true,
          booking: { select: { facilityId: true } },
        },
      }),
      this.prisma.facility.findMany({
        select: { id: true, name: true },
      }),
    ]);

    const bookingsByStatus: Record<BookingStatus, number> = {
      PENDING: 0,
      PENDING_PAYMENT: 0,
      APPROVED: 0,
      CANCELLED: 0,
      REJECTED: 0,
    };
    for (const row of bookingStatusRows) {
      bookingsByStatus[row.status] = row._count._all;
    }

    const revenueByFacilityId = new Map<string, number>();
    let revenueThisMonth = 0;
    for (const invoice of paidBookingInvoices) {
      const facilityId = invoice.booking?.facilityId;
      const amount = Number(invoice.amount);
      revenueThisMonth += amount;
      if (facilityId) {
        revenueByFacilityId.set(
          facilityId,
          (revenueByFacilityId.get(facilityId) ?? 0) + amount,
        );
      }
    }

    const facilityNameById = new Map(facilities.map((facility) => [facility.id, facility.name]));
    const bookingsByFacility: AmenityStatsByFacilityDto[] = bookingFacilityRows.map((row) => ({
      facilityId: row.facilityId,
      name: facilityNameById.get(row.facilityId) ?? 'Unknown Facility',
      count: row._count._all,
      revenue: Number((revenueByFacilityId.get(row.facilityId) ?? 0).toFixed(2)),
    }));

    return {
      totalFacilities,
      activeFacilities,
      bookingsToday,
      pendingApprovals,
      revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
      bookingsByFacility,
      bookingsByStatus,
    };
  }
}
