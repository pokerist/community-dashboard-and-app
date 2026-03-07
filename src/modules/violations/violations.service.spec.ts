import { BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InvoiceStatus,
  InvoiceType,
  ViolationActionStatus,
  ViolationActionType,
  ViolationStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ReviewAppealDto } from './dto/review-appeal.dto';
import { ViolationDetailDto } from './dto/violation-response.dto';
import { ViolationsService } from './violations.service';

describe('ViolationsService (Unit)', () => {
  let service: ViolationsService;

  const txMock = {
    violation: {
      create: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      updateMany: jest.fn(),
    },
    violationActionRequest: {
      update: jest.fn(),
    },
  };

  const prismaMock = {
    unit: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
    },
    violationCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    violation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn(),
    },
    violationActionRequest: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    invoice: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock),
    ),
  };

  const invoicesServiceMock = {
    generateInvoiceTx: jest.fn(),
  };

  const eventEmitterMock = {
    emit: jest.fn(),
  };

  const detailFixture: ViolationDetailDto = {
    id: 'vio-1',
    violationNumber: 'VIO-00001',
    categoryId: null,
    categoryName: null,
    categoryDescription: null,
    description: 'fixture',
    fineAmount: 0,
    status: ViolationStatus.PENDING,
    appealStatus: null,
    appealDeadline: null,
    closedAt: null,
    unitId: 'unit-1',
    unitNumber: 'A-1',
    residentId: null,
    residentName: null,
    issuerId: null,
    issuerName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    photoEvidence: [],
    actionRequests: [],
    invoices: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViolationsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: InvoicesService,
          useValue: invoicesServiceMock,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
      ],
    }).compile();

    service = module.get<ViolationsService>(ViolationsService);
  });

  it('creates violation and auto-generates fine invoice from category default', async () => {
    prismaMock.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    prismaMock.violationCategory.findUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'Parking',
      defaultFineAmount: new Decimal(500),
      isActive: true,
    });
    prismaMock.violation.findFirst.mockResolvedValue(null);
    txMock.violation.create.mockResolvedValue({ id: 'vio-1' });

    jest.spyOn(service, 'getViolationDetail').mockResolvedValue(detailFixture);

    await service.createViolation(
      {
        unitId: 'unit-1',
        categoryId: 'cat-1',
        description: 'Double parking',
      },
      'admin-1',
    );

    expect(txMock.violation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          typeLegacy: 'Parking',
          fineAmount: 500,
          status: ViolationStatus.PENDING,
        }),
      }),
    );

    expect(invoicesServiceMock.generateInvoiceTx).toHaveBeenCalledWith(
      txMock,
      expect.objectContaining({
        type: InvoiceType.FINE,
        amount: 500,
        status: InvoiceStatus.PENDING,
        sources: { violationIds: ['vio-1'] },
      }),
    );
  });

  it('rejects cancel when violation is paid', async () => {
    prismaMock.violation.findUnique.mockResolvedValue({
      id: 'vio-paid',
      status: ViolationStatus.PAID,
    });

    await expect(service.cancelViolation('vio-paid', 'admin-1')).rejects.toThrow(
      new BadRequestException('Cannot cancel a paid violation'),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('approving an appeal cancels violation and linked pending fine invoice', async () => {
    prismaMock.violationActionRequest.findUnique.mockResolvedValue({
      id: 'action-1',
      type: ViolationActionType.APPEAL,
      status: ViolationActionStatus.PENDING,
      violationId: 'vio-1',
      violation: { id: 'vio-1' },
    });

    jest.spyOn(service, 'getViolationDetail').mockResolvedValue(detailFixture);

    const dto: ReviewAppealDto = { approved: true };
    await service.reviewAppeal('action-1', dto, 'admin-1');

    expect(txMock.violationActionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'action-1' },
        data: expect.objectContaining({
          status: ViolationActionStatus.APPROVED,
          reviewedById: 'admin-1',
        }),
      }),
    );

    expect(txMock.violation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'vio-1' },
        data: expect.objectContaining({
          status: ViolationStatus.CANCELLED,
          appealStatus: 'APPROVED',
        }),
      }),
    );

    expect(txMock.invoice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          violationId: 'vio-1',
          type: InvoiceType.FINE,
          status: InvoiceStatus.PENDING,
        }),
        data: { status: InvoiceStatus.CANCELLED },
      }),
    );
  });
});
