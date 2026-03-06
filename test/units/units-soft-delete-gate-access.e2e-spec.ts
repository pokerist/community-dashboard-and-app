import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GateAccessMode, GateRole } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { UnitsModule } from '../../src/modules/units/units.module';

describe('Units soft delete + gate access (e2e)', () => {
  let app: INestApplication;

  let unitState = {
    id: 'unit-1',
    communityId: 'community-1',
    gateAccessMode: GateAccessMode.ALL_GATES,
    allowedGateIds: [] as string[],
    isActive: true,
    deletedAt: null as Date | null,
    unitNumber: 'A-100',
  };

  const mockPrismaService = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    unit: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id !== unitState.id) return Promise.resolve(null);
        return Promise.resolve({ ...unitState });
      }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Partial<typeof unitState> }) => {
        if (where.id !== unitState.id) return Promise.resolve(null);
        unitState = {
          ...unitState,
          ...data,
        };
        return Promise.resolve({ ...unitState });
      }),
      count: jest.fn(),
    },
    lease: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn(),
    },
    gate: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id?: { in: string[] }; communityId?: string } }) => {
        const all = [
          {
            id: 'gate-1',
            name: 'Gate 1',
            code: 'G1',
            allowedRoles: [GateRole.VISITOR],
            etaMinutes: 2,
            isActive: true,
            communityId: 'community-1',
            deletedAt: null,
          },
          {
            id: 'gate-2',
            name: 'Gate 2',
            code: 'G2',
            allowedRoles: [GateRole.RESIDENT],
            etaMinutes: 3,
            isActive: true,
            communityId: 'community-1',
            deletedAt: null,
          },
        ];
        const filtered = all.filter((item) => {
          const matchesCommunity = !where.communityId || item.communityId === where.communityId;
          const matchesIds = !where.id?.in || where.id.in.includes(item.id);
          return matchesCommunity && matchesIds;
        });
        return Promise.resolve(filtered);
      }),
    },
    userStatusLog: {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), UnitsModule],
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
            permissions: ['unit.view_all', 'unit.update', 'unit.delete', 'admin.update'],
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

  it('deactivates unit via soft delete and can reactivate', async () => {
    await request(app.getHttpServer())
      .delete('/units/unit-1')
      .send({ reason: 'archive' })
      .expect(200);

    expect(unitState.isActive).toBe(false);
    expect(unitState.deletedAt).toBeTruthy();

    await request(app.getHttpServer()).post('/units/unit-1/reactivate').expect(200);

    expect(unitState.isActive).toBe(true);
    expect(unitState.deletedAt).toBeNull();
  });

  it('reads and updates unit gate access', async () => {
    await request(app.getHttpServer())
      .get('/units/unit-1/gate-access')
      .expect(200)
      .then((response) => {
        expect(response.body.mode).toBe(GateAccessMode.ALL_GATES);
      });

    await request(app.getHttpServer())
      .patch('/units/unit-1/gate-access')
      .send({
        mode: GateAccessMode.SELECTED_GATES,
        allowedGateIds: ['gate-1'],
      })
      .expect(200)
      .then((response) => {
        expect(response.body.mode).toBe(GateAccessMode.SELECTED_GATES);
        expect(Array.isArray(response.body.gates)).toBe(true);
        expect(response.body.gates[0].id).toBe('gate-1');
      });
  });
});

