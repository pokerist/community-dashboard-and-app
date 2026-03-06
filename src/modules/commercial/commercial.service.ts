import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommercialEntityMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CommercialMemberPermissions {
  can_work_orders: boolean;
  can_attendance: boolean;
  can_service_requests: boolean;
  can_tickets: boolean;
  can_photo_upload: boolean;
  can_task_reminders: boolean;
}

export interface CommercialEntityMemberResponse {
  id: string;
  entityId: string;
  userId: string;
  role: CommercialEntityMemberRole;
  permissions: CommercialMemberPermissions;
  createdById: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommercialEntityResponse {
  id: string;
  name: string;
  description: string | null;
  communityId: string;
  unitId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: CommercialEntityMemberResponse | null;
  hrMembers: CommercialEntityMemberResponse[];
  staffMembers: CommercialEntityMemberResponse[];
  memberCount: number;
}

export interface ListCommercialEntitiesInput {
  communityId?: string;
  unitId?: string;
  ownerUserId?: string;
  includeInactive?: boolean;
}

export interface CreateCommercialEntityInput {
  name: string;
  description?: string;
  communityId: string;
  unitId: string;
  ownerUserId: string;
}

export interface UpdateCommercialEntityInput {
  name?: string;
  description?: string | null;
  communityId?: string;
  unitId?: string;
}

export interface AddCommercialEntityMemberInput {
  userId: string;
  role: CommercialEntityMemberRole;
  permissions?: Partial<CommercialMemberPermissions>;
}

export interface UpdateCommercialEntityMemberInput {
  role?: CommercialEntityMemberRole;
  permissions?: Partial<CommercialMemberPermissions>;
  isActive?: boolean;
}

export interface SetCommercialEntityMemberPermissionsInput {
  permissions: Partial<CommercialMemberPermissions>;
}

interface ActorContext {
  actorUserId: string;
  actorPermissions?: string[];
  actorRoles?: string[];
}

type EntityWithMembers = Prisma.CommercialEntityGetPayload<{
  include: {
    members: {
      where: {
        deletedAt: null;
      };
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }];
    };
  };
}>;

type MemberRecord = Prisma.CommercialEntityMemberGetPayload<Record<string, never>>;

const EMPTY_PERMISSIONS: CommercialMemberPermissions = {
  can_work_orders: false,
  can_attendance: false,
  can_service_requests: false,
  can_tickets: false,
  can_photo_upload: false,
  can_task_reminders: false,
};

@Injectable()
export class CommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async listEntities(
    query: ListCommercialEntitiesInput,
  ): Promise<CommercialEntityResponse[]> {
    const where: Prisma.CommercialEntityWhereInput = {
      ...(query.communityId ? { communityId: query.communityId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.ownerUserId
        ? {
            members: {
              some: {
                userId: query.ownerUserId,
                role: CommercialEntityMemberRole.OWNER,
                isActive: true,
                deletedAt: null,
              },
            },
          }
        : {}),
      ...(query.includeInactive ? {} : { isActive: true, deletedAt: null }),
    };

    const rows = await this.prisma.commercialEntity.findMany({
      where,
      include: {
        members: {
          where: { deletedAt: null },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((row) => this.mapEntity(row));
  }

  async createEntity(
    input: CreateCommercialEntityInput,
    actorUserId: string | null = null,
  ): Promise<CommercialEntityResponse> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Commercial entity name is required');
    }

    await this.ensureCommunityExists(input.communityId);
    await this.ensureUserExists(input.ownerUserId);
    await this.ensureUnitBelongsToCommunity(input.unitId, input.communityId);
    await this.ensureEntityNameAvailable(name, input.communityId);

    const permissions = this.defaultPermissionsForRole(CommercialEntityMemberRole.OWNER);

    const created = await this.prisma.$transaction(async (tx) => {
      const entity = await tx.commercialEntity.create({
        data: {
          name,
          description: input.description?.trim() || null,
          communityId: input.communityId,
          unitId: input.unitId,
          isActive: true,
        },
      });

      await tx.commercialEntityMember.create({
        data: {
          entityId: entity.id,
          userId: input.ownerUserId,
          role: CommercialEntityMemberRole.OWNER,
          permissions: this.toJsonInput(permissions),
          createdById: actorUserId,
          isActive: true,
        },
      });

      return tx.commercialEntity.findUnique({
        where: { id: entity.id },
        include: {
          members: {
            where: { deletedAt: null },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
    });

    if (!created) {
      throw new NotFoundException('Commercial entity not found after creation');
    }

    return this.mapEntity(created);
  }

  async getEntityById(entityId: string): Promise<CommercialEntityResponse> {
    const entity = await this.prisma.commercialEntity.findFirst({
      where: {
        id: entityId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        members: {
          where: { deletedAt: null },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!entity) {
      throw new NotFoundException('Commercial entity not found');
    }

    return this.mapEntity(entity);
  }

  async updateEntity(
    entityId: string,
    input: UpdateCommercialEntityInput,
  ): Promise<CommercialEntityResponse> {
    const current = await this.findEntityForMutation(entityId);
    const nextCommunityId = input.communityId ?? current.communityId;
    const nextName = input.name?.trim() ?? current.name;

    if (input.communityId) {
      await this.ensureCommunityExists(input.communityId);
    }
    if (input.unitId || input.communityId) {
      await this.ensureUnitBelongsToCommunity(
        input.unitId ?? current.unitId,
        nextCommunityId,
      );
    }
    if (input.name || input.communityId) {
      await this.ensureEntityNameAvailable(nextName, nextCommunityId, current.id);
    }

    const updated = await this.prisma.commercialEntity.update({
      where: { id: entityId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.communityId !== undefined ? { communityId: input.communityId } : {}),
        ...(input.unitId !== undefined ? { unitId: input.unitId } : {}),
      },
      include: {
        members: {
          where: { deletedAt: null },
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    return this.mapEntity(updated);
  }

  async removeEntity(entityId: string): Promise<{ success: true }> {
    await this.findEntityForMutation(entityId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.commercialEntityMember.updateMany({
        where: {
          entityId,
          deletedAt: null,
        },
        data: {
          isActive: false,
          deletedAt: now,
        },
      });

      await tx.commercialEntity.update({
        where: { id: entityId },
        data: {
          isActive: false,
          deletedAt: now,
        },
      });
    });

    return { success: true };
  }

  async listMembers(entityId: string): Promise<CommercialEntityMemberResponse[]> {
    await this.findEntityForMutation(entityId);
    const rows = await this.prisma.commercialEntityMember.findMany({
      where: {
        entityId,
        deletedAt: null,
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => this.mapMember(row));
  }

  async addMember(
    entityId: string,
    input: AddCommercialEntityMemberInput,
    ctx: ActorContext,
  ): Promise<CommercialEntityMemberResponse> {
    const entity = await this.findEntityForMutation(entityId);
    await this.ensureUserExists(input.userId);
    await this.assertActorCanManageRole(entityId, input.role, ctx);

    const permissions = this.normalizePermissions(input.permissions, input.role);
    const existing = await this.prisma.commercialEntityMember.findUnique({
      where: {
        entityId_userId: {
          entityId,
          userId: input.userId,
        },
      },
    });

    if (existing && !existing.deletedAt && existing.isActive) {
      throw new ConflictException(
        'This user is already assigned to the commercial entity',
      );
    }

    const member = existing
      ? await this.prisma.commercialEntityMember.update({
          where: { id: existing.id },
          data: {
            role: input.role,
            permissions: this.toJsonInput(permissions),
            createdById: ctx.actorUserId,
            isActive: true,
            deletedAt: null,
          },
        })
      : await this.prisma.commercialEntityMember.create({
          data: {
            entityId,
            userId: input.userId,
            role: input.role,
            permissions: this.toJsonInput(permissions),
            createdById: ctx.actorUserId,
            isActive: true,
          },
        });

    if (input.role === CommercialEntityMemberRole.OWNER && entity.unitId) {
      await this.ensureUnitBelongsToCommunity(entity.unitId, entity.communityId);
    }

    return this.mapMember(member);
  }

  async updateMember(
    memberId: string,
    input: UpdateCommercialEntityMemberInput,
    ctx: ActorContext,
  ): Promise<CommercialEntityMemberResponse> {
    const member = await this.findMemberForMutation(memberId);
    const targetRole = input.role ?? member.role;

    await this.assertActorCanManageRole(member.entityId, targetRole, ctx);

    if (input.isActive === false && member.role === CommercialEntityMemberRole.OWNER) {
      await this.assertNotLastOwner(member.entityId, member.id);
    }

    const currentPermissions = this.parsePermissions(member.permissions);
    const nextPermissions =
      input.permissions !== undefined
        ? this.mergePermissions(
            currentPermissions,
            this.normalizePermissions(input.permissions, targetRole),
          )
        : currentPermissions;

    const now = new Date();
    const updated = await this.prisma.commercialEntityMember.update({
      where: { id: memberId },
      data: {
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.permissions !== undefined
          ? { permissions: this.toJsonInput(nextPermissions) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isActive === false ? { deletedAt: now } : {}),
        ...(input.isActive === true ? { deletedAt: null } : {}),
      },
    });

    return this.mapMember(updated);
  }

  async removeMember(memberId: string, ctx: ActorContext): Promise<{ success: true }> {
    const member = await this.findMemberForMutation(memberId);
    await this.assertActorCanManageRole(member.entityId, member.role, ctx);

    if (member.role === CommercialEntityMemberRole.OWNER) {
      await this.assertNotLastOwner(member.entityId, member.id);
    }

    await this.prisma.commercialEntityMember.update({
      where: { id: memberId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  async getMemberPermissions(memberId: string): Promise<CommercialMemberPermissions> {
    const member = await this.findMemberForMutation(memberId);
    return this.parsePermissions(member.permissions);
  }

  async setMemberPermissions(
    memberId: string,
    input: SetCommercialEntityMemberPermissionsInput,
    ctx: ActorContext,
  ): Promise<CommercialEntityMemberResponse> {
    const member = await this.findMemberForMutation(memberId);
    await this.assertActorCanManageRole(member.entityId, member.role, ctx);

    const next = this.normalizePermissions(input.permissions, member.role);
    const updated = await this.prisma.commercialEntityMember.update({
      where: { id: memberId },
      data: {
        permissions: this.toJsonInput(next),
      },
    });

    return this.mapMember(updated);
  }

  private async ensureCommunityExists(communityId: string): Promise<void> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, isActive: true },
    });
    if (!community || !community.isActive) {
      throw new NotFoundException('Community not found');
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async ensureUnitBelongsToCommunity(
    unitId: string,
    communityId: string,
  ): Promise<void> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        communityId: true,
        isActive: true,
        deletedAt: true,
      },
    });
    if (!unit || !unit.isActive || unit.deletedAt) {
      throw new NotFoundException('Unit not found or inactive');
    }
    if (!unit.communityId || unit.communityId !== communityId) {
      throw new BadRequestException(
        'Unit must belong to the same community as the commercial entity',
      );
    }
  }

  private async ensureEntityNameAvailable(
    name: string,
    communityId: string,
    excludeEntityId?: string,
  ): Promise<void> {
    const existing = await this.prisma.commercialEntity.findFirst({
      where: {
        communityId,
        name: {
          equals: name,
          mode: Prisma.QueryMode.insensitive,
        },
        isActive: true,
        deletedAt: null,
        ...(excludeEntityId ? { id: { not: excludeEntityId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Commercial entity name already exists in this community',
      );
    }
  }

  private async findEntityForMutation(entityId: string): Promise<{
    id: string;
    name: string;
    communityId: string;
    unitId: string;
  }> {
    const entity = await this.prisma.commercialEntity.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        name: true,
        communityId: true,
        unitId: true,
        isActive: true,
        deletedAt: true,
      },
    });
    if (!entity || !entity.isActive || entity.deletedAt) {
      throw new NotFoundException('Commercial entity not found');
    }
    return entity;
  }

  private async findMemberForMutation(memberId: string): Promise<{
    id: string;
    entityId: string;
    userId: string;
    role: CommercialEntityMemberRole;
    permissions: Prisma.JsonValue | null;
    isActive: boolean;
    deletedAt: Date | null;
  }> {
    const member = await this.prisma.commercialEntityMember.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        entityId: true,
        userId: true,
        role: true,
        permissions: true,
        isActive: true,
        deletedAt: true,
      },
    });
    if (!member || !member.isActive || member.deletedAt) {
      throw new NotFoundException('Commercial entity member not found');
    }
    return member;
  }

  private async assertNotLastOwner(
    entityId: string,
    excludingMemberId: string,
  ): Promise<void> {
    const ownerCount = await this.prisma.commercialEntityMember.count({
      where: {
        entityId,
        role: CommercialEntityMemberRole.OWNER,
        isActive: true,
        deletedAt: null,
        id: { not: excludingMemberId },
      },
    });
    if (ownerCount === 0) {
      throw new BadRequestException(
        'Cannot deactivate the last active commercial owner',
      );
    }
  }

  private async assertActorCanManageRole(
    entityId: string,
    targetRole: CommercialEntityMemberRole,
    ctx: ActorContext,
  ): Promise<void> {
    if (this.isSystemPrivileged(ctx.actorPermissions ?? [], ctx.actorRoles ?? [])) {
      return;
    }

    const actorMember = await this.prisma.commercialEntityMember.findFirst({
      where: {
        entityId,
        userId: ctx.actorUserId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, role: true },
    });

    if (!actorMember) {
      throw new ForbiddenException(
        'Only admin, commercial owner, or commercial HR can manage members',
      );
    }

    if (actorMember.role === CommercialEntityMemberRole.OWNER) {
      if (targetRole === CommercialEntityMemberRole.OWNER) {
        throw new ForbiddenException('Owners cannot create or update owner assignments');
      }
      return;
    }

    if (actorMember.role === CommercialEntityMemberRole.HR) {
      if (targetRole !== CommercialEntityMemberRole.STAFF) {
        throw new ForbiddenException('HR can only manage STAFF members');
      }
      return;
    }

    throw new ForbiddenException('Commercial staff members cannot manage members');
  }

  private isSystemPrivileged(permissions: string[], roles: string[]): boolean {
    if (roles.some((role) => role.toUpperCase() === 'SUPER_ADMIN')) {
      return true;
    }
    return (
      permissions.includes('admin.update') ||
      permissions.includes('commercial.update') ||
      permissions.includes('commercial.create') ||
      permissions.includes('commercial.delete')
    );
  }

  private defaultPermissionsForRole(
    role: CommercialEntityMemberRole,
  ): CommercialMemberPermissions {
    if (
      role === CommercialEntityMemberRole.OWNER ||
      role === CommercialEntityMemberRole.HR
    ) {
      return {
        can_work_orders: true,
        can_attendance: true,
        can_service_requests: true,
        can_tickets: true,
        can_photo_upload: true,
        can_task_reminders: true,
      };
    }
    return { ...EMPTY_PERMISSIONS };
  }

  private normalizePermissions(
    input: Partial<CommercialMemberPermissions> | undefined,
    role: CommercialEntityMemberRole,
  ): CommercialMemberPermissions {
    const defaults = this.defaultPermissionsForRole(role);
    if (!input) {
      return defaults;
    }
    return {
      can_work_orders:
        input.can_work_orders !== undefined
          ? Boolean(input.can_work_orders)
          : defaults.can_work_orders,
      can_attendance:
        input.can_attendance !== undefined
          ? Boolean(input.can_attendance)
          : defaults.can_attendance,
      can_service_requests:
        input.can_service_requests !== undefined
          ? Boolean(input.can_service_requests)
          : defaults.can_service_requests,
      can_tickets:
        input.can_tickets !== undefined
          ? Boolean(input.can_tickets)
          : defaults.can_tickets,
      can_photo_upload:
        input.can_photo_upload !== undefined
          ? Boolean(input.can_photo_upload)
          : defaults.can_photo_upload,
      can_task_reminders:
        input.can_task_reminders !== undefined
          ? Boolean(input.can_task_reminders)
          : defaults.can_task_reminders,
    };
  }

  private mergePermissions(
    base: CommercialMemberPermissions,
    next: CommercialMemberPermissions,
  ): CommercialMemberPermissions {
    return {
      can_work_orders: next.can_work_orders ?? base.can_work_orders,
      can_attendance: next.can_attendance ?? base.can_attendance,
      can_service_requests: next.can_service_requests ?? base.can_service_requests,
      can_tickets: next.can_tickets ?? base.can_tickets,
      can_photo_upload: next.can_photo_upload ?? base.can_photo_upload,
      can_task_reminders: next.can_task_reminders ?? base.can_task_reminders,
    };
  }

  private parsePermissions(value: Prisma.JsonValue | null): CommercialMemberPermissions {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...EMPTY_PERMISSIONS };
    }

    const record = value as Record<string, unknown>;
    return {
      can_work_orders: Boolean(record.can_work_orders),
      can_attendance: Boolean(record.can_attendance),
      can_service_requests: Boolean(record.can_service_requests),
      can_tickets: Boolean(record.can_tickets),
      can_photo_upload: Boolean(record.can_photo_upload),
      can_task_reminders: Boolean(record.can_task_reminders),
    };
  }

  private mapEntity(row: EntityWithMembers): CommercialEntityResponse {
    const members = row.members.map((member) => this.mapMember(member));
    const owner = members.find(
      (member) => member.role === CommercialEntityMemberRole.OWNER && member.isActive,
    );
    const hrMembers = members.filter(
      (member) => member.role === CommercialEntityMemberRole.HR && member.isActive,
    );
    const staffMembers = members.filter(
      (member) => member.role === CommercialEntityMemberRole.STAFF && member.isActive,
    );

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      communityId: row.communityId,
      unitId: row.unitId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      owner: owner ?? null,
      hrMembers,
      staffMembers,
      memberCount: members.filter((member) => member.isActive).length,
    };
  }

  private mapMember(member: MemberRecord): CommercialEntityMemberResponse {
    return {
      id: member.id,
      entityId: member.entityId,
      userId: member.userId,
      role: member.role,
      permissions: this.parsePermissions(member.permissions),
      createdById: member.createdById,
      isActive: member.isActive,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private toJsonInput(value: CommercialMemberPermissions): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue;
  }
}
