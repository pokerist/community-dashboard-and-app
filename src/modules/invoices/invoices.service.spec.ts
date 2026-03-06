import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;

  const prismaMock = {
    invoiceCategory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    invoiceSequence: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    unit: {
      findUnique: jest.fn(),
    },
    residentUnit: {
      findFirst: jest.fn(),
    },
    unitFee: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    unitAccess: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    violation: {
      update: jest.fn(),
    },
    serviceRequest: {
      update: jest.fn(),
    },
    service: {
      update: jest.fn(),
    },
    complaint: {
      update: jest.fn(),
    },
    booking: {
      update: jest.fn(),
    },
    incident: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const eventEmitterMock = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof prismaMock) => Promise<unknown>,
      ): Promise<unknown> => callback(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventEmitter2, useValue: eventEmitterMock },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('bulkMarkOverdue updates only pending invoices with dueDate < now', async () => {
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 7 });

    const result = await service.bulkMarkOverdue();

    expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: InvoiceStatus.PENDING,
          dueDate: expect.objectContaining({ lt: expect.any(Date) }),
        }),
        data: { status: InvoiceStatus.OVERDUE },
      }),
    );
    expect(result).toEqual({ updatedCount: 7 });
  });

  it('cancelInvoice throws 409 when invoice is PAID', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: InvoiceStatus.PAID,
    });

    await expect(
      service.cancelInvoice('inv-1', { reason: 'Invalid charge' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('getInvoiceStats returns aggregated totals and counts by type/status', async () => {
    prismaMock.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(1200) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(450) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(300) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(900) } });
    prismaMock.invoice.count.mockResolvedValue(3);
    prismaMock.invoice.groupBy
      .mockResolvedValueOnce([
        { type: InvoiceType.RENT, _count: { _all: 5 } },
        { type: InvoiceType.FINE, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { status: InvoiceStatus.PAID, _count: { _all: 4 } },
        { status: InvoiceStatus.PENDING, _count: { _all: 6 } },
      ]);

    const stats = await service.getInvoiceStats({});

    expect(stats.totalRevenue).toBe(1200);
    expect(stats.pendingAmount).toBe(450);
    expect(stats.overdueAmount).toBe(300);
    expect(stats.overdueCount).toBe(3);
    expect(stats.paidThisMonth).toBe(900);
    expect(stats.invoicesByType.RENT).toBe(5);
    expect(stats.invoicesByType.FINE).toBe(2);
    expect(stats.invoicesByStatus.PAID).toBe(4);
    expect(stats.invoicesByStatus.PENDING).toBe(6);
  });
});
