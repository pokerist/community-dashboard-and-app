import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AccessStatus, EntityStatus, GateRole, QRType } from '@prisma/client';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { GatesModule } from '../../src/modules/gates/gates.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';

describe('GatesModule (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    community: {
      findUnique: jest.fn().mockResolvedValue({ id: 'community-1' }),
    },
    gate: {
      findMany: jest.fn().mockImplementation(({ where }: { where?: { communityId?: string } }) => {
        if (where?.communityId === 'community-1') {
          return Promise.resolve([
            {
              id: 'gate-1',
              communityId: 'community-1',
              name: 'Gate 1',
              code: 'GATE_1',
              status: EntityStatus.ACTIVE,
              allowedRoles: [GateRole.VISITOR],
              etaMinutes: 2,
              isVisitorRequestRequired: false,
              createdAt: new Date('2026-03-05T10:00:00.000Z'),
              updatedAt: new Date('2026-03-05T10:00:00.000Z'),
              deletedAt: null,
              unitAccesses: [{ unitId: 'unit-1' }],
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string; communityId?: string } }) => {
        if (where.id === 'gate-1') {
          return Promise.resolve({
            id: 'gate-1',
            communityId: 'community-1',
            name: 'Gate 1',
            code: 'GATE_1',
            status: EntityStatus.ACTIVE,
            allowedRoles: [GateRole.VISITOR],
            etaMinutes: 2,
            isVisitorRequestRequired: false,
            createdAt: new Date('2026-03-05T10:00:00.000Z'),
            updatedAt: new Date('2026-03-05T10:00:00.000Z'),
            deletedAt: null,
            unitAccesses: [{ unitId: 'unit-1' }],
          });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue({
        id: 'gate-1',
        communityId: 'community-1',
        name: 'Gate 1',
        code: 'GATE_1',
        status: EntityStatus.ACTIVE,
        allowedRoles: [GateRole.VISITOR],
        etaMinutes: 2,
        isVisitorRequestRequired: false,
        createdAt: new Date('2026-03-05T10:00:00.000Z'),
        updatedAt: new Date('2026-03-05T10:00:00.000Z'),
        deletedAt: null,
        unitAccesses: [],
      }),
      update: jest.fn().mockResolvedValue({
        id: 'gate-1',
        communityId: 'community-1',
        name: 'Gate 1 Updated',
        code: 'GATE_1',
        status: EntityStatus.ACTIVE,
        allowedRoles: [GateRole.VISITOR, GateRole.DELIVERY],
        etaMinutes: 5,
        isVisitorRequestRequired: false,
        createdAt: new Date('2026-03-05T10:00:00.000Z'),
        updatedAt: new Date('2026-03-05T10:00:00.000Z'),
        deletedAt: null,
        unitAccesses: [{ unitId: 'unit-1' }],
      }),
      count: jest.fn().mockResolvedValue(1),
    },
    gateUnitAccess: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({ id: 'gua-1' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: 'unit-1' }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'unit-1',
          communityId: 'community-1',
          deletedAt: null,
          isActive: true,
        },
      ]),
    },
    accessQRCode: {
      count: jest.fn().mockImplementation(({ where }: { where?: { type?: QRType; checkedInAt?: unknown; checkedOutAt?: unknown } }) => {
        if (where?.type === QRType.VISITOR) return Promise.resolve(2);
        if (where?.type === QRType.DELIVERY) return Promise.resolve(1);
        if (where?.checkedInAt && where?.checkedOutAt === null) return Promise.resolve(3);
        return Promise.resolve(5);
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'qr-1',
          visitorName: 'John Visitor',
          requesterNameSnapshot: 'Ahmed Owner',
          type: QRType.VISITOR,
          status: AccessStatus.USED,
          checkedInAt: new Date('2026-03-05T10:00:00.000Z'),
          checkedOutAt: new Date('2026-03-05T11:00:00.000Z'),
          forUnit: { unitNumber: 'A-101' },
          gateOperator: { nameEN: 'Operator One', nameAR: null },
        },
      ]),
    },
    $transaction: jest.fn(),
  };

  beforeAll(async () => {
    mockPrismaService.$transaction.mockImplementation(
      async (
        callback: (tx: typeof mockPrismaService) => Promise<unknown>,
      ): Promise<unknown> => callback(mockPrismaService),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), GatesModule],
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
            permissions: [
              'gate.view_all',
              'gate.create',
              'gate.update',
              'gate.delete',
              'gate.logs.view',
            ],
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

  it('GET /gates lists gates by community', async () => {
    await request(app.getHttpServer())
      .get('/gates')
      .query({ communityId: 'community-1' })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body[0].id).toBe('gate-1');
      });
  });

  it('POST /gates creates gate', async () => {
    await request(app.getHttpServer())
      .post('/gates')
      .send({
        communityId: 'community-1',
        name: 'Gate 1',
        code: 'GATE_1',
        allowedRoles: [GateRole.VISITOR],
        etaMinutes: 2,
      })
      .expect(201)
      .then((response) => {
        expect(response.body.id).toBe('gate-1');
      });
  });

  it('PATCH /gates/:id updates gate', async () => {
    await request(app.getHttpServer())
      .patch('/gates/gate-1')
      .send({
        name: 'Gate 1 Updated',
        allowedRoles: [GateRole.VISITOR, GateRole.DELIVERY],
        etaMinutes: 5,
      })
      .expect(200)
      .then((response) => {
        expect(response.body.name).toBe('Gate 1 Updated');
      });
  });

  it('PATCH /gates/:id/roles updates roles', async () => {
    await request(app.getHttpServer())
      .patch('/gates/gate-1/roles')
      .send({ roles: [GateRole.VISITOR, GateRole.DELIVERY] })
      .expect(200)
      .then((response) => {
        expect(response.body.allowedRoles).toContain(GateRole.DELIVERY);
      });
  });

  it('GET /gates/:id/log returns paginated gate log', async () => {
    await request(app.getHttpServer())
      .get('/gates/gate-1/log')
      .expect(200)
      .then((response) => {
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data[0].id).toBe('qr-1');
      });
  });

  it('GET /gates/stats returns stats', async () => {
    await request(app.getHttpServer())
      .get('/gates/stats')
      .query({ communityId: 'community-1' })
      .expect(200)
      .then((response) => {
        expect(response.body.totalGates).toBe(1);
        expect(response.body.todayVisitors).toBe(2);
      });
  });

  it('DELETE /gates/:id soft deletes gate', async () => {
    mockPrismaService.accessQRCode.count.mockResolvedValueOnce(0);

    await request(app.getHttpServer())
      .delete('/gates/gate-1')
      .expect(200)
      .then((response) => {
        expect(response.body.success).toBe(true);
      });
  });
});
