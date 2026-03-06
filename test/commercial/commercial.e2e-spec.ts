import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CommercialEntityMemberRole } from '@prisma/client';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CommercialModule } from '../../src/modules/commercial/commercial.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';

describe('CommercialModule (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    community: {
      findUnique: jest.fn().mockResolvedValue({ id: 'community-1', isActive: true }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'owner-1' }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'unit-1',
        communityId: 'community-1',
        isActive: true,
        deletedAt: null,
      }),
    },
    commercialEntity: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'entity-1',
          name: 'Starbucks',
          description: null,
          communityId: 'community-1',
          unitId: 'unit-1',
          isActive: true,
          createdAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-05T10:00:00.000Z'),
          members: [
            {
              id: 'member-owner-1',
              entityId: 'entity-1',
              userId: 'owner-1',
              role: CommercialEntityMemberRole.OWNER,
              permissions: {
                can_work_orders: true,
                can_attendance: true,
                can_service_requests: true,
                can_tickets: true,
                can_photo_upload: true,
                can_task_reminders: true,
              },
              createdById: 'admin-1',
              isActive: true,
              createdAt: new Date('2026-03-05T10:00:00.000Z'),
              updatedAt: new Date('2026-03-05T10:00:00.000Z'),
            },
          ],
        },
      ]),
      findFirst: jest.fn().mockImplementation(
        ({ where }: { where?: { id?: string | { not?: string } } }) => {
          if (typeof where?.id === 'string') {
            return Promise.resolve({
              id: 'entity-1',
              name: 'Starbucks',
              description: null,
              communityId: 'community-1',
              unitId: 'unit-1',
              isActive: true,
              createdAt: new Date('2026-03-05T10:00:00.000Z'),
              updatedAt: new Date('2026-03-05T10:00:00.000Z'),
              members: [
                {
                  id: 'member-owner-1',
                  entityId: 'entity-1',
                  userId: 'owner-1',
                  role: CommercialEntityMemberRole.OWNER,
                  permissions: {
                    can_work_orders: true,
                    can_attendance: true,
                    can_service_requests: true,
                    can_tickets: true,
                    can_photo_upload: true,
                    can_task_reminders: true,
                  },
                  createdById: 'admin-1',
                  isActive: true,
                  createdAt: new Date('2026-03-05T10:00:00.000Z'),
                  updatedAt: new Date('2026-03-05T10:00:00.000Z'),
                },
              ],
            });
          }
          return Promise.resolve(null);
        },
      ),
      findUnique: jest.fn().mockResolvedValue({
        id: 'entity-1',
        name: 'Starbucks',
        communityId: 'community-1',
        unitId: 'unit-1',
        isActive: true,
        deletedAt: null,
        members: [
          {
            id: 'member-owner-1',
            entityId: 'entity-1',
            userId: 'owner-1',
            role: CommercialEntityMemberRole.OWNER,
            permissions: {
              can_work_orders: true,
              can_attendance: true,
              can_service_requests: true,
              can_tickets: true,
              can_photo_upload: true,
              can_task_reminders: true,
            },
            createdById: 'admin-1',
            isActive: true,
            createdAt: new Date('2026-03-05T10:00:00.000Z'),
            updatedAt: new Date('2026-03-05T10:00:00.000Z'),
          },
        ],
      }),
      create: jest.fn().mockResolvedValue({
        id: 'entity-1',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'entity-1',
        name: 'Starbucks',
        description: null,
        communityId: 'community-1',
        unitId: 'unit-1',
        isActive: true,
        createdAt: new Date('2026-03-05T10:00:00.000Z'),
        updatedAt: new Date('2026-03-05T10:00:00.000Z'),
        members: [],
      }),
    },
    commercialEntityMember: {
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue({
        id: 'member-owner-1',
      }),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'member-owner-1',
          entityId: 'entity-1',
          userId: 'owner-1',
          role: CommercialEntityMemberRole.OWNER,
          permissions: {
            can_work_orders: true,
            can_attendance: true,
            can_service_requests: true,
            can_tickets: true,
            can_photo_upload: true,
            can_task_reminders: true,
          },
          createdById: 'admin-1',
          isActive: true,
          createdAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-05T10:00:00.000Z'),
          deletedAt: null,
        },
      ]),
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 'member-owner-1',
          entityId: 'entity-1',
          userId: 'owner-1',
          role: CommercialEntityMemberRole.OWNER,
          permissions: {
            can_work_orders: true,
            can_attendance: true,
            can_service_requests: true,
            can_tickets: true,
            can_photo_upload: true,
            can_task_reminders: true,
          },
          createdById: 'admin-1',
          isActive: true,
          createdAt: new Date('2026-03-05T10:00:00.000Z'),
          updatedAt: new Date('2026-03-05T10:00:00.000Z'),
          deletedAt: null,
        }),
      update: jest.fn().mockResolvedValue({
        id: 'member-owner-1',
        entityId: 'entity-1',
        userId: 'owner-1',
        role: CommercialEntityMemberRole.OWNER,
        permissions: {
          can_work_orders: true,
          can_attendance: true,
          can_service_requests: true,
          can_tickets: true,
          can_photo_upload: true,
          can_task_reminders: true,
        },
        createdById: 'admin-1',
        isActive: true,
        createdAt: new Date('2026-03-05T10:00:00.000Z'),
        updatedAt: new Date('2026-03-05T10:00:00.000Z'),
        deletedAt: null,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      imports: [EventEmitterModule.forRoot(), CommercialModule],
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
            permissions: ['commercial.view_all', 'commercial.create', 'commercial.update'],
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

  it('POST /commercial/entities creates commercial entity', async () => {
    await request(app.getHttpServer())
      .post('/commercial/entities')
      .send({
        name: 'Starbucks',
        communityId: 'community-1',
        unitId: 'unit-1',
        ownerUserId: 'owner-1',
      })
      .expect(201)
      .then((response) => {
        expect(response.body.id).toBe('entity-1');
        expect(response.body.name).toBe('Starbucks');
      });
  });

  it('GET /commercial/entities returns list', async () => {
    await request(app.getHttpServer())
      .get('/commercial/entities')
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('GET /commercial/entities/:id returns detail', async () => {
    await request(app.getHttpServer())
      .get('/commercial/entities/entity-1')
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('entity-1');
        expect(response.body.name).toBe('Starbucks');
      });
  });

  it('PATCH /commercial/entities/:id updates entity', async () => {
    await request(app.getHttpServer())
      .patch('/commercial/entities/entity-1')
      .send({
        name: 'Starbucks Downtown',
      })
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('entity-1');
      });
  });

  it('POST /commercial/entities/:id/members adds staff member', async () => {
    mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'staff-user-1' });
    mockPrismaService.commercialEntityMember.findUnique.mockResolvedValueOnce(null);
    mockPrismaService.commercialEntityMember.create.mockResolvedValueOnce({
      id: 'member-staff-1',
      entityId: 'entity-1',
      userId: 'staff-user-1',
      role: CommercialEntityMemberRole.STAFF,
      permissions: {
        can_work_orders: true,
        can_attendance: true,
        can_service_requests: false,
        can_tickets: false,
        can_photo_upload: true,
        can_task_reminders: true,
      },
      createdById: 'admin-1',
      isActive: true,
      createdAt: new Date('2026-03-05T10:10:00.000Z'),
      updatedAt: new Date('2026-03-05T10:10:00.000Z'),
    });

    await request(app.getHttpServer())
      .post('/commercial/entities/entity-1/members')
      .send({
        userId: 'staff-user-1',
        role: 'STAFF',
        permissions: {
          can_work_orders: true,
          can_attendance: true,
          can_photo_upload: true,
        },
      })
      .expect(201)
      .then((response) => {
        expect(response.body.id).toBe('member-staff-1');
        expect(response.body.role).toBe('STAFF');
      });
  });

  it('GET /commercial/entities/:id/members returns member list', async () => {
    await request(app.getHttpServer())
      .get('/commercial/entities/entity-1/members')
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('PATCH /commercial/members/:id updates member', async () => {
    mockPrismaService.commercialEntityMember.findUnique.mockResolvedValueOnce({
      id: 'member-staff-1',
      entityId: 'entity-1',
      userId: 'staff-user-1',
      role: CommercialEntityMemberRole.STAFF,
      permissions: {
        can_work_orders: true,
        can_attendance: true,
        can_service_requests: false,
        can_tickets: false,
        can_photo_upload: true,
        can_task_reminders: true,
      },
      createdById: 'admin-1',
      isActive: true,
      createdAt: new Date('2026-03-05T10:10:00.000Z'),
      updatedAt: new Date('2026-03-05T10:10:00.000Z'),
      deletedAt: null,
    });
    mockPrismaService.commercialEntityMember.update.mockResolvedValueOnce({
      id: 'member-staff-1',
      entityId: 'entity-1',
      userId: 'staff-user-1',
      role: CommercialEntityMemberRole.STAFF,
      permissions: {
        can_work_orders: true,
        can_attendance: true,
        can_service_requests: true,
        can_tickets: false,
        can_photo_upload: true,
        can_task_reminders: true,
      },
      createdById: 'admin-1',
      isActive: true,
      createdAt: new Date('2026-03-05T10:10:00.000Z'),
      updatedAt: new Date('2026-03-05T10:15:00.000Z'),
      deletedAt: null,
    });

    await request(app.getHttpServer())
      .patch('/commercial/members/member-staff-1')
      .send({
        role: 'STAFF',
        permissions: {
          can_service_requests: true,
        },
      })
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('member-staff-1');
      });
  });

  it('GET /commercial/members/:id/permissions returns permissions', async () => {
    await request(app.getHttpServer())
      .get('/commercial/members/member-owner-1/permissions')
      .expect(200)
      .then((response) => {
        expect(response.body.can_work_orders).toBe(true);
      });
  });

  it('PUT /commercial/members/:id/permissions updates permissions', async () => {
    await request(app.getHttpServer())
      .put('/commercial/members/member-owner-1/permissions')
      .send({
        permissions: {
          can_work_orders: true,
          can_attendance: true,
          can_service_requests: true,
          can_tickets: true,
          can_photo_upload: true,
          can_task_reminders: true,
        },
      })
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('member-owner-1');
        expect(response.body.permissions.can_work_orders).toBe(true);
      });
  });

  it('DELETE /commercial/members/:id archives member', async () => {
    mockPrismaService.commercialEntityMember.findUnique.mockResolvedValueOnce({
      id: 'member-hr-1',
      entityId: 'entity-1',
      userId: 'hr-user-1',
      role: CommercialEntityMemberRole.HR,
      permissions: {
        can_work_orders: true,
        can_attendance: true,
        can_service_requests: true,
        can_tickets: true,
        can_photo_upload: true,
        can_task_reminders: true,
      },
      createdById: 'admin-1',
      isActive: true,
      createdAt: new Date('2026-03-05T10:00:00.000Z'),
      updatedAt: new Date('2026-03-05T10:00:00.000Z'),
      deletedAt: null,
    });

    await request(app.getHttpServer())
      .delete('/commercial/members/member-hr-1')
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual({ success: true });
      });
  });

  it('DELETE /commercial/entities/:id archives entity', async () => {
    await request(app.getHttpServer())
      .delete('/commercial/entities/entity-1')
      .expect(200)
      .then((response) => {
        expect(response.body).toEqual({ success: true });
      });
  });
});
