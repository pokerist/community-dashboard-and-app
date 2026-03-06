import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdRequestStatus, RegistrationStatus } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalsController } from '../../src/modules/approvals/approvals.controller';
import { ApprovalsService } from '../../src/modules/approvals/approvals.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { HouseholdService } from '../../src/modules/household/household.service';
import { EmailService } from '../../src/modules/notifications/email.service';
import { SmsProviderService } from '../../src/modules/notifications/providers/sms-provider.service';

describe('ApprovalsController (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    pendingRegistration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    owner: {
      upsert: jest.fn(),
    },
    resident: {
      upsert: jest.fn(),
    },
    role: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    userRole: {
      upsert: jest.fn(),
    },
    homeStaffAccess: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    contractor: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    accessProfile: {
      create: jest.fn(),
    },
    worker: {
      create: jest.fn(),
    },
    familyAccessRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const householdMock = {
    reviewFamilyRequest: jest.fn(),
    reviewAuthorizedRequest: jest.fn(),
  };

  const emailServiceMock = {
    sendEmail: jest.fn(),
  };

  const smsProviderMock = {
    sendSms: jest.fn(),
  };

  beforeAll(async () => {
    prismaMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof prismaMock) => Promise<unknown>,
      ): Promise<unknown> => callback(prismaMock),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalsController],
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HouseholdService, useValue: householdMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: SmsProviderService, useValue: smsProviderMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest<{ user?: { id: string } }>();
          req.user = { id: 'admin-1' };
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /approvals/owners/:id/approve', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      id: 'owner-pending-1',
      status: RegistrationStatus.PENDING,
      name: 'Owner Name',
      phone: '+201000000001',
      email: 'owner@example.com',
      personalPhotoId: 'photo-1',
      nationalId: '29801011234567',
      origin: 'community',
      lookupResult: null,
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'user-1' });
    prismaMock.pendingRegistration.update.mockResolvedValue({
      id: 'owner-pending-1',
      status: RegistrationStatus.VERIFIED,
    });
    emailServiceMock.sendEmail.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/approvals/owners/owner-pending-1/approve')
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(RegistrationStatus.VERIFIED);
      });
  });

  it('POST /approvals/owners/:id/reject', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      id: 'owner-pending-2',
      status: RegistrationStatus.PENDING,
      lookupResult: null,
    });
    prismaMock.pendingRegistration.update.mockResolvedValue({
      id: 'owner-pending-2',
      status: RegistrationStatus.REJECTED,
    });

    await request(app.getHttpServer())
      .post('/approvals/owners/owner-pending-2/reject')
      .send({ reason: 'Invalid contract data' })
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(RegistrationStatus.REJECTED);
      });
  });

  it('POST /approvals/family-members/:id/approve', async () => {
    householdMock.reviewFamilyRequest.mockResolvedValue({
      id: 'family-1',
      status: HouseholdRequestStatus.APPROVED,
    });
    prismaMock.familyAccessRequest.findUnique.mockResolvedValue({
      id: 'family-1',
      status: HouseholdRequestStatus.APPROVED,
      email: 'family@example.com',
      activatedUser: null,
    });

    await request(app.getHttpServer())
      .post('/approvals/family-members/family-1/approve')
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(HouseholdRequestStatus.APPROVED);
      });
  });

  it('POST /approvals/family-members/:id/reject', async () => {
    householdMock.reviewFamilyRequest.mockResolvedValue({
      id: 'family-2',
      status: HouseholdRequestStatus.REJECTED,
    });

    await request(app.getHttpServer())
      .post('/approvals/family-members/family-2/reject')
      .send({ reason: 'Missing required docs' })
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(HouseholdRequestStatus.REJECTED);
      });
  });

  it('POST /approvals/delegates/:id/approve', async () => {
    householdMock.reviewAuthorizedRequest.mockResolvedValue({
      id: 'delegate-1',
      status: HouseholdRequestStatus.APPROVED,
    });

    await request(app.getHttpServer())
      .post('/approvals/delegates/delegate-1/approve')
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(HouseholdRequestStatus.APPROVED);
      });
  });

  it('POST /approvals/delegates/:id/reject', async () => {
    householdMock.reviewAuthorizedRequest.mockResolvedValue({
      id: 'delegate-2',
      status: HouseholdRequestStatus.REJECTED,
    });

    await request(app.getHttpServer())
      .post('/approvals/delegates/delegate-2/reject')
      .send({ reason: 'Authorization expired' })
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(HouseholdRequestStatus.REJECTED);
      });
  });

  it('POST /approvals/home-staff/:id/approve', async () => {
    prismaMock.homeStaffAccess.findUnique.mockResolvedValue({
      id: 'staff-1',
      status: HouseholdRequestStatus.PENDING,
      fullName: 'Worker Name',
      phone: '+201222222222',
      nationalIdOrPassport: 'A123456',
      personalPhotoFileId: null,
      staffType: 'DRIVER',
      unitId: 'unit-1',
    });
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'contractor-1' });
    prismaMock.accessProfile.create.mockResolvedValue({ id: 'profile-1' });
    prismaMock.worker.create.mockResolvedValue({ id: 'worker-1' });
    prismaMock.homeStaffAccess.update.mockResolvedValue({
      id: 'staff-1',
      status: HouseholdRequestStatus.APPROVED,
    });

    await request(app.getHttpServer())
      .post('/approvals/home-staff/staff-1/approve')
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(HouseholdRequestStatus.APPROVED);
      });
  });

  it('POST /approvals/home-staff/:id/reject', async () => {
    prismaMock.homeStaffAccess.findUnique.mockResolvedValue({
      id: 'staff-2',
      status: HouseholdRequestStatus.PENDING,
    });
    prismaMock.homeStaffAccess.update.mockResolvedValue({
      id: 'staff-2',
      status: HouseholdRequestStatus.REJECTED,
    });

    await request(app.getHttpServer())
      .post('/approvals/home-staff/staff-2/reject')
      .send({ reason: 'Owner did not confirm contract' })
      .expect(201)
      .then((response) => {
        expect(response.body.success).toBe(true);
        expect(response.body.status).toBe(HouseholdRequestStatus.REJECTED);
      });
  });
});

