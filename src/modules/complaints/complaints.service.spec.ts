import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, Priority } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplaintsService } from './complaints.service';

type MockFn<TArgs extends unknown[] = unknown[], TResult = unknown> = jest.Mock<
  Promise<TResult>,
  TArgs
>;

interface ComplaintCreateDataCapture {
  slaDeadline: Date | null | undefined;
  categoryLegacy: string | null | undefined;
}

describe('ComplaintsService', () => {
  let service: ComplaintsService;

  let capturedCreateData: ComplaintCreateDataCapture | null = null;

  const mockPrisma = {
    unit: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    complaintCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    complaintComment: {
      create: jest.fn(),
    },
    complaint: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ComplaintsService>(ComplaintsService);

    capturedCreateData = null;
    jest.clearAllMocks();
  });

  it('sets slaDeadline from category.slaHours when creating a complaint', async () => {
    mockPrisma.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    mockPrisma.complaintCategory.findUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'Maintenance',
      slaHours: 24,
      description: null,
      isActive: true,
      displayOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.complaint.findFirst.mockResolvedValue({ complaintNumber: 'CMP-00010' });

    mockPrisma.complaint.create.mockImplementation(
      async (input: { data: { slaDeadline?: Date | null; categoryLegacy?: string | null } }) => {
        capturedCreateData = {
          slaDeadline: input.data.slaDeadline,
          categoryLegacy: input.data.categoryLegacy,
        };
        return { id: 'complaint-1' };
      },
    );

    mockPrisma.complaint.findUnique.mockImplementation(async () => ({
      id: 'complaint-1',
      complaintNumber: 'CMP-00011',
      title: 'Water Leak',
      description: 'Water leak in corridor',
      priority: Priority.MEDIUM,
      status: ComplaintStatus.NEW,
      categoryId: 'cat-1',
      categoryLegacy: 'Maintenance',
      unitId: 'unit-1',
      reporterId: 'user-1',
      assignedToId: null,
      resolutionNotes: null,
      resolvedAt: null,
      closedAt: null,
      slaDeadline: capturedCreateData?.slaDeadline ?? null,
      slaBreachedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      category: { id: 'cat-1', name: 'Maintenance', slaHours: 24 },
      unit: { id: 'unit-1', unitNumber: 'A-101' },
      reporter: {
        id: 'user-1',
        nameEN: 'Reporter User',
        nameAR: null,
        phone: null,
        email: 'reporter@example.com',
      },
      assignedTo: null,
      comments: [],
      invoices: [],
    }));

    const before = Date.now();
    await service.createComplaint(
      {
        unitId: 'unit-1',
        categoryId: 'cat-1',
        title: 'Water Leak',
        description: 'Water leak in corridor',
      },
      'user-1',
    );
    const after = Date.now();

    expect(capturedCreateData).not.toBeNull();
    expect(capturedCreateData?.categoryLegacy).toBe('Maintenance');
    expect(capturedCreateData?.slaDeadline).toBeInstanceOf(Date);
    const deadlineMs = capturedCreateData?.slaDeadline?.getTime() ?? 0;
    const lowerBound = before + 24 * 60 * 60 * 1000;
    const upperBound = after + 24 * 60 * 60 * 1000 + 1000;
    expect(deadlineMs).toBeGreaterThanOrEqual(lowerBound);
    expect(deadlineMs).toBeLessThanOrEqual(upperBound);
  });

  it('rejects NEW -> IN_PROGRESS transition without assignee', async () => {
    mockPrisma.complaint.findUnique.mockResolvedValue({
      id: 'complaint-1',
      status: ComplaintStatus.NEW,
      assignedToId: null,
      resolvedAt: null,
    });

    await expect(
      service.updateStatus('complaint-1', ComplaintStatus.IN_PROGRESS),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.complaint.update).not.toHaveBeenCalled();
  });

  it('rejects IN_PROGRESS -> RESOLVED transition without resolutionNotes', async () => {
    mockPrisma.complaint.findUnique.mockResolvedValue({
      id: 'complaint-1',
      status: ComplaintStatus.IN_PROGRESS,
      assignedToId: 'assignee-1',
      resolvedAt: null,
    });

    await expect(
      service.updateStatus('complaint-1', ComplaintStatus.RESOLVED),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.complaint.update).not.toHaveBeenCalled();
  });

  it('checkSlaBreaches is idempotent on repeated runs', async () => {
    (mockPrisma.complaint.updateMany as MockFn<[{ where: unknown; data: unknown }], { count: number }>)
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await service.checkSlaBreaches();
    const second = await service.checkSlaBreaches();

    expect(first.breachCount).toBe(2);
    expect(second.breachCount).toBe(0);
    expect(mockPrisma.complaint.updateMany).toHaveBeenCalledTimes(2);
  });
});
