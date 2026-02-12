import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

const mockPrisma = {
  invoice: { findUnique: jest.fn(), findMany: jest.fn() },
  unitAccess: { findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((callback) => {
    const tx = {
      invoiceSequence: { upsert: jest.fn(), update: jest.fn() },
      invoice: { create: jest.fn() },
      unitFee: { updateMany: jest.fn(), findMany: jest.fn() },
    } as any;
    return callback(tx);
  }),
  unitFee: { findMany: jest.fn() },
};
const mockEmitter = { emit: jest.fn() };

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEmitter },
      ],
    }).compile();

    // Manually construct with the mock-understood provider keys
    service = new InvoicesService(mockPrisma as any, mockEmitter as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateInvoice should create invoice and link unit fees in a transaction and emit an event', async () => {
    const createdInvoice = {
      id: 'inv-1',
      unitId: 'unit-1',
      residentId: 'res-1',
      amount: { toNumber: () => 150 },
      dueDate: new Date(),
      type: 'UTILITY',
    } as any;

    // Prepare tx mocks
    const fakeSeq = { counter: BigInt(100) } as any;

    const tx = {
      invoiceSequence: {
        upsert: jest.fn().mockResolvedValue(fakeSeq),
        update: jest.fn().mockImplementation(async ({ data }) => {
          // simulate atomic increment
          fakeSeq.counter = BigInt(
            (fakeSeq.counter as bigint) + BigInt(data.counter.increment),
          );
          return { counter: fakeSeq.counter };
        }),
      },
      invoice: {
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'inv-' + (data.invoiceNumber ?? 'x'),
          invoiceNumber: data.invoiceNumber,
          unitId: data.unitId,
          residentId: data.residentId,
          amount: { toNumber: () => data.amount },
          dueDate: data.dueDate,
          type: data.type,
        })),
      },
      unitFee: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'fee-1', unitId: 'unit-1' },
          { id: 'fee-2', unitId: 'unit-1' },
        ]),
      },
    } as any;

    (mockPrisma.$transaction as jest.Mock).mockImplementationOnce(async (cb) =>
      cb(tx),
    );

    // Spy on invoice number generator to avoid timing issues
    jest
      .spyOn(service as any, 'generateInvoiceNumber')
      .mockResolvedValue('INV-99999');

    const result = await service.generateInvoice({
      unitId: 'unit-1',
      residentId: 'res-1',
      amount: 150,
      dueDate: new Date(),
      type: createdInvoice.type,
      sources: { unitFeeIds: ['fee-1', 'fee-2'] },
    } as any);

    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unitId: 'unit-1' }),
      }),
    );

    expect(tx.unitFee.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['fee-1', 'fee-2'] } },
        data: { invoiceId: result.id },
      }),
    );

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'invoice.created',
      expect.any(Object),
    );

    // Verify returned invoice contains expected fields and has a generated invoice number
    expect(result).toEqual(
      expect.objectContaining({
        unitId: 'unit-1',
        residentId: 'res-1',
        type: 'UTILITY',
        amount: expect.objectContaining({ toNumber: expect.any(Function) }),
      }),
    );

    expect(result.invoiceNumber).toMatch(/^INV-\d{5}$/);
    expect(result.id).toMatch(/^inv-/);
  });

  it('concurrent generateInvoice calls produce unique invoice numbers using InvoiceSequence', async () => {
    // Prepare a fresh fakeSeq and tx that will be used for each concurrent transaction
    const fakeSeq2 = { counter: BigInt(200) } as any;

    const txFactory = () =>
      ({
        invoiceSequence: {
          upsert: jest.fn().mockResolvedValue(fakeSeq2),
          update: jest.fn().mockImplementation(async ({ data }) => {
            // simulate atomic increment
            fakeSeq2.counter = BigInt(
              (fakeSeq2.counter as bigint) + BigInt(data.counter.increment),
            );
            return { counter: fakeSeq2.counter };
          }),
        },
        invoice: {
          create: jest.fn().mockImplementation(async ({ data }) => ({
            id: 'inv-' + (data.invoiceNumber ?? 'x'),
            invoiceNumber: data.invoiceNumber,
            unitId: data.unitId,
            residentId: data.residentId,
            amount: { toNumber: () => data.amount },
            dueDate: data.dueDate,
            type: data.type,
          })),
        },
        unitFee: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      }) as any;

    // For concurrency, ensure each call to $transaction uses a tx with shared fakeSeq2
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
      cb(txFactory()),
    );

    const parallel = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        service.generateInvoice({
          unitId: 'unit-1',
          residentId: 'res-1',
          amount: 100,
          dueDate: new Date(),
          type: 'UTILITY' as any,
          sources: { unitFeeIds: [] },
        } as any),
      ),
    );

    const numbers = parallel.map((r) => r.invoiceNumber);
    const unique = new Set(numbers);
    expect(unique.size).toBe(parallel.length);
  });

  it('markAsPaid should update the invoice and related Violation status when present', async () => {
    // findOne uses the outer prisma client - stub invoice.findUnique to return the invoice
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-10',
      status: 'PENDING',
      violationId: 'vio-10',
    });

    const tx = {
      invoice: {
        update: jest
          .fn()
          .mockResolvedValue({ id: 'inv-10', violationId: 'vio-10' }),
      },
      violation: { update: jest.fn().mockResolvedValue({}) },
    } as any;

    (mockPrisma.$transaction as jest.Mock).mockImplementationOnce(async (cb) =>
      cb(tx),
    );

    await service.markAsPaid('inv-10');

    expect(tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-10' },
        data: expect.objectContaining({
          status: expect.any(String),
          paidDate: expect.any(Date),
        }),
      }),
    );

    expect(tx.violation.update).toHaveBeenCalledWith({
      where: { id: 'vio-10' },
      data: { status: expect.any(String) },
    });
  });

  it('generateInvoice should validate provided unitFeeIds belong to the same unit and match unitId', async () => {
    const tx = {
      unitFee: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'fee-1', unitId: 'u1' },
          { id: 'fee-2', unitId: 'u2' },
        ]),
      },
    } as any;

    (mockPrisma.$transaction as jest.Mock).mockImplementationOnce(async (cb) =>
      cb(tx),
    );

    await expect(
      service.generateInvoice({
        unitId: 'u1',
        residentId: 'r1',
        amount: 100,
        dueDate: new Date(),
        type: 'UTILITY' as any,
        sources: { unitFeeIds: ['fee-1', 'fee-2'] },
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generateMonthlyUtilityInvoices should group unit fees and call generateInvoice per unit', async () => {
    // Mock fees returned (two units, one with two fees)
    (mockPrisma.unitFee as any) = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'fee-1',
          unitId: 'u1',
          amount: { toNumber: () => 10 },
          unit: { residents: [{ residentId: 'r1' }] },
        },
        {
          id: 'fee-2',
          unitId: 'u1',
          amount: { toNumber: () => 15 },
          unit: { residents: [{ residentId: 'r1' }] },
        },
        {
          id: 'fee-3',
          unitId: 'u2',
          amount: { toNumber: () => 20 },
          unit: { residents: [{ residentId: 'r2' }] },
        },
      ]),
    };

    const spy = jest
      .spyOn(service as any, 'generateInvoice')
      .mockResolvedValue({ id: 'inv-xx' } as any);

    const results = await service.generateMonthlyUtilityInvoices(new Date());

    expect(spy).toHaveBeenCalledTimes(2);
    expect(results.length).toBe(2);
  });

  it('findByResidentForActor should forbid invoice.view_own access to other users', async () => {
    await expect(
      service.findByResidentForActor('someone-else', {
        actorUserId: 'me',
        permissions: ['invoice.view_own'],
        roles: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findByResidentForActor should allow invoice.view_own access to self only', async () => {
    (mockPrisma.invoice.findMany as jest.Mock).mockResolvedValue([{ id: 'inv-1' }]);

    const result = await service.findByResidentForActor('me', {
      actorUserId: 'me',
      permissions: ['invoice.view_own'],
      roles: [],
    });

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { residentId: 'me' } }),
    );
    expect(result).toEqual([{ id: 'inv-1' }]);
  });

  it('findOneForActor should allow invoice.view_own when actor is residentId', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      unitId: 'u1',
      residentId: 'me',
      documents: [],
    });

    const result = await service.findOneForActor('inv-1', {
      actorUserId: 'me',
      permissions: ['invoice.view_own'],
      roles: [],
    });

    expect(result).toEqual(expect.objectContaining({ id: 'inv-1' }));
    expect(mockPrisma.unitAccess.findFirst).not.toHaveBeenCalled();
  });

  it('findOneForActor should allow invoice.view_own when actor has ACTIVE unit access', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-2',
      unitId: 'u2',
      residentId: 'someone-else',
      documents: [],
    });
    mockPrisma.unitAccess.findFirst.mockResolvedValue({
      id: 'ua-1',
      canViewFinancials: true,
    });

    const result = await service.findOneForActor('inv-2', {
      actorUserId: 'me',
      permissions: ['invoice.view_own'],
      roles: [],
    });

    expect(mockPrisma.unitAccess.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'me', unitId: 'u2', status: 'ACTIVE' }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'inv-2' }));
  });

  it('findOneForActor should forbid invoice.view_own without unit access', async () => {
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-3',
      unitId: 'u3',
      residentId: 'someone-else',
      documents: [],
    });
    mockPrisma.unitAccess.findFirst.mockResolvedValue(null);

    await expect(
      service.findOneForActor('inv-3', {
        actorUserId: 'me',
        permissions: ['invoice.view_own'],
        roles: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('findAllUnitFeesForActor should filter fees to ACTIVE unit access when using unit_fee.view_own', async () => {
    mockPrisma.unitAccess.findMany.mockResolvedValue([
      { unitId: 'u1' },
      { unitId: 'u2' },
      { unitId: 'u2' },
    ]);
    (mockPrisma.unitFee.findMany as jest.Mock).mockResolvedValue([
      { id: 'fee-1', unitId: 'u1' },
    ]);

    const result = await service.findAllUnitFeesForActor({
      actorUserId: 'me',
      permissions: ['unit_fee.view_own'],
      roles: [],
    });

    expect(mockPrisma.unitFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: { in: ['u1', 'u2'] } },
      }),
    );
    expect(result).toEqual([{ id: 'fee-1', unitId: 'u1' }]);
  });
});
