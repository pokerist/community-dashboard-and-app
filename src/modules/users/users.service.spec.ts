import { UserStatusEnum } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompoundStaffService } from '../compound-staff/compound-staff.service';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    authorizedAccessRequest: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    homeStaffAccess: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    complaint: {
      count: jest.fn(),
    },
    violation: {
      count: jest.fn(),
    },
    owner: {
      count: jest.fn(),
    },
    familyMember: {
      count: jest.fn(),
    },
    tenant: {
      count: jest.fn(),
    },
    broker: {
      count: jest.fn(),
    },
    familyAccessRequest: {
      count: jest.fn(),
    },
  };

  const mockPermissionCacheService = {
    refresh: jest.fn(),
  };

  const mockCompoundStaffService = {
    list: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockPermissionCacheService as unknown as PermissionCacheService,
      mockCompoundStaffService as unknown as CompoundStaffService,
    );
  });

  it('getUserDetail auto-detects broker type', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      nameEN: 'Nour Broker',
      nameAR: null,
      email: 'nour@example.com',
      phone: null,
      userStatus: UserStatusEnum.ACTIVE,
      lastLoginAt: null,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      owner: null,
      tenant: null,
      admin: null,
      broker: {
        id: 'broker-1',
        agencyName: 'Skyline Realty',
        licenseNumber: 'BR-8821',
      },
      profilePhoto: null,
      roles: [],
      resident: null,
      leasesAsTenant: [],
      leasesAsOwner: [],
      ownerUnitContracts: [],
      statusLogs: [],
      compoundStaffAssignments: [],
    });
    mockPrisma.authorizedAccessRequest.findFirst.mockResolvedValue(null);
    mockPrisma.complaint.count.mockResolvedValue(0);
    mockPrisma.violation.count.mockResolvedValue(0);

    const response = await service.getUserDetail('user-1');

    expect(response.userType).toBe('BROKER');
    expect(response.brokerData).toEqual({
      agencyName: 'Skyline Realty',
      licenseNumber: 'BR-8821',
    });
  });

  it('getAllUserStats aggregates totals and pending approvals', async () => {
    mockPrisma.owner.count.mockResolvedValue(12);
    mockPrisma.familyMember.count.mockResolvedValue(25);
    mockPrisma.tenant.count.mockResolvedValue(9);
    mockPrisma.homeStaffAccess.count
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(4);
    mockPrisma.authorizedAccessRequest.count
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(3);
    mockPrisma.broker.count.mockResolvedValue(5);
    mockPrisma.user.count
      .mockResolvedValueOnce(38)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2);
    mockPrisma.familyAccessRequest.count.mockResolvedValue(6);

    const response = await service.getAllUserStats();

    expect(response).toEqual({
      totalUsers: 38,
      totalOwners: 12,
      totalFamilyMembers: 25,
      totalTenants: 9,
      totalHomeStaff: 30,
      totalDelegates: 14,
      totalBrokers: 5,
      totalSystemUsers: 7,
      pendingApprovals: 13,
      suspendedUsers: 2,
    });
  });
});
