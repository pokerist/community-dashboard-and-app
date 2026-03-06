import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AccessStatus,
  EntityStatus,
} from '@prisma/client';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersModule } from '../../src/modules/workers/workers.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { HikCentralQrService } from '../../src/modules/access-control/hikcentral/hikcentral-qr.service';

describe('BlueCollar Admin Flow (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    admin: {
      findUnique: jest.fn().mockResolvedValue({ id: 'admin-row' }),
    },
    community: {
      findUnique: jest.fn().mockResolvedValue({ id: 'community-1' }),
    },
    blueCollarSetting: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'setting-1',
        communityId: 'community-1',
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
        termsAndConditions: 'Initial terms',
        termsVersion: 2,
        updatedAt: new Date('2026-03-06T10:00:00.000Z'),
        updatedById: 'admin-1',
        workStartTime: '07:00',
        workEndTime: '18:00',
        workDays: [],
        holidays: [],
        requiresAdminApproval: true,
        createdById: 'admin-1',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        deletedAt: null,
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'setting-1',
        termsVersion: 2,
        termsAndConditions: 'Initial terms',
        updatedAt: new Date('2026-03-06T10:00:00.000Z'),
      }),
      upsert: jest.fn().mockResolvedValue({
        id: 'setting-1',
        communityId: 'community-1',
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
        termsAndConditions: 'Initial terms',
        termsVersion: 2,
        updatedAt: new Date('2026-03-06T10:00:00.000Z'),
        updatedById: 'admin-1',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'setting-1',
        termsAndConditions: 'Updated terms',
        termsVersion: 3,
        updatedAt: new Date('2026-03-06T12:00:00.000Z'),
      }),
      create: jest.fn().mockResolvedValue({
        id: 'setting-1',
        termsAndConditions: 'Updated terms',
        termsVersion: 1,
        updatedAt: new Date('2026-03-06T12:00:00.000Z'),
      }),
    },
    blueCollarHoliday: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'holiday-1',
          communityId: 'community-1',
          date: new Date('2026-04-10T00:00:00.000Z'),
          label: 'Eid',
          createdAt: new Date('2026-03-06T08:00:00.000Z'),
        },
      ]),
      create: jest.fn().mockResolvedValue({
        id: 'holiday-2',
        communityId: 'community-1',
        date: new Date('2026-05-01T00:00:00.000Z'),
        label: 'Labor Day',
        createdAt: new Date('2026-03-06T09:00:00.000Z'),
      }),
      findUnique: jest.fn().mockResolvedValue({ id: 'holiday-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'holiday-1' }),
    },
    worker: {
      count: jest.fn().mockImplementation(({ where }: { where?: { accessProfile?: { status?: AccessStatus }; status?: EntityStatus } }) => {
        if (where?.accessProfile?.status === AccessStatus.PENDING) return Promise.resolve(2);
        if (where?.status === EntityStatus.ACTIVE && where?.accessProfile?.status === AccessStatus.ACTIVE) {
          return Promise.resolve(7);
        }
        return Promise.resolve(10);
      }),
      findMany: jest.fn().mockImplementation(({ select }: { select?: { contractorId?: boolean } }) => {
        if (select?.contractorId) {
          return Promise.resolve([
            { contractorId: 'contractor-1' },
            { contractorId: 'contractor-2' },
          ]);
        }
        return Promise.resolve([
          {
            id: 'worker-1',
            accessProfileId: 'profile-1',
            jobType: 'Electrician',
            status: EntityStatus.ACTIVE,
            accessProfile: {
              fullName: 'Ahmed Ali',
              nationalId: '29801011234567',
              status: AccessStatus.PENDING,
            },
            contractor: {
              name: 'ACME',
            },
            unit: {
              unitNumber: 'A-101',
            },
          },
        ]);
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'worker-1',
        accessProfileId: 'profile-1',
        jobType: 'Electrician',
        status: EntityStatus.ACTIVE,
        accessProfile: {
          fullName: 'Ahmed Ali',
          nationalId: '29801011234567',
          phone: '+201234567890',
          photoId: null,
          notes: null,
          status: AccessStatus.PENDING,
          accessGrants: [
            {
              id: 'grant-1',
              unitId: 'unit-1',
              validFrom: new Date('2026-03-06T08:00:00.000Z'),
              validTo: new Date('2026-03-06T16:00:00.000Z'),
              permissions: ['WORK'],
            },
          ],
        },
        contractor: {
          name: 'ACME',
        },
        unit: {
          unitNumber: 'A-101',
        },
      }),
    },
    accessProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      update: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'profile-1',
          status: AccessStatus.ACTIVE,
          notes: null,
        })
        .mockResolvedValueOnce({
          id: 'profile-1',
          status: AccessStatus.REVOKED,
          notes: 'Missing docs',
        }),
    },
    unitAccess: {
      findFirst: jest.fn(),
    },
    contractorMember: {
      findFirst: jest.fn(),
    },
    blueCollarAccessRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    accessGrant: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    accessQRCode: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockHikCentralQrService = {
    createQrCode: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), WorkersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(HikCentralQrService)
      .useValue(mockHikCentralQrService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
          req.user = { id: 'admin-1' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /blue-collar/settings', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/settings')
      .query({ communityId: 'community-1' })
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('setting-1');
      });
  });

  it('PUT /blue-collar/settings', async () => {
    await request(app.getHttpServer())
      .put('/blue-collar/settings')
      .query({ communityId: 'community-1' })
      .send({
        workingHoursStart: '07:00',
        workingHoursEnd: '18:00',
        allowedDays: [1, 2, 3, 4, 5],
      })
      .expect(200)
      .then((response) => {
        expect(response.body.communityId).toBe('community-1');
      });
  });

  it('GET /blue-collar/holidays', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/holidays')
      .query({ communityId: 'community-1', year: 2026 })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('POST /blue-collar/holidays', async () => {
    await request(app.getHttpServer())
      .post('/blue-collar/holidays')
      .query({ communityId: 'community-1' })
      .send({ date: '2026-05-01', label: 'Labor Day' })
      .expect(201)
      .then((response) => {
        expect(response.body.id).toBe('holiday-2');
      });
  });

  it('DELETE /blue-collar/holidays/:id', async () => {
    await request(app.getHttpServer())
      .delete('/blue-collar/holidays/holiday-1')
      .expect(200)
      .then((response) => {
        expect(response.body.success).toBe(true);
      });
  });

  it('GET /blue-collar/terms', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/terms')
      .query({ communityId: 'community-1' })
      .expect(200)
      .then((response) => {
        expect(response.body.version).toBe(2);
      });
  });

  it('PUT /blue-collar/terms', async () => {
    await request(app.getHttpServer())
      .put('/blue-collar/terms')
      .query({ communityId: 'community-1' })
      .send({ terms: 'Updated terms' })
      .expect(200)
      .then((response) => {
        expect(response.body.version).toBe(3);
      });
  });

  it('GET /blue-collar/workers', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/workers')
      .query({ page: 1, limit: 20 })
      .expect(200)
      .then((response) => {
        expect(response.body.data).toBeInstanceOf(Array);
      });
  });

  it('GET /blue-collar/workers/pending', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/workers/pending')
      .query({ communityId: 'community-1' })
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
      });
  });

  it('GET /blue-collar/workers/:id', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/workers/worker-1')
      .expect(200)
      .then((response) => {
        expect(response.body.id).toBe('worker-1');
      });
  });

  it('POST /blue-collar/workers/:id/approve', async () => {
    await request(app.getHttpServer())
      .post('/blue-collar/workers/profile-1/approve')
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe(AccessStatus.ACTIVE);
      });
  });

  it('POST /blue-collar/workers/:id/reject', async () => {
    await request(app.getHttpServer())
      .post('/blue-collar/workers/profile-1/reject')
      .send({ reason: 'Missing docs' })
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe(AccessStatus.REVOKED);
      });
  });

  it('GET /blue-collar/stats', async () => {
    await request(app.getHttpServer())
      .get('/blue-collar/stats')
      .query({ communityId: 'community-1' })
      .expect(200)
      .then((response) => {
        expect(response.body.totalWorkers).toBe(10);
      });
  });
});
