import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  BlueCollarWeekDay,
  CompoundStaffPermission,
  CompoundStaffStatus,
  GateDirection,
} from '@prisma/client';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { CompoundStaffModule } from '../../src/modules/compound-staff/compound-staff.module';

describe('CompoundStaffModule (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    community: {
      findUnique: jest.fn().mockResolvedValue({ id: 'community-1', isActive: true }),
    },
    commercialEntity: {
      findFirst: jest.fn().mockResolvedValue({ id: 'entity-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }),
    },
    file: {
      findUnique: jest.fn().mockResolvedValue({ id: 'file-1' }),
    },
    gate: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'gate-1', communityId: 'community-1', status: 'ACTIVE' },
      ]),
    },
    compoundStaff: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'staff-1',
          communityId: 'community-1',
          commercialEntityId: 'entity-1',
          userId: 'user-1',
          fullName: 'Mahmoud Salah',
          phone: '01020000003',
          nationalId: '29801011234567',
          photoFileId: 'file-1',
          profession: 'Security',
          jobTitle: 'Gate Security Officer',
          workSchedule: null,
          contractFrom: null,
          contractTo: null,
          status: CompoundStaffStatus.ACTIVE,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          accesses: [],
          schedules: [],
          gateAccesses: [],
          activityLogs: [],
        },
      ]),
      findFirst: jest.fn().mockImplementation(
        ({ where }: { where?: { id?: string | { not?: string } } }) => {
          if (typeof where?.id === 'string') {
            return Promise.resolve({
              id: 'staff-1',
              communityId: 'community-1',
              commercialEntityId: 'entity-1',
              userId: 'user-1',
              fullName: 'Mahmoud Salah',
              phone: '01020000003',
              nationalId: '29801011234567',
              photoFileId: 'file-1',
              profession: 'Security',
              jobTitle: 'Gate Security Officer',
              workSchedule: null,
              contractFrom: null,
              contractTo: null,
              status: CompoundStaffStatus.ACTIVE,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              accesses: [],
              schedules: [],
              gateAccesses: [],
              activityLogs: [],
            });
          }
          return Promise.resolve(null);
        },
      ),
      findUnique: jest.fn().mockImplementation(
        ({ include }: { include?: unknown }) => {
          if (include) {
            return Promise.resolve({
              id: 'staff-1',
              communityId: 'community-1',
              commercialEntityId: 'entity-1',
              userId: 'user-1',
              fullName: 'Mahmoud Salah',
              phone: '01020000003',
              nationalId: '29801011234567',
              photoFileId: 'file-1',
              profession: 'Security',
              jobTitle: 'Gate Security Officer',
              workSchedule: null,
              contractFrom: null,
              contractTo: null,
              status: CompoundStaffStatus.ACTIVE,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
              accesses: [],
              schedules: [],
              gateAccesses: [],
              activityLogs: [],
            });
          }

          return Promise.resolve({
            id: 'staff-1',
            communityId: 'community-1',
            commercialEntityId: 'entity-1',
            nationalId: '29801011234567',
            contractFrom: null,
            contractTo: null,
            status: CompoundStaffStatus.ACTIVE,
            isActive: true,
            deletedAt: null,
          });
        },
      ),
      create: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      update: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
    compoundStaffAccess: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'access-1',
          staffId: 'staff-1',
          permission: CompoundStaffPermission.ENTRY_EXIT,
          isGranted: true,
          grantedById: 'admin-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({ id: 'access-1' }),
    },
    compoundStaffSchedule: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'schedule-1',
          staffId: 'staff-1',
          dayOfWeek: BlueCollarWeekDay.SUNDAY,
          startTime: '08:00',
          endTime: '16:00',
          notes: 'Morning shift',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({ id: 'schedule-1' }),
    },
    compoundStaffGateAccess: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'gate-access-1',
          staffId: 'staff-1',
          gateId: 'gate-1',
          directions: [GateDirection.ENTRY, GateDirection.EXIT],
          isActive: true,
          grantedById: 'admin-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          gate: { id: 'gate-1', name: 'Main Gate' },
        },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({ id: 'gate-access-1' }),
    },
    compoundStaffActivityLog: {
      create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'activity-1',
          staffId: 'staff-1',
          actorUserId: 'admin-1',
          action: 'STAFF_CREATED',
          metadata: null,
          createdAt: new Date(),
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
      imports: [EventEmitterModule.forRoot(), CompoundStaffModule],
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
              'compound_staff.view_all',
              'compound_staff.create',
              'compound_staff.update',
              'compound_staff.delete',
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

  it('POST /compound-staff creates a profile', async () => {
    await request(app.getHttpServer())
      .post('/compound-staff')
      .send({
        communityId: 'community-1',
        commercialEntityId: 'entity-1',
        userId: 'user-1',
        fullName: 'Mahmoud Salah',
        phone: '01020000003',
        nationalId: '29801011234567',
        photoFileId: 'file-1',
        profession: 'Security',
        jobTitle: 'Gate Security Officer',
        permissions: [CompoundStaffPermission.ENTRY_EXIT],
        schedules: [
          {
            dayOfWeek: BlueCollarWeekDay.SUNDAY,
            startTime: '08:00',
            endTime: '16:00',
          },
        ],
        gateAccesses: [
          {
            gateId: 'gate-1',
            directions: [GateDirection.ENTRY, GateDirection.EXIT],
          },
        ],
      })
      .expect(201)
      .then((response) => {
        expect(response.body.id).toBe('staff-1');
      });
  });

  it('GET /compound-staff returns list', async () => {
    await request(app.getHttpServer())
      .get('/compound-staff')
      .query({ status: 'ACTIVE' })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('GET /compound-staff/:id returns detail profile', async () => {
    await request(app.getHttpServer())
      .get('/compound-staff/staff-1')
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('staff-1');
        expect(response.body.fullName).toBe('Mahmoud Salah');
      });
  });

  it('PATCH /compound-staff/:id updates profile', async () => {
    await request(app.getHttpServer())
      .patch('/compound-staff/staff-1')
      .send({
        jobTitle: 'Senior Gate Officer',
        profession: 'Security',
      })
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('staff-1');
      });
  });

  it('GET /compound-staff/:id/access returns permissions', async () => {
    await request(app.getHttpServer())
      .get('/compound-staff/staff-1/access')
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('PUT /compound-staff/:id/access updates permissions', async () => {
    await request(app.getHttpServer())
      .put('/compound-staff/staff-1/access')
      .send({
        permissions: [CompoundStaffPermission.ENTRY_EXIT, CompoundStaffPermission.ATTENDANCE],
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('GET /compound-staff/:id/gates returns assigned gates', async () => {
    await request(app.getHttpServer())
      .get('/compound-staff/staff-1/gates')
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('PUT /compound-staff/:id/gates updates gate access', async () => {
    await request(app.getHttpServer())
      .put('/compound-staff/staff-1/gates')
      .send({
        gateAccesses: [
          {
            gateId: 'gate-1',
            directions: [GateDirection.ENTRY, GateDirection.EXIT],
          },
        ],
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('GET /compound-staff/:id/activity-logs returns activity logs', async () => {
    await request(app.getHttpServer())
      .get('/compound-staff/staff-1/activity-logs')
      .query({ limit: 20 })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body[0].id).toBe('activity-1');
      });
  });

  it('DELETE /compound-staff/:id soft deletes profile', async () => {
    await request(app.getHttpServer())
      .delete('/compound-staff/staff-1')
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual({ success: true });
      });
  });
});
