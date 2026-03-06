import { Test, TestingModule } from '@nestjs/testing';
import { HouseholdRequestStatus, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { HouseholdService } from '../household/household.service';
import { EmailService } from '../notifications/email.service';
import { SmsProviderService } from '../notifications/providers/sms-provider.service';
import { ApprovalsService } from './approvals.service';

describe('ApprovalsService', () => {
  let service: ApprovalsService;

  const prismaMock = {
    pendingRegistration: {
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    familyAccessRequest: {
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    authorizedAccessRequest: {
      count: jest.fn(),
    },
    homeStaffAccess: {
      count: jest.fn(),
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
    residentUnit: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    unitAccess: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    ownerUnitContract: {
      upsert: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    userRole: {
      upsert: jest.fn(),
    },
    unit: {
      findUnique: jest.fn(),
    },
    file: {
      create: jest.fn(),
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

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof prismaMock) => Promise<unknown>,
      ): Promise<unknown> => callback(prismaMock),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: HouseholdService, useValue: householdMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: SmsProviderService, useValue: smsProviderMock },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  it('aggregates approval stats', async () => {
    prismaMock.pendingRegistration.count.mockResolvedValue(2);
    prismaMock.familyAccessRequest.count.mockResolvedValue(3);
    prismaMock.authorizedAccessRequest.count.mockResolvedValue(4);
    prismaMock.homeStaffAccess.count.mockResolvedValue(5);

    const stats = await service.getApprovalStats();

    expect(stats.pendingOwners).toBe(2);
    expect(stats.pendingFamilyMembers).toBe(3);
    expect(stats.pendingDelegates).toBe(4);
    expect(stats.pendingHomeStaff).toBe(5);
    expect(stats.totalPending).toBe(14);
  });

  it('creates pre-registered owner with onboarding flag', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'user-1' });
    prismaMock.file.create.mockResolvedValue({ id: 'file-1' });
    prismaMock.role.findUnique.mockResolvedValue(null);
    emailServiceMock.sendEmail.mockResolvedValue(undefined);

    const result = await service.preRegisterOwner(
      {
        nameEN: 'Owner User',
        email: 'owner@example.com',
        phone: '+201000000000',
        nationalId: '29801011234567',
      },
      'admin-1',
    );

    expect(result.success).toBe(true);
    expect(result.userId).toBe('user-1');
    expect(result.requestId).toBe('user-1');
    expect(result.status).toBe(RegistrationStatus.VERIFIED);
    expect(prismaMock.pendingRegistration.create).not.toHaveBeenCalled();
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requiresOnboarding: true,
          onboardingStep: 'OTP',
        }),
      }),
    );
  });

  it('assigns selected unit when pre-registering owner', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'user-2' });
    prismaMock.resident.upsert.mockResolvedValue({ id: 'resident-2' });
    prismaMock.unit.findUnique.mockResolvedValue({ id: 'unit-1' });
    prismaMock.residentUnit.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.residentUnit.findUnique.mockResolvedValue(null);
    prismaMock.unitAccess.findFirst.mockResolvedValue(null);
    prismaMock.file.create.mockResolvedValue({ id: 'file-2' });
    prismaMock.role.findUnique.mockResolvedValue(null);
    prismaMock.ownerUnitContract.upsert.mockResolvedValue({ id: 'contract-1' });
    emailServiceMock.sendEmail.mockResolvedValue(undefined);

    const result = await service.preRegisterOwner(
      {
        nameEN: 'Owner With Unit',
        email: 'owner2@example.com',
        phone: '+201000000001',
        nationalId: '29801011234568',
        unitId: 'unit-1',
      },
      'admin-1',
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(RegistrationStatus.VERIFIED);
    expect(prismaMock.residentUnit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          residentId: 'resident-2',
          unitId: 'unit-1',
        }),
      }),
    );
    expect(prismaMock.unitAccess.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitId: 'unit-1',
          userId: 'user-2',
          role: 'OWNER',
        }),
      }),
    );
    expect(prismaMock.ownerUnitContract.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerUserId_unitId: {
            ownerUserId: 'user-2',
            unitId: 'unit-1',
          },
        },
      }),
    );
  });

  it('approves home staff by creating access profile and worker', async () => {
    prismaMock.homeStaffAccess.findUnique.mockResolvedValue({
      id: 'hs-1',
      unitId: 'unit-1',
      status: HouseholdRequestStatus.PENDING,
      fullName: 'Staff User',
      phone: '+201111111111',
      nationalIdOrPassport: 'A1234567',
      personalPhotoFileId: null,
      staffType: 'DRIVER',
    });
    prismaMock.contractor.findFirst.mockResolvedValue({ id: 'contractor-1' });
    prismaMock.accessProfile.create.mockResolvedValue({ id: 'profile-1' });
    prismaMock.worker.create.mockResolvedValue({ id: 'worker-1' });
    prismaMock.homeStaffAccess.update.mockResolvedValue({
      id: 'hs-1',
      status: HouseholdRequestStatus.APPROVED,
    });

    const result = await service.approveHomeStaff('hs-1', 'admin-1');

    expect(result).toEqual({
      success: true,
      id: 'hs-1',
      status: HouseholdRequestStatus.APPROVED,
    });
    expect(prismaMock.accessProfile.create).toHaveBeenCalled();
    expect(prismaMock.worker.create).toHaveBeenCalled();
  });
});
