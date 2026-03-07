import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BillingCycle, BookingStatus, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { BookingDetailDto } from './dto/booking-response.dto';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;

  const txMock = {
    booking: {
      update: jest.fn(),
    },
    invoice: {
      updateMany: jest.fn(),
    },
  };

  const prismaMock = {
    booking: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock),
    ),
  };

  const invoicesServiceMock = {
    generateInvoiceTx: jest.fn(),
  };

  const detailFixture: BookingDetailDto = {
    id: 'booking-1',
    facilityId: 'facility-1',
    facilityName: 'Main Pool',
    facilityType: 'POOL',
    facilityDescription: null,
    facilityRules: null,
    userId: 'user-1',
    userName: 'Resident',
    userPhone: null,
    unitNumber: 'A-101',
    date: new Date().toISOString(),
    startTime: '10:00',
    endTime: '11:00',
    status: BookingStatus.PENDING_PAYMENT,
    totalAmount: 120,
    requiresPrepayment: true,
    paymentStatus: 'PENDING',
    cancellationReason: null,
    rejectionReason: null,
    cancelledById: null,
    rejectedById: null,
    checkedInAt: null,
    cancelledAt: null,
    refundRequired: false,
    invoices: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InvoicesService, useValue: invoicesServiceMock },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    jest.clearAllMocks();
  });

  it('approveBooking creates BOOKING_FEE invoice when amount > 0', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      unitId: 'unit-1',
      userId: 'user-1',
      date: new Date('2026-03-09T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      status: BookingStatus.PENDING,
      facility: {
        name: 'Main Pool',
        price: 120,
        billingCycle: BillingCycle.PER_HOUR,
        requiresPrepayment: true,
      },
      invoices: [],
    });
    jest.spyOn(service, 'getBookingDetail').mockResolvedValue(detailFixture);

    await service.approveBooking('booking-1', 'admin-1');

    expect(txMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: BookingStatus.PENDING_PAYMENT,
          totalAmount: 120,
        }),
      }),
    );
    expect(invoicesServiceMock.generateInvoiceTx).toHaveBeenCalled();
  });

  it('cancelBooking flags paid invoices for refund via booking cancellation reason', async () => {
    prismaMock.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      date: new Date('2026-03-09T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      status: BookingStatus.APPROVED,
      facility: { name: 'Main Pool' },
      invoices: [{ id: 'inv-1', status: InvoiceStatus.PAID }],
    });
    jest.spyOn(service, 'getBookingDetail').mockResolvedValue({
      ...detailFixture,
      status: BookingStatus.CANCELLED,
      cancellationReason: 'Cancelled [REFUND_REQUIRED]',
      refundRequired: true,
    });

    const result = await service.cancelBooking('booking-1', 'admin-1', {
      reason: 'Cancelled',
    });

    expect(txMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          cancellationReason: expect.stringContaining('[REFUND_REQUIRED]'),
        }),
      }),
    );
    expect(result.refundRequired).toBe(true);
  });
});
