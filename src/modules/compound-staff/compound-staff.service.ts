import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompoundStaffPermission,
  CompoundStaffStatus,
  EntityStatus,
  GateDirection,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CompoundStaffGateAccessInputDto,
  CompoundStaffScheduleInputDto,
  CreateCompoundStaffDto,
} from './dto/create-compound-staff.dto';
import { ListCompoundStaffActivityDto } from './dto/list-compound-staff-activity.dto';
import { ListCompoundStaffDto } from './dto/list-compound-staff.dto';
import {
  CompoundStaffAccessResponseDto,
  CompoundStaffActivityLogResponseDto,
  CompoundStaffGateAccessResponseDto,
  CompoundStaffResponseDto,
  CompoundStaffScheduleResponseDto,
} from './dto/compound-staff-response.dto';
import { SetCompoundStaffAccessDto } from './dto/set-compound-staff-access.dto';
import { SetCompoundStaffGatesDto } from './dto/set-compound-staff-gates.dto';
import { UpdateCompoundStaffDto } from './dto/update-compound-staff.dto';

const STAFF_INCLUDE = Prisma.validator<Prisma.CompoundStaffInclude>()({
  accesses: {
    where: { deletedAt: null, isGranted: true },
    orderBy: { permission: 'asc' },
  },
  schedules: {
    where: { isActive: true },
    orderBy: { dayOfWeek: 'asc' },
  },
  gateAccesses: {
    where: { isActive: true },
    include: {
      gate: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  activityLogs: {
    orderBy: { createdAt: 'desc' },
    take: 20,
  },
});

type StaffWithRelations = Prisma.CompoundStaffGetPayload<{
  include: typeof STAFF_INCLUDE;
}>;

type AccessRecord = Prisma.CompoundStaffAccessGetPayload<Record<string, never>>;
type ScheduleRecord = Prisma.CompoundStaffScheduleGetPayload<Record<string, never>>;
type GateAccessRecord = Prisma.CompoundStaffGateAccessGetPayload<{
  include: { gate: { select: { id: true; name: true } } };
}>;
type ActivityRecord = Prisma.CompoundStaffActivityLogGetPayload<Record<string, never>>;

@Injectable()
export class CompoundStaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCompoundStaffDto): Promise<CompoundStaffResponseDto[]> {
    const where: Prisma.CompoundStaffWhereInput = {
      ...(query.communityId ? { communityId: query.communityId } : {}),
      ...(query.commercialEntityId
        ? { commercialEntityId: query.commercialEntityId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.profession
        ? {
            profession: {
              contains: query.profession.trim(),
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
      ...(query.includeInactive ? {} : { isActive: true, deletedAt: null }),
    };

    if (query.contractExpiringSoon) {
      const now = new Date();
      const days = query.contractExpiringSoonDays ?? 30;
      const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      where.contractTo = {
        not: null,
        gte: now,
        lte: until,
      };
    }

    const rows = await this.prisma.compoundStaff.findMany({
      where,
      include: STAFF_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });

    return rows.map((row) => this.mapStaff(row));
  }

  async create(
    dto: CreateCompoundStaffDto,
    actorUserId: string,
  ): Promise<CompoundStaffResponseDto> {
    const fullName = dto.fullName.trim();
    const phone = dto.phone.trim();
    const nationalId = dto.nationalId.trim();
    const profession = dto.profession.trim();
    const jobTitle = dto.jobTitle?.trim() ?? null;
    const contractFrom = dto.contractFrom ? new Date(dto.contractFrom) : null;
    const contractTo = dto.contractTo ? new Date(dto.contractTo) : null;
    const nextStatus = dto.status ?? CompoundStaffStatus.ACTIVE;

    this.validateContractRange(contractFrom, contractTo);
    await this.assertCommunityExists(dto.communityId);

    if (dto.commercialEntityId) {
      await this.assertCommercialEntityInCommunity(
        dto.commercialEntityId,
        dto.communityId,
      );
    }
    if (dto.userId) {
      await this.ensureUserExists(dto.userId);
    }
    if (dto.photoFileId) {
      await this.ensureFileExists(dto.photoFileId);
    }
    await this.assertNationalIdUnique(dto.communityId, nationalId);
    await this.assertGateAccessesValid(dto.gateAccesses, dto.communityId);
    this.assertScheduleWindowConsistency(dto.schedules);
    if (
      nextStatus !== CompoundStaffStatus.ACTIVE &&
      ((dto.permissions?.length ?? 0) > 0 || (dto.gateAccesses?.length ?? 0) > 0)
    ) {
      throw new BadRequestException(
        'Permissions and gate access can only be assigned when staff status is ACTIVE',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const staff = await tx.compoundStaff.create({
        data: {
          communityId: dto.communityId,
          commercialEntityId: dto.commercialEntityId ?? null,
          userId: dto.userId ?? null,
          fullName,
          phone,
          nationalId,
          photoFileId: dto.photoFileId ?? null,
          profession,
          jobTitle,
          workSchedule:
            dto.workSchedule !== undefined
              ? this.toInputJson(dto.workSchedule)
              : undefined,
          contractFrom,
          contractTo,
          status: nextStatus,
          isActive: true,
        },
      });

      await this.replaceAccessTx(
        tx,
        staff.id,
        nextStatus === CompoundStaffStatus.ACTIVE ? (dto.permissions ?? []) : [],
        actorUserId,
      );
      await this.replaceSchedulesTx(tx, staff.id, dto.schedules ?? []);
      await this.replaceGateAccessTx(
        tx,
        staff.id,
        nextStatus === CompoundStaffStatus.ACTIVE ? (dto.gateAccesses ?? []) : [],
        actorUserId,
      );

      await this.logActivityTx(tx, staff.id, actorUserId, 'STAFF_CREATED', {
        status: nextStatus,
      });

      const row = await tx.compoundStaff.findUnique({
        where: { id: staff.id },
        include: STAFF_INCLUDE,
      });
      if (!row) {
        throw new NotFoundException('Compound staff not found after creation');
      }
      return row;
    });

    return this.mapStaff(created);
  }

  async getById(id: string): Promise<CompoundStaffResponseDto> {
    const row = await this.prisma.compoundStaff.findFirst({
      where: { id, isActive: true, deletedAt: null },
      include: STAFF_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException('Compound staff not found');
    }
    return this.mapStaff(row);
  }

  async update(
    id: string,
    dto: UpdateCompoundStaffDto,
    actorUserId: string,
  ): Promise<CompoundStaffResponseDto> {
    const current = await this.findStaffForMutation(id);

    const contractFrom =
      dto.contractFrom === undefined
        ? current.contractFrom
        : dto.contractFrom
          ? new Date(dto.contractFrom)
          : null;
    const contractTo =
      dto.contractTo === undefined
        ? current.contractTo
        : dto.contractTo
          ? new Date(dto.contractTo)
          : null;
    this.validateContractRange(contractFrom, contractTo);

    const nextCommunityId = dto.communityId ?? current.communityId;
    const nextCommercialEntityId =
      dto.commercialEntityId === undefined
        ? current.commercialEntityId
        : dto.commercialEntityId;

    if (!nextCommunityId) {
      throw new BadRequestException('communityId cannot be empty');
    }

    if (dto.communityId && dto.communityId !== current.communityId) {
      await this.assertCommunityExists(dto.communityId);
    }

    if (nextCommercialEntityId) {
      await this.assertCommercialEntityInCommunity(
        nextCommercialEntityId,
        nextCommunityId,
      );
    }
    if (dto.userId) {
      await this.ensureUserExists(dto.userId);
    }
    if (dto.photoFileId) {
      await this.ensureFileExists(dto.photoFileId);
    }

    const nextNationalId =
      dto.nationalId !== undefined ? dto.nationalId.trim() : current.nationalId;
    await this.assertNationalIdUnique(nextCommunityId, nextNationalId, id);
    await this.assertGateAccessesValid(dto.gateAccesses ?? undefined, nextCommunityId);
    this.assertScheduleWindowConsistency(dto.schedules ?? undefined);

    const nextStatus = dto.status ?? current.status;
    if (nextStatus !== CompoundStaffStatus.ACTIVE) {
      if (dto.gateAccesses && dto.gateAccesses.length > 0) {
        throw new BadRequestException(
          'Gate access cannot be assigned while staff status is not ACTIVE',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.compoundStaff.update({
        where: { id },
        data: {
          ...(dto.communityId !== undefined ? { communityId: dto.communityId } : {}),
          ...(dto.commercialEntityId !== undefined
            ? { commercialEntityId: dto.commercialEntityId }
            : {}),
          ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
          ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
          ...(dto.nationalId !== undefined
            ? { nationalId: dto.nationalId.trim() }
            : {}),
          ...(dto.photoFileId !== undefined ? { photoFileId: dto.photoFileId } : {}),
          ...(dto.profession !== undefined
            ? { profession: dto.profession.trim() }
            : {}),
          ...(dto.jobTitle !== undefined
            ? { jobTitle: dto.jobTitle ? dto.jobTitle.trim() : null }
            : {}),
          ...(dto.workSchedule !== undefined
            ? {
                workSchedule:
                  dto.workSchedule === null
                    ? Prisma.JsonNull
                    : this.toInputJson(dto.workSchedule),
              }
            : {}),
          contractFrom,
          contractTo,
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });

      if (dto.schedules !== undefined) {
        await this.replaceSchedulesTx(tx, id, dto.schedules ?? []);
      }

      if (dto.gateAccesses !== undefined) {
        await this.replaceGateAccessTx(tx, id, dto.gateAccesses ?? [], actorUserId);
      }

      if (dto.status !== undefined && dto.status !== CompoundStaffStatus.ACTIVE) {
        await this.replaceAccessTx(tx, id, [], actorUserId);
        await this.replaceGateAccessTx(tx, id, [], actorUserId);
      }

      await this.logActivityTx(tx, id, actorUserId, 'STAFF_UPDATED', {
        updatedFields: Object.keys(dto),
      });

      if (dto.status !== undefined && dto.status !== current.status) {
        await this.logActivityTx(tx, id, actorUserId, 'STATUS_CHANGED', {
          from: current.status,
          to: dto.status,
        });
      }

      const row = await tx.compoundStaff.findUnique({
        where: { id },
        include: STAFF_INCLUDE,
      });
      if (!row) {
        throw new NotFoundException('Compound staff not found after update');
      }
      return row;
    });

    return this.mapStaff(updated);
  }

  async remove(id: string, actorUserId: string): Promise<{ success: true }> {
    await this.findStaffForMutation(id);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.compoundStaffAccess.updateMany({
        where: { staffId: id, deletedAt: null },
        data: {
          deletedAt: now,
          isGranted: false,
        },
      });

      await tx.compoundStaffGateAccess.updateMany({
        where: { staffId: id, isActive: true },
        data: { isActive: false },
      });

      await tx.compoundStaffSchedule.updateMany({
        where: { staffId: id, isActive: true },
        data: { isActive: false },
      });

      await tx.compoundStaff.update({
        where: { id },
        data: {
          status: CompoundStaffStatus.INACTIVE,
          isActive: false,
          deletedAt: now,
        },
      });

      await this.logActivityTx(tx, id, actorUserId, 'STAFF_ARCHIVED');
    });

    return { success: true };
  }

  async getAccess(staffId: string): Promise<CompoundStaffAccessResponseDto[]> {
    await this.findStaffForMutation(staffId);

    const accesses = await this.prisma.compoundStaffAccess.findMany({
      where: {
        staffId,
        deletedAt: null,
        isGranted: true,
      },
      orderBy: { permission: 'asc' },
    });

    return accesses.map((access) => this.mapAccess(access));
  }

  async setAccess(
    staffId: string,
    dto: SetCompoundStaffAccessDto,
    actorUserId: string,
  ): Promise<CompoundStaffAccessResponseDto[]> {
    const staff = await this.findStaffForMutation(staffId);
    if (staff.status !== CompoundStaffStatus.ACTIVE) {
      throw new BadRequestException('Cannot set access for a non-active staff member');
    }

    const accesses = await this.prisma.$transaction((tx) =>
      this.replaceAccessTx(tx, staffId, dto.permissions, actorUserId),
    );

    await this.prisma.compoundStaffActivityLog.create({
      data: {
        staffId,
        actorUserId,
        action: 'PERMISSIONS_UPDATED',
        metadata: { permissions: dto.permissions },
      },
    });

    return accesses;
  }

  async getGateAccesses(staffId: string): Promise<CompoundStaffGateAccessResponseDto[]> {
    await this.findStaffForMutation(staffId);

    const rows = await this.prisma.compoundStaffGateAccess.findMany({
      where: { staffId, isActive: true },
      include: {
        gate: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => this.mapGateAccess(row));
  }

  async setGateAccesses(
    staffId: string,
    dto: SetCompoundStaffGatesDto,
    actorUserId: string,
  ): Promise<CompoundStaffGateAccessResponseDto[]> {
    const staff = await this.findStaffForMutation(staffId);
    if (staff.status !== CompoundStaffStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot set gate access for a non-active staff member',
      );
    }

    await this.assertGateAccessesValid(dto.gateAccesses, staff.communityId);

    const rows = await this.prisma.$transaction((tx) =>
      this.replaceGateAccessTx(tx, staffId, dto.gateAccesses, actorUserId),
    );

    await this.prisma.compoundStaffActivityLog.create({
      data: {
        staffId,
        actorUserId,
        action: 'GATE_ACCESS_UPDATED',
        metadata: {
          gateIds: dto.gateAccesses.map((item) => item.gateId),
        },
      },
    });

    return rows;
  }

  async getActivityLogs(
    staffId: string,
    query: ListCompoundStaffActivityDto,
  ): Promise<CompoundStaffActivityLogResponseDto[]> {
    await this.findStaffForMutation(staffId);
    const limit = query.limit ?? 20;

    const rows = await this.prisma.compoundStaffActivityLog.findMany({
      where: { staffId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => this.mapActivity(row));
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

  private async ensureFileExists(fileId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: { id: true },
    });
    if (!file) {
      throw new NotFoundException('Photo file not found');
    }
  }

  private async assertCommunityExists(communityId: string): Promise<void> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, isActive: true },
    });
    if (!community || !community.isActive) {
      throw new NotFoundException('Community not found');
    }
  }

  private async assertCommercialEntityInCommunity(
    commercialEntityId: string,
    communityId: string,
  ): Promise<void> {
    const entity = await this.prisma.commercialEntity.findFirst({
      where: {
        id: commercialEntityId,
        communityId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!entity) {
      throw new NotFoundException(
        'Commercial entity not found in selected community',
      );
    }
  }

  private async assertNationalIdUnique(
    communityId: string,
    nationalId: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const existing = await this.prisma.compoundStaff.findFirst({
      where: {
        communityId,
        nationalId,
        ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'A compound staff profile with this national ID already exists in this community',
      );
    }
  }

  private async assertGateAccessesValid(
    gateAccesses: CompoundStaffGateAccessInputDto[] | undefined,
    communityId: string | null,
  ): Promise<void> {
    if (!gateAccesses || gateAccesses.length === 0) {
      return;
    }

    if (!communityId) {
      throw new BadRequestException(
        'communityId is required before assigning gate access',
      );
    }

    const gateIds = Array.from(new Set(gateAccesses.map((item) => item.gateId)));
    const gates = await this.prisma.gate.findMany({
      where: {
        id: { in: gateIds },
        deletedAt: null,
      },
      select: {
        id: true,
        communityId: true,
        status: true,
      },
    });

    if (gates.length !== gateIds.length) {
      throw new NotFoundException('One or more gates were not found');
    }

    const invalid = gates.find(
      (gate) =>
        gate.communityId !== communityId || gate.status !== EntityStatus.ACTIVE,
    );
    if (invalid) {
      throw new BadRequestException(
        'All gates must be active and belong to the same community as the staff profile',
      );
    }
  }

  private assertScheduleWindowConsistency(
    schedules: CompoundStaffScheduleInputDto[] | null | undefined,
  ): void {
    if (!schedules) {
      return;
    }

    for (const schedule of schedules) {
      if (
        schedule.startTime &&
        schedule.endTime &&
        schedule.endTime <= schedule.startTime
      ) {
        throw new BadRequestException(
          `endTime must be later than startTime for ${schedule.dayOfWeek}`,
        );
      }
    }
  }

  private validateContractRange(
    contractFrom: Date | null,
    contractTo: Date | null,
  ): void {
    if (contractFrom && Number.isNaN(contractFrom.getTime())) {
      throw new BadRequestException('Invalid contractFrom date');
    }
    if (contractTo && Number.isNaN(contractTo.getTime())) {
      throw new BadRequestException('Invalid contractTo date');
    }
    if (contractFrom && contractTo && contractTo <= contractFrom) {
      throw new BadRequestException('contractTo must be after contractFrom');
    }
  }

  private async findStaffForMutation(id: string): Promise<{
    id: string;
    communityId: string | null;
    commercialEntityId: string | null;
    nationalId: string;
    contractFrom: Date | null;
    contractTo: Date | null;
    status: CompoundStaffStatus;
  }> {
    const row = await this.prisma.compoundStaff.findUnique({
      where: { id },
      select: {
        id: true,
        communityId: true,
        commercialEntityId: true,
        nationalId: true,
        contractFrom: true,
        contractTo: true,
        status: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (!row || !row.isActive || row.deletedAt) {
      throw new NotFoundException('Compound staff not found');
    }

    return row;
  }

  private async replaceAccessTx(
    tx: Prisma.TransactionClient,
    staffId: string,
    permissions: CompoundStaffPermission[],
    actorUserId: string,
  ): Promise<CompoundStaffAccessResponseDto[]> {
    const now = new Date();
    const uniquePermissions = Array.from(new Set(permissions));

    await tx.compoundStaffAccess.updateMany({
      where: {
        staffId,
        deletedAt: null,
      },
      data: {
        deletedAt: now,
        isGranted: false,
      },
    });

    for (const permission of uniquePermissions) {
      await tx.compoundStaffAccess.upsert({
        where: {
          staffId_permission: {
            staffId,
            permission,
          },
        },
        create: {
          staffId,
          permission,
          isGranted: true,
          grantedById: actorUserId,
        },
        update: {
          deletedAt: null,
          isGranted: true,
          grantedById: actorUserId,
        },
      });
    }

    const accesses = await tx.compoundStaffAccess.findMany({
      where: {
        staffId,
        deletedAt: null,
        isGranted: true,
      },
      orderBy: { permission: 'asc' },
    });

    return accesses.map((access) => this.mapAccess(access));
  }

  private async replaceSchedulesTx(
    tx: Prisma.TransactionClient,
    staffId: string,
    schedules: CompoundStaffScheduleInputDto[],
  ): Promise<CompoundStaffScheduleResponseDto[]> {
    await tx.compoundStaffSchedule.updateMany({
      where: { staffId, isActive: true },
      data: { isActive: false },
    });

    for (const schedule of schedules) {
      await tx.compoundStaffSchedule.upsert({
        where: {
          staffId_dayOfWeek: {
            staffId,
            dayOfWeek: schedule.dayOfWeek,
          },
        },
        create: {
          staffId,
          dayOfWeek: schedule.dayOfWeek,
          startTime: schedule.startTime ?? null,
          endTime: schedule.endTime ?? null,
          notes: schedule.notes ?? null,
          isActive: schedule.isActive ?? true,
        },
        update: {
          startTime: schedule.startTime ?? null,
          endTime: schedule.endTime ?? null,
          notes: schedule.notes ?? null,
          isActive: schedule.isActive ?? true,
        },
      });
    }

    const rows = await tx.compoundStaffSchedule.findMany({
      where: { staffId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    return rows.map((row) => this.mapSchedule(row));
  }

  private async replaceGateAccessTx(
    tx: Prisma.TransactionClient,
    staffId: string,
    gateAccesses: CompoundStaffGateAccessInputDto[],
    actorUserId: string,
  ): Promise<CompoundStaffGateAccessResponseDto[]> {
    await tx.compoundStaffGateAccess.updateMany({
      where: { staffId, isActive: true },
      data: { isActive: false },
    });

    for (const access of gateAccesses) {
      const directions = access.directions ?? [
        GateDirection.ENTRY,
        GateDirection.EXIT,
      ];
      await tx.compoundStaffGateAccess.upsert({
        where: {
          staffId_gateId: {
            staffId,
            gateId: access.gateId,
          },
        },
        create: {
          staffId,
          gateId: access.gateId,
          directions,
          isActive: true,
          grantedById: actorUserId,
        },
        update: {
          directions,
          isActive: true,
          grantedById: actorUserId,
        },
      });
    }

    const rows = await tx.compoundStaffGateAccess.findMany({
      where: { staffId, isActive: true },
      include: {
        gate: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => this.mapGateAccess(row));
  }

  private async logActivityTx(
    tx: Prisma.TransactionClient,
    staffId: string,
    actorUserId: string | null,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await tx.compoundStaffActivityLog.create({
      data: {
        staffId,
        actorUserId,
        action,
        metadata: metadata ? this.toInputJson(metadata) : undefined,
      },
    });
  }

  private mapStaff(row: StaffWithRelations): CompoundStaffResponseDto {
    return {
      id: row.id,
      communityId: row.communityId,
      commercialEntityId: row.commercialEntityId,
      userId: row.userId,
      fullName: row.fullName,
      phone: row.phone,
      nationalId: row.nationalId,
      photoFileId: row.photoFileId,
      profession: row.profession,
      jobTitle: row.jobTitle,
      workSchedule: row.workSchedule,
      contractFrom: row.contractFrom,
      contractTo: row.contractTo,
      status: row.status,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      accesses: row.accesses.map((access) => this.mapAccess(access)),
      schedules: row.schedules.map((schedule) => this.mapSchedule(schedule)),
      gateAccesses: row.gateAccesses.map((gateAccess) =>
        this.mapGateAccess(gateAccess),
      ),
      activityLogs: row.activityLogs.map((activity) => this.mapActivity(activity)),
    };
  }

  private mapAccess(row: AccessRecord): CompoundStaffAccessResponseDto {
    return {
      id: row.id,
      staffId: row.staffId,
      permission: row.permission,
      isGranted: row.isGranted,
      grantedById: row.grantedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSchedule(row: ScheduleRecord): CompoundStaffScheduleResponseDto {
    return {
      id: row.id,
      staffId: row.staffId,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      notes: row.notes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapGateAccess(row: GateAccessRecord): CompoundStaffGateAccessResponseDto {
    return {
      id: row.id,
      staffId: row.staffId,
      gateId: row.gateId,
      gateName: row.gate.name,
      directions: row.directions,
      isActive: row.isActive,
      grantedById: row.grantedById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapActivity(row: ActivityRecord): CompoundStaffActivityLogResponseDto {
    return {
      id: row.id,
      staffId: row.staffId,
      actorUserId: row.actorUserId,
      action: row.action,
      metadata: row.metadata,
      createdAt: row.createdAt,
    };
  }

  private toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  async getAttendance(staffId: string) {
    await this.findStaffForMutation(staffId);
    const logs = await this.prisma.attendanceLog.findMany({
      where: { staffId },
      orderBy: { clockInAt: 'desc' },
      take: 50,
      select: {
        id: true,
        clockInAt: true,
        clockOutAt: true,
        durationMin: true,
        notes: true,
        recordedById: true,
        createdAt: true,
      },
    });
    return { data: logs, total: logs.length };
  }

  async clockIn(staffId: string, adminUserId: string) {
    await this.findStaffForMutation(staffId);

    // Check no open session exists
    const openSession = await this.prisma.attendanceLog.findFirst({
      where: { staffId, clockOutAt: null },
      select: { id: true, clockInAt: true },
    });
    if (openSession) {
      throw new BadRequestException(
        `Staff already has an open clock-in session since ${openSession.clockInAt.toISOString()}. Clock out first.`,
      );
    }

    const log = await this.prisma.attendanceLog.create({
      data: {
        staffId,
        recordedById: adminUserId,
      },
      select: {
        id: true,
        staffId: true,
        clockInAt: true,
        clockOutAt: true,
        durationMin: true,
        notes: true,
        recordedById: true,
        createdAt: true,
      },
    });

    return log;
  }

  async clockOut(staffId: string, adminUserId: string) {
    await this.findStaffForMutation(staffId);

    const openSession = await this.prisma.attendanceLog.findFirst({
      where: { staffId, clockOutAt: null },
      orderBy: { clockInAt: 'desc' },
      select: { id: true, clockInAt: true },
    });
    if (!openSession) {
      throw new BadRequestException('No open clock-in session found for this staff member.');
    }

    const now = new Date();
    const durationMin = Math.round(
      (now.getTime() - openSession.clockInAt.getTime()) / (1000 * 60),
    );

    const log = await this.prisma.attendanceLog.update({
      where: { id: openSession.id },
      data: {
        clockOutAt: now,
        durationMin,
        recordedById: adminUserId,
      },
      select: {
        id: true,
        staffId: true,
        clockInAt: true,
        clockOutAt: true,
        durationMin: true,
        notes: true,
        recordedById: true,
        createdAt: true,
      },
    });

    return log;
  }
}
