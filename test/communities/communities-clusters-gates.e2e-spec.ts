import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EntityStatus, GateRole } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { CommunitiesModule } from '../../src/modules/communities/communities.module';
import { GatesModule } from '../../src/modules/gates/gates.module';

describe('Communities + Clusters + Gates (e2e)', () => {
  let app: INestApplication;

  const clusters: Array<{
    id: string;
    communityId: string;
    name: string;
    code: string | null;
    displayOrder: number;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const gates: Array<{
    id: string;
    communityId: string;
    name: string;
    code: string | null;
    status: EntityStatus;
    allowedRoles: GateRole[];
    etaMinutes: number | null;
    isActive: boolean;
    isVisitorRequestRequired: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const mockPrismaService = {
    community: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'community-1',
        name: 'Community One',
        isActive: true,
      }),
    },
    cluster: {
      findMany: jest.fn().mockImplementation(({ where }: { where?: { communityId?: string } }) => {
        const items = clusters.filter(
          (item) =>
            (!where?.communityId || item.communityId === where.communityId) &&
            item.deletedAt === null &&
            item.isActive,
        );
        return Promise.resolve(
          items.map((item) => ({
            ...item,
            _count: { units: 0 },
          })),
        );
      }),
      create: jest.fn().mockImplementation(({ data }: { data: { communityId: string; name: string; code?: string | null; displayOrder: number } }) => {
        const now = new Date();
        const created = {
          id: `cluster-${clusters.length + 1}`,
          communityId: data.communityId,
          name: data.name,
          code: data.code ?? null,
          displayOrder: data.displayOrder,
          isActive: true,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        clusters.push(created);
        return Promise.resolve({
          ...created,
          _count: { units: 0 },
        });
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string; deletedAt?: null } }) => {
        const found = clusters.find(
          (item) => item.id === where.id && item.deletedAt === null,
        );
        return Promise.resolve(found ?? null);
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = clusters.findIndex((item) => item.id === where.id);
        if (index < 0) {
          return Promise.resolve(null);
        }
        clusters[index] = {
          ...clusters[index],
          ...(data as Partial<(typeof clusters)[number]>),
          updatedAt: new Date(),
        };
        return Promise.resolve({
          ...clusters[index],
          _count: { units: 0 },
        });
      }),
    },
    unit: {
      count: jest.fn().mockResolvedValue(0),
    },
    gate: {
      findMany: jest.fn().mockImplementation(({ where }: { where?: { communityId?: string; isActive?: boolean; deletedAt?: null } }) => {
        const items = gates.filter(
          (item) =>
            (!where?.communityId || item.communityId === where.communityId) &&
            (where?.isActive === undefined || item.isActive === where.isActive) &&
            (where?.deletedAt === undefined || item.deletedAt === null),
        );
        return Promise.resolve(
          items.map((item) => ({
            ...item,
            unitAccesses: [],
          })),
        );
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string; communityId?: string; deletedAt?: null } }) => {
        if (where.id) {
          const byId = gates.find((item) => item.id === where.id && item.deletedAt === null);
          return Promise.resolve(byId ? { ...byId, unitAccesses: [] } : null);
        }
        if (where.communityId) {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }: { data: { communityId: string; name: string; code?: string | null; allowedRoles: GateRole[]; etaMinutes: number | null; isVisitorRequestRequired: boolean; status: EntityStatus } }) => {
        const now = new Date();
        const created = {
          id: `gate-${gates.length + 1}`,
          communityId: data.communityId,
          name: data.name,
          code: data.code ?? null,
          status: data.status,
          allowedRoles: data.allowedRoles,
          etaMinutes: data.etaMinutes,
          isActive: true,
          isVisitorRequestRequired: data.isVisitorRequestRequired,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        gates.push(created);
        return Promise.resolve({ ...created, unitAccesses: [] });
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = gates.findIndex((item) => item.id === where.id);
        if (index < 0) {
          return Promise.resolve(null);
        }
        gates[index] = {
          ...gates[index],
          ...(data as Partial<(typeof gates)[number]>),
          updatedAt: new Date(),
        };
        return Promise.resolve({ ...gates[index], unitAccesses: [] });
      }),
    },
    gateUnitAccess: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn(),
    },
    accessQRCode: {
      count: jest.fn().mockResolvedValue(0),
    },
    gateEntryLog: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof mockPrismaService) => Promise<unknown>)(mockPrismaService);
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return Promise.resolve([]);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), CommunitiesModule, GatesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{
            user?: { id: string; roles: string[]; permissions: string[] };
          }>();
          req.user = {
            id: 'admin-1',
            roles: ['SUPER_ADMIN'],
            permissions: ['admin.view', 'admin.update', 'unit.view_all', 'unit.update', 'unit.create', 'gate.view_all', 'gate.create', 'gate.update', 'gate.delete'],
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

  it('Cluster CRUD + reorder flow', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/communities/community-1/clusters')
      .send({ name: 'Block A', code: 'A', displayOrder: 0 })
      .expect(201);
    expect(createResponse.body.name).toBe('Block A');

    const listResponse = await request(app.getHttpServer())
      .get('/communities/community-1/clusters')
      .expect(200);
    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body.length).toBeGreaterThan(0);

    const clusterId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .patch(`/clusters/${clusterId}`)
      .send({ name: 'Block A1', displayOrder: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/communities/community-1/clusters/reorder')
      .send({ orderedIds: [clusterId] })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/clusters/${clusterId}`)
      .expect(200);
  });

  it('Gate CRUD + roles flow', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/communities/community-1/gates')
      .send({
        name: 'Gate 1',
        code: 'G1',
        allowedRoles: [GateRole.VISITOR, GateRole.DELIVERY],
        etaMinutes: 2,
      })
      .expect(201);
    expect(createResponse.body.name).toBe('Gate 1');

    const gateId = createResponse.body.id as string;

    await request(app.getHttpServer())
      .get('/communities/community-1/gates')
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
      });

    await request(app.getHttpServer())
      .patch(`/gates/${gateId}`)
      .send({ name: 'Gate 1 Updated', etaMinutes: 3 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/gates/${gateId}/roles`)
      .send({ roles: [GateRole.VISITOR, GateRole.RIDESHARE] })
      .expect(200)
      .then((response) => {
        expect(response.body.allowedRoles).toContain(GateRole.RIDESHARE);
      });

    await request(app.getHttpServer()).delete(`/gates/${gateId}`).expect(200);
  });
});

