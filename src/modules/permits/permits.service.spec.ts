import { BadRequestException } from '@nestjs/common';
import {
  PermitCategory,
  PermitStatus,
  ServiceFieldType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PermitsService } from './permits.service';

describe('PermitsService', () => {
  const makeDetail = (id: string) => ({
    id,
    requestNumber: `PRM-${id}`,
    status: PermitStatus.PENDING,
    notes: null,
    rejectionReason: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    permitType: {
      id: 'pt-1',
      name: 'Worker Permit',
      slug: 'worker-permit',
      category: PermitCategory.OPERATIONAL,
      description: null,
      isActive: true,
      displayOrder: 1,
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    unit: {
      id: 'unit-1',
      unitNumber: '101',
      block: 'A',
    },
    requester: {
      id: 'user-1',
      name: 'Resident',
      phone: null,
    },
    reviewer: null,
    fieldValues: [],
  });

  const mockPrisma = {
    unit: {
      findUnique: jest.fn(),
    },
    unitAccess: {
      findFirst: jest.fn(),
    },
    permitType: {
      findUnique: jest.fn(),
    },
    permitRequest: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: PermitsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PermitsService(mockPrisma as unknown as PrismaService);
  });

  it('validates required dynamic fields when creating permit requests', async () => {
    mockPrisma.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    mockPrisma.unitAccess.findFirst.mockResolvedValue({
      id: 'ua-1',
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 1000),
      endsAt: null,
    });
    mockPrisma.permitType.findUnique.mockResolvedValue({
      id: 'pt-1',
      isActive: true,
      fields: [
        {
          id: 'field-1',
          permitTypeId: 'pt-1',
          label: 'Worker Name',
          type: ServiceFieldType.TEXT,
          required: true,
          placeholder: null,
          displayOrder: 1,
        },
      ],
    });

    await expect(
      service.createPermitRequest('user-1', {
        permitTypeId: 'pt-1',
        unitId: 'unit-1',
        fieldValues: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates sequential request numbers', async () => {
    mockPrisma.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    mockPrisma.unitAccess.findFirst.mockResolvedValue({
      id: 'ua-1',
      status: 'ACTIVE',
      startsAt: new Date(Date.now() - 1000),
      endsAt: null,
    });
    mockPrisma.permitType.findUnique.mockResolvedValue({
      id: 'pt-1',
      isActive: true,
      fields: [
        {
          id: 'field-1',
          permitTypeId: 'pt-1',
          label: 'Worker Name',
          type: ServiceFieldType.TEXT,
          required: true,
          placeholder: null,
          displayOrder: 1,
        },
      ],
    });

    let sequenceCounter = BigInt(0);
    const createdRequests: Array<{ id: string; requestNumber: string }> = [];

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<string>) => {
        const tx = {
          permitRequestSequence: {
            upsert: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockImplementation(async () => {
              sequenceCounter += BigInt(1);
              return { counter: sequenceCounter };
            }),
          },
          permitRequest: {
            create: jest
              .fn()
              .mockImplementation(
                async (params: { data: { requestNumber: string } }) => {
                  const id = `request-${createdRequests.length + 1}`;
                  createdRequests.push({
                    id,
                    requestNumber: params.data.requestNumber,
                  });
                  return { id };
                },
              ),
          },
          permitRequestFieldValue: {
            createMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };

        return callback(tx);
      },
    );

    jest
      .spyOn(service, 'getPermitRequestDetail')
      .mockImplementation(async (id: string) => makeDetail(id));

    await service.createPermitRequest('user-1', {
      permitTypeId: 'pt-1',
      unitId: 'unit-1',
      fieldValues: [{ fieldId: 'field-1', value: 'John' }],
    });

    await service.createPermitRequest('user-1', {
      permitTypeId: 'pt-1',
      unitId: 'unit-1',
      fieldValues: [{ fieldId: 'field-1', value: 'Mark' }],
    });

    expect(createdRequests[0]?.requestNumber).toBe('PRM-000001');
    expect(createdRequests[1]?.requestNumber).toBe('PRM-000002');
  });

  it('returns category and status stats with all enum keys', async () => {
    const thisMonth = new Date();
    mockPrisma.permitRequest.findMany.mockResolvedValue([
      {
        status: PermitStatus.PENDING,
        reviewedAt: null,
        permitType: { category: PermitCategory.ACCOUNT_INFO },
      },
      {
        status: PermitStatus.APPROVED,
        reviewedAt: thisMonth,
        permitType: { category: PermitCategory.OPERATIONAL },
      },
      {
        status: PermitStatus.REJECTED,
        reviewedAt: thisMonth,
        permitType: { category: PermitCategory.OPERATIONAL },
      },
    ]);

    const stats = await service.getPermitStats();

    expect(stats.totalRequests).toBe(3);
    expect(stats.requestsByCategory).toEqual({
      ACCOUNT_INFO: 1,
      LEGAL_OWNERSHIP: 0,
      UTILITIES_SERVICES: 0,
      COMMUNITY_ACTIVITIES: 0,
      OPERATIONAL: 2,
    });
    expect(stats.requestsByStatus).toEqual({
      PENDING: 1,
      APPROVED: 1,
      REJECTED: 1,
    });
  });
});
