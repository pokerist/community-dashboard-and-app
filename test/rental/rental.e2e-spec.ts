import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AccessStatus,
  LeaseStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { RentalModule } from '../../src/modules/rental/rental.module';

type LeaseRecord = {
  id: string;
  unitId: string;
  ownerId: string;
  tenantId: string | null;
  tenantEmail: string | null;
  tenantNationalId: string | null;
  startDate: Date;
  endDate: Date;
  monthlyRent: Prisma.Decimal;
  securityDeposit: Prisma.Decimal | null;
  status: LeaseStatus;
  source: 'OWNER' | 'COMPOUND';
  renewedFromId: string | null;
  renewedToId: string | null;
  autoRenew: boolean;
  renewalNoticeSentAt: Date | null;
};

describe('RentalModule (e2e)', () => {
  let app: INestApplication;

  const leases: Record<string, LeaseRecord> = {
    'lease-1': {
      id: 'lease-1',
      unitId: 'unit-1',
      ownerId: 'owner-1',
      tenantId: 'tenant-1',
      tenantEmail: 'tenant@example.com',
      tenantNationalId: '29801',
      startDate: new Date('2025-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      monthlyRent: new Prisma.Decimal(10000),
      securityDeposit: new Prisma.Decimal(3000),
      status: LeaseStatus.ACTIVE,
      source: 'OWNER',
      renewedFromId: null,
      renewedToId: null,
      autoRenew: false,
      renewalNoticeSentAt: null,
    },
  };

  let rentalSettings = {
    leasingEnabled: true,
    suspensionReason: null as string | null,
    suspendedAt: null as string | null,
    suspendedById: null as string | null,
  };

  const buildLeaseInclude = (id: string) => {
    const row = leases[id];
    if (!row) return null;
    return {
      ...row,
      unit: {
        id: row.unitId,
        unitNumber: 'A-101',
        projectName: 'Project',
        community: { name: 'Community One' },
      },
      owner: {
        id: row.ownerId,
        nameEN: 'Owner Name',
        email: 'owner@example.com',
        phone: '+201000000001',
      },
      tenant: row.tenantId
        ? {
            id: row.tenantId,
            nameEN: 'Tenant Name',
            email: 'tenant@example.com',
            phone: '+201000000002',
          }
        : null,
    };
  };

  const mockPrismaService = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    systemSetting: {
      findUnique: jest.fn().mockImplementation(() =>
        Promise.resolve({ value: { ...rentalSettings } }),
      ),
      upsert: jest.fn().mockImplementation(({ create, update }: { create: { value: unknown }; update: { value: unknown } }) => {
        const next = (update?.value ?? create.value) as {
          leasingEnabled: boolean;
          suspensionReason: string | null;
          suspendedAt: string | null;
          suspendedById: string | null;
        };
        rentalSettings = { ...next };
        return Promise.resolve({
          section: 'rental_settings',
          value: next,
          updatedAt: new Date(),
          updatedById: next.suspendedById,
        });
      }),
    },
    lease: {
      findUnique: jest.fn().mockImplementation(({ where, select, include }: {
        where: { id: string };
        select?: Record<string, boolean>;
        include?: Record<string, unknown>;
      }) => {
        const row = leases[where.id];
        if (!row) return Promise.resolve(null);
        if (include) {
          return Promise.resolve(buildLeaseInclude(where.id));
        }
        if (select) {
          const selected: Record<string, unknown> = {};
          Object.keys(select).forEach((key) => {
            selected[key] = (row as unknown as Record<string, unknown>)[key] ?? null;
          });
          return Promise.resolve(selected);
        }
        return Promise.resolve(row);
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockResolvedValue({ _sum: { monthlyRent: new Prisma.Decimal(10000) } }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const id = 'lease-2';
        leases[id] = {
          id,
          unitId: String(data.unitId),
          ownerId: String(data.ownerId),
          tenantId: (data.tenantId as string | null) ?? null,
          tenantEmail: (data.tenantEmail as string | null) ?? null,
          tenantNationalId: (data.tenantNationalId as string | null) ?? null,
          startDate: data.startDate as Date,
          endDate: data.endDate as Date,
          monthlyRent: data.monthlyRent as Prisma.Decimal,
          securityDeposit: (data.securityDeposit as Prisma.Decimal | null) ?? null,
          status: data.status as LeaseStatus,
          source: data.source as 'OWNER' | 'COMPOUND',
          renewedFromId: (data.renewedFromId as string | null) ?? null,
          renewedToId: null,
          autoRenew: Boolean(data.autoRenew),
          renewalNoticeSentAt: null,
        };
        return Promise.resolve({ id });
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const current = leases[where.id];
        if (!current) return Promise.resolve(null);
        leases[where.id] = {
          ...current,
          ...(data as Partial<LeaseRecord>),
        };
        return Promise.resolve(leases[where.id]);
      }),
    },
    unitAccess: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'ua-1', status: AccessStatus.ACTIVE }),
    },
    unit: {
      update: jest.fn().mockResolvedValue({ id: 'unit-1' }),
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    rentRequest: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    admin: {
      findUnique: jest.fn().mockResolvedValue({ id: 'admin-row' }),
    },
    community: {
      findUnique: jest.fn().mockResolvedValue({ id: 'community-1' }),
    },
    file: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    resident: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({ id: 'tenant-row' }),
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(
      async (
        callback: (tx: typeof mockPrismaService) => Promise<unknown>,
      ): Promise<unknown> => callback(mockPrismaService),
    ),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), RentalModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ user?: { id: string; roles: string[]; permissions: string[] } }>();
          req.user = {
            id: 'admin-1',
            roles: ['SUPER_ADMIN'],
            permissions: ['admin.view', 'admin.update'],
          };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('PATCH /rental/settings/toggle updates leasing state', async () => {
    await request(app.getHttpServer())
      .patch('/rental/settings/toggle')
      .send({ enabled: false, reason: 'Maintenance window' })
      .expect(200)
      .then((response) => {
        expect(response.body.leasingEnabled).toBe(false);
        expect(response.body.suspensionReason).toBe('Maintenance window');
      });
  });

  it('POST /rental/leases/:id/renew creates renewal chain', async () => {
    await request(app.getHttpServer())
      .post('/rental/leases/lease-1/renew')
      .send({
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2027-03-31T00:00:00.000Z',
        monthlyRent: 12000,
        autoRenew: true,
      })
      .expect(201)
      .then((response) => {
        expect(response.body.id).toBe('lease-2');
        expect(response.body.renewedFrom.id).toBe('lease-1');
      });
  });

  it('POST /rental/leases/:id/terminate terminates lease and revokes access', async () => {
    await request(app.getHttpServer())
      .post('/rental/leases/lease-2/terminate')
      .send({ reason: 'Lease violation' })
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe(LeaseStatus.TERMINATED);
      });
  });
});

