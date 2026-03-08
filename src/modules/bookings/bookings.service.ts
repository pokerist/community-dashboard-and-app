import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BillingCycle,
  BookingStatus,
  InvoiceStatus,
  InvoiceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { BookingApprovedEvent } from '../../events/contracts/booking-approved.event';
import { BookingCancelledEvent } from '../../events/contracts/booking-cancelled.event';
import { InvoicesService } from '../invoices/invoices.service';
import { BookingDetailDto, BookingDetailInvoiceDto, BookingListItemDto, BookingListResponseDto } from './dto/booking-response.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';

type BookingListRecord = Prisma.BookingGetPayload<{
  include: {
    facility: {
      select: {
        id: true;
        name: true;
        type: true;
        requiresPrepayment: true;
        price: true;
        billingCycle: true;
      };
    };
    user: { select: { id: true; nameEN: true; nameAR: true; email: true } };
    unit: { select: { id: true; unitNumber: true } };
    invoices: {
      select: { id: true; status: true; type: true };
      where: { type: 'BOOKING_FEE' };
      take: 1;
      orderBy: { createdAt: 'desc' };
    };
  };
}>;

type BookingDetailRecord = Prisma.BookingGetPayload<{
  include: {
    facility: {
      select: {
        id: true;
        name: true;
        description: true;
        type: true;
        requiresPrepayment: true;
        price: true;
        billingCycle: true;
        rules: true;
      };
    };
    user: { select: { id: true; nameEN: true; nameAR: true; email: true; phone: true } };
    unit: { select: { id: true; unitNumber: true } };
    invoices: {
      select: {
        id: true;
        invoiceNumber: true;
        amount: true;
        status: true;
        dueDate: true;
        paidDate: true;
        type: true;
      };
      where: { type: 'BOOKING_FEE' };
      orderBy: { createdAt: 'desc' };
    };
  };
}>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly invoicesService: InvoicesService,
  ) {}

  private toUserName(input: { nameEN: string | null; nameAR: string | null; email: string | null }): string {
    return input.nameEN ?? input.nameAR ?? input.email ?? 'Unknown User';
  }

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private parseTimeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private calculateTotalAmount(input: {
    startTime: string;
    endTime: string;
    price: number | null;
    billingCycle: BillingCycle;
  }): number {
    const price = input.price ?? 0;
    if (price <= 0 || input.billingCycle === BillingCycle.NONE) {
      return 0;
    }

    if (input.billingCycle === BillingCycle.PER_USE || input.billingCycle === BillingCycle.PER_SLOT) {
      return Number(price.toFixed(2));
    }

    if (input.billingCycle === BillingCycle.PER_HOUR) {
      const durationMinutes = this.parseTimeToMinutes(input.endTime) - this.parseTimeToMinutes(input.startTime);
      if (durationMinutes <= 0) {
        throw new BadRequestException('Booking endTime must be after startTime');
      }
      return Number(((durationMinutes / 60) * price).toFixed(2));
    }

    return Number(price.toFixed(2));
  }

  private toBookingListItem(row: BookingListRecord): BookingListItemDto {
    return {
      id: row.id,
      facilityName: row.facility.name,
      facilityType: row.facility.type,
      userName: this.toUserName(row.user),
      unitNumber: row.unit?.unitNumber ?? null,
      date: row.date.toISOString(),
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      totalAmount: row.totalAmount ? Number(row.totalAmount) : null,
      requiresPrepayment: row.facility.requiresPrepayment,
      paymentStatus: row.invoices[0]?.status ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toInvoiceDto(row: BookingDetailRecord['invoices'][number]): BookingDetailInvoiceDto {
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      amount: Number(row.amount),
      status: row.status,
      dueDate: row.dueDate.toISOString(),
      paidDate: this.toIso(row.paidDate),
    };
  }

  private toBookingDetailDto(row: BookingDetailRecord): BookingDetailDto {
    const listItem = this.toBookingListItem(row);

    return {
      ...listItem,
      facilityId: row.facilityId,
      facilityDescription: row.facility.description,
      facilityRules: row.facility.rules,
      userId: row.userId,
      userPhone: row.user.phone,
      cancellationReason: row.cancellationReason,
      rejectionReason: row.rejectionReason,
      cancelledById: row.cancelledById,
      rejectedById: row.rejectedById,
      checkedInAt: this.toIso(row.checkedInAt),
      cancelledAt: this.toIso(row.cancelledAt),
      refundRequired:
        row.status === BookingStatus.CANCELLED &&
        row.invoices.some((invoice) => invoice.status === InvoiceStatus.PAID),
      invoices: row.invoices.map((invoice) => this.toInvoiceDto(invoice)),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async getBookingById(id: string): Promise<BookingDetailRecord> {
    const row = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            requiresPrepayment: true,
            price: true,
            billingCycle: true,
            rules: true,
          },
        },
        user: {
          select: { id: true, nameEN: true, nameAR: true, email: true, phone: true },
        },
        unit: {
          select: { id: true, unitNumber: true },
        },
        invoices: {
          where: { type: InvoiceType.BOOKING_FEE },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            dueDate: true,
            paidDate: true,
            type: true,
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    return row;
  }

  async listMyBookings(userId: string): Promise<BookingListItemDto[]> {
    const rows = await this.prisma.booking.findMany({
      where: { userId },
      include: {
        facility: {
          select: {
            id: true,
            name: true,
            type: true,
            requiresPrepayment: true,
            price: true,
            billingCycle: true,
          },
        },
        user: { select: { id: true, nameEN: true, nameAR: true, email: true } },
        unit: { select: { id: true, unitNumber: true } },
        invoices: {
          where: { type: InvoiceType.BOOKING_FEE },
          select: { id: true, status: true, type: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.toBookingListItem(row));
  }

  async createBooking(dto: CreateBookingDto, userId: string): Promise<BookingDetailDto> {
    const [facility, unit] = await Promise.all([
      this.prisma.facility.findUnique({
        where: { id: dto.facilityId },
        select: {
          id: true,
          name: true,
          isActive: true,
          requiresPrepayment: true,
          price: true,
          billingCycle: true,
        },
      }),
      this.prisma.unit.findUnique({
        where: { id: dto.unitId },
        select: { id: true },
      }),
    ]);

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }
    if (!facility.isActive) {
      throw new BadRequestException('Facility is not active');
    }
    if (!unit) {
      throw new BadRequestException('Unit not found');
    }

    const startMinutes = this.parseTimeToMinutes(dto.startTime);
    const endMinutes = this.parseTimeToMinutes(dto.endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // Check for overlapping bookings on the same facility + date
    const bookingDate = new Date(dto.date);
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        facilityId: dto.facilityId,
        date: bookingDate,
        status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED] },
        OR: [
          { AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }] },
        ],
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new BadRequestException('Time slot is already booked for this facility');
    }

    const totalAmount = this.calculateTotalAmount({
      startTime: dto.startTime,
      endTime: dto.endTime,
      price: facility.price,
      billingCycle: facility.billingCycle,
    });

    const created = await this.prisma.booking.create({
      data: {
        facilityId: dto.facilityId,
        userId,
        unitId: dto.unitId,
        date: bookingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        totalAmount,
        status: BookingStatus.PENDING,
      },
      select: { id: true },
    });

    return this.getBookingDetail(created.id);
  }

  async listBookings(filters: BookingsQueryDto): Promise<BookingListResponseDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();

    const where: Prisma.BookingWhereInput = {
      facilityId: filters.facilityId,
      status: filters.status,
      userId: filters.userId,
      unitId: filters.unitId,
      date:
        filters.dateFrom || filters.dateTo
          ? {
              gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
              lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
            }
          : undefined,
    };

    if (search) {
      where.OR = [
        { facility: { name: { contains: search, mode: 'insensitive' } } },
        { user: { nameEN: { contains: search, mode: 'insensitive' } } },
        { user: { nameAR: { contains: search, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          facility: {
            select: {
              id: true,
              name: true,
              type: true,
              requiresPrepayment: true,
              price: true,
              billingCycle: true,
            },
          },
          user: { select: { id: true, nameEN: true, nameAR: true, email: true } },
          unit: { select: { id: true, unitNumber: true } },
          invoices: {
            where: { type: InvoiceType.BOOKING_FEE },
            select: { id: true, status: true, type: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toBookingListItem(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getBookingDetail(id: string): Promise<BookingDetailDto> {
    const row = await this.getBookingById(id);
    return this.toBookingDetailDto(row);
  }

  async approveBooking(id: string, adminId: string): Promise<BookingDetailDto> {
    if (!adminId) {
      throw new BadRequestException('Invalid admin context');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        facility: {
          select: {
            name: true,
            price: true,
            billingCycle: true,
            requiresPrepayment: true,
          },
        },
        invoices: {
          where: { type: InvoiceType.BOOKING_FEE },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.REJECTED) {
      throw new BadRequestException('Cannot approve a cancelled or rejected booking');
    }

    const totalAmount = this.calculateTotalAmount({
      startTime: booking.startTime,
      endTime: booking.endTime,
      price: booking.facility.price,
      billingCycle: booking.facility.billingCycle,
    });

    const targetStatus =
      booking.facility.requiresPrepayment && totalAmount > 0
        ? BookingStatus.PENDING_PAYMENT
        : BookingStatus.APPROVED;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          status: targetStatus,
          totalAmount,
        },
      });

      if (totalAmount > 0 && booking.invoices.length === 0) {
        if (!booking.unitId) {
          throw new BadRequestException('Booking unit is required to generate invoice');
        }
        await this.invoicesService.generateInvoiceTx(tx, {
          unitId: booking.unitId,
          residentId: booking.userId,
          amount: totalAmount,
          dueDate: booking.date,
          type: InvoiceType.BOOKING_FEE,
          status: InvoiceStatus.PENDING,
          sources: { bookingIds: [id] },
        });
      }
    });

    if (targetStatus === BookingStatus.APPROVED) {
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
    }

    return this.getBookingDetail(id);
  }

  async rejectBooking(id: string, adminId: string, dto: RejectBookingDto): Promise<BookingDetailDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { facility: { select: { name: true } } },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cannot reject a cancelled booking');
    }

    await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.REJECTED,
        rejectionReason: dto.reason.trim(),
        rejectedById: adminId,
      },
    });

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

    return this.getBookingDetail(id);
  }

  async cancelBooking(id: string, cancelledById: string, dto: CancelBookingDto): Promise<BookingDetailDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        facility: { select: { name: true } },
        invoices: {
          where: { type: InvoiceType.BOOKING_FEE },
          select: { id: true, status: true },
        },
      },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }

    const hasPaidInvoice = booking.invoices.some((invoice) => invoice.status === InvoiceStatus.PAID);
    const reason = dto.reason.trim();
    const cancellationReason = hasPaidInvoice
      ? `${reason} [REFUND_REQUIRED]`
      : reason;

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById,
          cancellationReason,
        },
      });

      await tx.invoice.updateMany({
        where: {
          bookingId: id,
          type: InvoiceType.BOOKING_FEE,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
        },
        data: {
          status: InvoiceStatus.CANCELLED,
        },
      });
    });

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

    return this.getBookingDetail(id);
  }
}
