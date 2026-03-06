import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BlueCollarWeekDay,
  CompoundStaffPermission,
  CompoundStaffStatus,
  EntityStatus,
  GateDirection,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompoundStaffService } from './compound-staff.service';

describe('CompoundStaffService', () => {
  let service: CompoundStaffService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
    file: {
      findUnique: jest.fn(),
    },
    community: {
      findUnique: jest.fn(),
    },
    commercialEntity: {
      findFirst: jest.fn(),
    },
    gate: {
      findMany: jest.fn(),
    },
    compoundStaff: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    compoundStaffAccess: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    compoundStaffSchedule: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    compoundStaffGateAccess: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    compoundStaffActivityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
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
        CompoundStaffService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CompoundStaffService>(CompoundStaffService);
  });

  it('creates compound staff with permissions, schedules, and gates', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', isActive: true });
    prismaMock.commercialEntity.findFirst.mockResolvedValue({ id: 'entity-1' });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1' });
    prismaMock.file.findUnique.mockResolvedValue({ id: 'file-1' });
    prismaMock.compoundStaff.findFirst.mockResolvedValue(null);
    prismaMock.gate.findMany.mockResolvedValue([
      { id: 'gate-1', communityId: 'community-1', status: EntityStatus.ACTIVE },
    ]);
    prismaMock.compoundStaff.create.mockResolvedValue({ id: 'staff-1' });
    prismaMock.compoundStaffAccess.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.compoundStaffAccess.upsert.mockResolvedValue({ id: 'access-1' });
    prismaMock.compoundStaffAccess.findMany.mockResolvedValue([
      {
        id: 'access-1',
        staffId: 'staff-1',
        permission: CompoundStaffPermission.ENTRY_EXIT,
        isGranted: true,
        grantedById: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prismaMock.compoundStaffSchedule.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.compoundStaffSchedule.upsert.mockResolvedValue({ id: 'schedule-1' });
    prismaMock.compoundStaffSchedule.findMany.mockResolvedValue([
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
    ]);
    prismaMock.compoundStaffGateAccess.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.compoundStaffGateAccess.upsert.mockResolvedValue({ id: 'gate-access-1' });
    prismaMock.compoundStaffGateAccess.findMany.mockResolvedValue([
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
    ]);
    prismaMock.compoundStaffActivityLog.create.mockResolvedValue({ id: 'activity-1' });
    prismaMock.compoundStaff.findUnique.mockResolvedValue({
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
      accesses: [
        {
          id: 'access-1',
          staffId: 'staff-1',
          permission: CompoundStaffPermission.ENTRY_EXIT,
          isGranted: true,
          grantedById: 'admin-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      schedules: [
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
      ],
      gateAccesses: [
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
      ],
      activityLogs: [
        {
          id: 'activity-1',
          staffId: 'staff-1',
          actorUserId: 'admin-1',
          action: 'STAFF_CREATED',
          metadata: null,
          createdAt: new Date(),
        },
      ],
    });

    const result = await service.create(
      {
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
            notes: 'Morning shift',
          },
        ],
        gateAccesses: [
          {
            gateId: 'gate-1',
            directions: [GateDirection.ENTRY, GateDirection.EXIT],
          },
        ],
      },
      'admin-1',
    );

    expect(result.id).toBe('staff-1');
    expect(prismaMock.compoundStaff.create).toHaveBeenCalled();
    expect(prismaMock.compoundStaffAccess.upsert).toHaveBeenCalled();
    expect(prismaMock.compoundStaffSchedule.upsert).toHaveBeenCalled();
    expect(prismaMock.compoundStaffGateAccess.upsert).toHaveBeenCalled();
  });

  it('throws conflict when active staff exists for national id in community', async () => {
    prismaMock.community.findUnique.mockResolvedValue({ id: 'community-1', isActive: true });
    prismaMock.compoundStaff.findFirst.mockResolvedValue({ id: 'staff-1' });

    await expect(
      service.create(
        {
          communityId: 'community-1',
          fullName: 'Mahmoud Salah',
          phone: '01020000003',
          nationalId: '29801011234567',
          profession: 'Security Guard',
        },
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('validates contract range', async () => {
    await expect(
      service.create(
        {
          communityId: 'community-1',
          fullName: 'Mahmoud Salah',
          phone: '01020000003',
          nationalId: '29801011234567',
          profession: 'Security Guard',
          contractFrom: '2026-03-20T00:00:00.000Z',
          contractTo: '2026-03-19T00:00:00.000Z',
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects setting gate access for inactive status staff', async () => {
    prismaMock.compoundStaff.findUnique.mockResolvedValue({
      id: 'staff-1',
      communityId: 'community-1',
      commercialEntityId: 'entity-1',
      nationalId: '29801011234567',
      contractFrom: null,
      contractTo: null,
      status: CompoundStaffStatus.INACTIVE,
      isActive: true,
      deletedAt: null,
    });

    await expect(
      service.setGateAccesses(
        'staff-1',
        {
          gateAccesses: [
            {
              gateId: 'gate-1',
              directions: [GateDirection.ENTRY, GateDirection.EXIT],
            },
          ],
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('soft deletes staff and related records', async () => {
    prismaMock.compoundStaff.findUnique.mockResolvedValue({
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
    prismaMock.compoundStaffAccess.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.compoundStaffGateAccess.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.compoundStaffSchedule.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.compoundStaff.update.mockResolvedValue({ id: 'staff-1' });
    prismaMock.compoundStaffActivityLog.create.mockResolvedValue({ id: 'activity-1' });

    const result = await service.remove('staff-1', 'admin-1');

    expect(result).toEqual({ success: true });
    expect(prismaMock.compoundStaffAccess.updateMany).toHaveBeenCalled();
    expect(prismaMock.compoundStaffGateAccess.updateMany).toHaveBeenCalled();
    expect(prismaMock.compoundStaff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
        }),
      }),
    );
  });
});
