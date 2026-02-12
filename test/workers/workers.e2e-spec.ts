import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersModule } from '../../src/modules/workers/workers.module';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { HikCentralQrService } from '../../src/modules/access-control/hikcentral/hikcentral-qr.service';
import { EventEmitterModule } from '@nestjs/event-emitter';
import {
  AccessStatus,
  ContractorRoleEnum,
  EntityStatus,
  MemberStatusEnum,
  UnitAccessRole,
} from '@prisma/client';

const mockUserId = 'user-uuid-123';
const mockUnitId = 'unit-uuid-789';
const mockContractorId = 'contractor-uuid-456';
const mockWorkerId = 'worker-uuid-999';
const mockAccessProfileId = 'profile-uuid-321';
const mockAccessGrantId = 'grant-uuid-555';

describe('Workers/Contractors (e2e)', () => {
  let app: INestApplication;

  const mockPrismaService: any = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    admin: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    unitAccess: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'ua-1',
        userId: mockUserId,
        unitId: mockUnitId,
        role: UnitAccessRole.DELEGATE,
        status: AccessStatus.ACTIVE,
        startsAt: new Date(Date.now() - 1000),
        endsAt: null,
        canManageWorkers: true,
        canGenerateQR: true,
      }),
    },
    contractor: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: mockContractorId,
        status: EntityStatus.ACTIVE,
      }),
      create: jest.fn().mockResolvedValue({
        id: mockContractorId,
        name: 'ACME Interiors',
        status: EntityStatus.ACTIVE,
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    contractorMember: {
      create: jest.fn().mockResolvedValue({
        id: 'cm-1',
        contractorId: mockContractorId,
        userId: mockUserId,
        role: ContractorRoleEnum.ADMIN,
        status: MemberStatusEnum.ACTIVE,
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'cm-1',
        role: ContractorRoleEnum.ADMIN,
      }),
    },
    unit: {
      findUnique: jest.fn().mockResolvedValue({ id: mockUnitId }),
    },
    accessProfile: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: mockAccessProfileId,
        fullName: 'Ahmed Ali',
        nationalId: '29801011234567',
        phone: null,
        photoId: null,
        status: AccessStatus.ACTIVE,
      }),
      update: jest.fn(),
    },
    worker: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: mockWorkerId,
        unitId: mockUnitId,
        contractorId: mockContractorId,
        accessProfileId: mockAccessProfileId,
        jobType: 'Electrician',
        status: EntityStatus.ACTIVE,
        accessProfile: {
          id: mockAccessProfileId,
          fullName: 'Ahmed Ali',
          nationalId: '29801011234567',
          status: AccessStatus.ACTIVE,
        },
        contractor: { id: mockContractorId, name: 'ACME Interiors' },
        unit: { id: mockUnitId },
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: mockWorkerId,
        unitId: mockUnitId,
        contractorId: mockContractorId,
        accessProfileId: mockAccessProfileId,
        status: EntityStatus.ACTIVE,
        contractor: { id: mockContractorId, status: EntityStatus.ACTIVE },
        unit: { id: mockUnitId, unitNumber: 'A-101' },
        accessProfile: {
          id: mockAccessProfileId,
          fullName: 'Ahmed Ali',
          nationalId: '29801011234567',
          status: AccessStatus.ACTIVE,
        },
      }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    accessGrant: {
      create: jest.fn().mockResolvedValue({ id: mockAccessGrantId }),
      delete: jest.fn().mockResolvedValue({ id: mockAccessGrantId }),
    },
    accessQRCode: {
      create: jest.fn().mockResolvedValue({
        id: 'qr-row-1',
        qrId: 'mock-qr-id',
        type: 'WORKER',
      }),
    },
    $transaction: jest.fn().mockImplementation(async (callback: any) => {
      const tx = mockPrismaService;
      return callback(tx);
    }),
  };

  const mockHikCentralQrService = {
    createQrCode: jest.fn().mockResolvedValue({
      qrId: 'mock-qr-id',
      qrImageBase64: Buffer.from('qr').toString('base64'),
    }),
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
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: mockUserId };
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

  it('POST /contractors creates a contractor', async () => {
    await request(app.getHttpServer())
      .post('/contractors')
      .send({ unitId: mockUnitId, name: 'ACME Interiors' })
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('ACME Interiors');
      });

    expect(mockPrismaService.contractor.create).toHaveBeenCalled();
    expect(mockPrismaService.contractorMember.create).toHaveBeenCalled();
  });

  it('POST /workers registers a worker', async () => {
    await request(app.getHttpServer())
      .post('/workers')
      .send({
        unitId: mockUnitId,
        contractorId: mockContractorId,
        fullName: 'Ahmed Ali',
        nationalId: '29801011234567',
        jobType: 'Electrician',
      })
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.accessProfile.fullName).toBe('Ahmed Ali');
      });
  });

  it('POST /workers/:id/qr generates a worker QR code', async () => {
    await request(app.getHttpServer())
      .post(`/workers/${mockWorkerId}/qr`)
      .send({})
      .expect(201)
      .then((res) => {
        expect(res.body).toHaveProperty('qrCode');
        expect(res.body).toHaveProperty('qrImageBase64');
      });

    expect(mockPrismaService.accessGrant.create).toHaveBeenCalled();
    expect(mockHikCentralQrService.createQrCode).toHaveBeenCalled();
    expect(mockPrismaService.accessQRCode.create).toHaveBeenCalled();
  });
});
