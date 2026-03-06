import { Test, TestingModule } from '@nestjs/testing';
import { LeaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RentRequestsService } from '../rent-requests/rent-requests.service';
import { RentalService } from './rental.service';

describe('RentalService', () => {
  let service: RentalService;

  const prismaMock = {
    systemSetting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    lease: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    rentRequest: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const rentRequestsServiceMock = {
    review: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentalService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RentRequestsService,
          useValue: rentRequestsServiceMock,
        },
      ],
    }).compile();

    service = module.get<RentalService>(RentalService);
  });

  it('calculates daysUntilExpiry for active leases', () => {
    const now = new Date('2026-03-06T00:00:00.000Z');
    const end = new Date('2026-03-16T00:00:00.000Z');
    const result = service.calculateDaysUntilExpiry(end, LeaseStatus.ACTIVE, now);
    expect(result).toBe(10);
  });

  it('returns null daysUntilExpiry for non-active leases', () => {
    const now = new Date('2026-03-06T00:00:00.000Z');
    const end = new Date('2026-03-16T00:00:00.000Z');
    const result = service.calculateDaysUntilExpiry(end, LeaseStatus.EXPIRED, now);
    expect(result).toBeNull();
  });

  it('creates renewal chain links between previous and new lease', async () => {
    prismaMock.lease.findUnique.mockResolvedValueOnce({
      id: 'lease-old',
      unitId: 'unit-1',
      ownerId: 'owner-1',
      tenantId: 'tenant-1',
      tenantEmail: 'tenant@example.com',
      tenantNationalId: '2990',
      securityDeposit: new Prisma.Decimal(3000),
      source: 'OWNER',
      status: LeaseStatus.ACTIVE,
      renewedToId: null,
    });
    prismaMock.lease.findFirst.mockResolvedValue(null);

    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          lease: {
            create: jest.fn().mockResolvedValue({ id: 'lease-new' }),
            update: jest.fn().mockResolvedValue({ id: 'lease-old' }),
          },
          unitAccess: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            create: jest.fn(),
          },
          unit: {
            update: jest.fn().mockResolvedValue({ id: 'unit-1' }),
          },
        }),
    );

    jest.spyOn(service, 'getLeaseDetail').mockResolvedValue({
      id: 'lease-new',
      status: LeaseStatus.ACTIVE,
      source: 'OWNER',
      startDate: '2026-03-07T00:00:00.000Z',
      endDate: '2027-03-06T00:00:00.000Z',
      monthlyRent: 10000,
      securityDeposit: 3000,
      autoRenew: true,
      renewalNoticeSentAt: null,
      unit: {
        id: 'unit-1',
        unitNumber: 'A-101',
        projectName: 'Project',
        communityName: 'Community',
      },
      owner: { id: 'owner-1', name: 'Owner', email: null, phone: null },
      tenant: { id: 'tenant-1', name: 'Tenant', email: null, phone: null },
      renewedFrom: {
        id: 'lease-old',
        startDate: '2025-03-07T00:00:00.000Z',
        endDate: '2026-03-06T00:00:00.000Z',
        status: LeaseStatus.EXPIRED,
      },
      renewedTo: null,
      renewalChain: [],
      invoiceHistory: [],
    });

    const result = await service.renewLease(
      'lease-old',
      {
        startDate: '2026-03-07T00:00:00.000Z',
        endDate: '2027-03-06T00:00:00.000Z',
        monthlyRent: 10000,
        autoRenew: true,
      },
      'admin-1',
    );

    expect(result.id).toBe('lease-new');
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

