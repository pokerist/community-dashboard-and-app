import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CommercialEntityMemberRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommercialService } from './commercial.service';

describe('CommercialService', () => {
  let service: CommercialService;

  const prismaMock = {
    community: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    unit: {
      findUnique: jest.fn(),
    },
    commercialEntity: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    commercialEntityMember: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
        CommercialService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CommercialService>(CommercialService);
  });

  it('creates a commercial entity with owner member', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      isActive: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'owner-user-1' });
    prismaMock.unit.findUnique.mockResolvedValue({
      id: 'unit-1',
      communityId: 'community-1',
      isActive: true,
      deletedAt: null,
    });
    prismaMock.commercialEntity.findFirst.mockResolvedValue(null);
    prismaMock.commercialEntity.create.mockResolvedValue({
      id: 'entity-1',
    });
    prismaMock.commercialEntityMember.create.mockResolvedValue({
      id: 'member-owner-1',
    });
    prismaMock.commercialEntity.findUnique.mockResolvedValue({
      id: 'entity-1',
      name: 'Business Center',
      description: 'Retail offices',
      communityId: 'community-1',
      unitId: 'unit-1',
      isActive: true,
      createdAt: new Date('2026-03-06T01:00:00.000Z'),
      updatedAt: new Date('2026-03-06T01:00:00.000Z'),
      members: [
        {
          id: 'member-owner-1',
          entityId: 'entity-1',
          userId: 'owner-user-1',
          role: CommercialEntityMemberRole.OWNER,
          permissions: {
            can_work_orders: true,
            can_attendance: true,
            can_service_requests: true,
            can_tickets: true,
            can_photo_upload: true,
            can_task_reminders: true,
          },
          createdById: null,
          isActive: true,
          createdAt: new Date('2026-03-06T01:00:00.000Z'),
          updatedAt: new Date('2026-03-06T01:00:00.000Z'),
        },
      ],
    });

    const result = await service.createEntity({
      name: 'Business Center',
      description: 'Retail offices',
      communityId: 'community-1',
      unitId: 'unit-1',
      ownerUserId: 'owner-user-1',
    });

    expect(result.id).toBe('entity-1');
    expect(result.owner?.userId).toBe('owner-user-1');
    expect(prismaMock.commercialEntityMember.create).toHaveBeenCalled();
  });

  it('throws conflict on duplicate active entity name in same community', async () => {
    prismaMock.community.findUnique.mockResolvedValue({
      id: 'community-1',
      isActive: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'owner-user-1' });
    prismaMock.unit.findUnique.mockResolvedValue({
      id: 'unit-1',
      communityId: 'community-1',
      isActive: true,
      deletedAt: null,
    });
    prismaMock.commercialEntity.findFirst.mockResolvedValue({ id: 'entity-2' });

    await expect(
      service.createEntity({
        name: 'Business Center',
        communityId: 'community-1',
        unitId: 'unit-1',
        ownerUserId: 'owner-user-1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects HR creating HR (HR can create only staff)', async () => {
    prismaMock.commercialEntity.findUnique.mockResolvedValue({
      id: 'entity-1',
      name: 'Business Center',
      communityId: 'community-1',
      unitId: 'unit-1',
      isActive: true,
      deletedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'new-hr-user-1' });
    prismaMock.commercialEntityMember.findFirst.mockResolvedValue({
      id: 'member-hr-actor-1',
      role: CommercialEntityMemberRole.HR,
    });

    await expect(
      service.addMember(
        'entity-1',
        {
          userId: 'new-hr-user-1',
          role: CommercialEntityMemberRole.HR,
        },
        {
          actorUserId: 'hr-actor-1',
          actorPermissions: [],
          actorRoles: [],
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows owner to create staff member with granular permissions', async () => {
    prismaMock.commercialEntity.findUnique.mockResolvedValue({
      id: 'entity-1',
      name: 'Business Center',
      communityId: 'community-1',
      unitId: 'unit-1',
      isActive: true,
      deletedAt: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'staff-user-1' });
    prismaMock.commercialEntityMember.findFirst.mockResolvedValue({
      id: 'member-owner-1',
      role: CommercialEntityMemberRole.OWNER,
    });
    prismaMock.commercialEntityMember.findUnique.mockResolvedValue(null);
    prismaMock.commercialEntityMember.create.mockResolvedValue({
      id: 'member-staff-1',
      entityId: 'entity-1',
      userId: 'staff-user-1',
      role: CommercialEntityMemberRole.STAFF,
      permissions: {
        can_work_orders: true,
        can_attendance: false,
        can_service_requests: true,
        can_tickets: false,
        can_photo_upload: true,
        can_task_reminders: false,
      },
      createdById: 'owner-user-1',
      isActive: true,
      createdAt: new Date('2026-03-06T01:10:00.000Z'),
      updatedAt: new Date('2026-03-06T01:10:00.000Z'),
    });

    const result = await service.addMember(
      'entity-1',
      {
        userId: 'staff-user-1',
        role: CommercialEntityMemberRole.STAFF,
        permissions: {
          can_work_orders: true,
          can_service_requests: true,
          can_photo_upload: true,
        },
      },
      {
        actorUserId: 'owner-user-1',
      },
    );

    expect(result.id).toBe('member-staff-1');
    expect(result.permissions.can_work_orders).toBe(true);
    expect(result.permissions.can_attendance).toBe(false);
  });

  it('prevents deactivating the last active owner', async () => {
    prismaMock.commercialEntityMember.findUnique.mockResolvedValue({
      id: 'member-owner-1',
      entityId: 'entity-1',
      userId: 'owner-user-1',
      role: CommercialEntityMemberRole.OWNER,
      permissions: null,
      isActive: true,
      deletedAt: null,
    });
    prismaMock.commercialEntityMember.count.mockResolvedValue(0);

    await expect(
      service.updateMember(
        'member-owner-1',
        {
          isActive: false,
        },
        {
          actorUserId: 'admin-1',
          actorPermissions: ['admin.update'],
          actorRoles: [],
        },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('soft deletes entity and its members', async () => {
    prismaMock.commercialEntity.findUnique.mockResolvedValue({
      id: 'entity-1',
      name: 'Business Center',
      communityId: 'community-1',
      unitId: 'unit-1',
      isActive: true,
      deletedAt: null,
    });
    prismaMock.commercialEntityMember.updateMany.mockResolvedValue({ count: 3 });
    prismaMock.commercialEntity.update.mockResolvedValue({ id: 'entity-1' });

    const result = await service.removeEntity('entity-1');

    expect(result).toEqual({ success: true });
    expect(prismaMock.commercialEntityMember.updateMany).toHaveBeenCalled();
    expect(prismaMock.commercialEntity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: false,
        }),
      }),
    );
  });
});
