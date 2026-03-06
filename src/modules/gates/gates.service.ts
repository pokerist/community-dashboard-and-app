import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessStatus, EntityStatus, GateRole, Prisma, QRType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommunityGateDto } from './dto/create-community-gate.dto';
import { CreateGateDto } from './dto/create-gate.dto';
import { CreateGateRequestDto } from './dto/create-gate-request.dto';
import {
  GateResponseDto,
  GateUnitAccessResponseDto,
} from './dto/gate-response.dto';
import {
  GateLogItemResponseDto,
  PaginatedGateLogResponseDto,
} from './dto/gate-log-response.dto';
import { GateStatsResponseDto } from './dto/gate-stats-response.dto';
import { GateLogStatusFilter, ListGateLogsDto } from './dto/list-gate-logs.dto';
import { ListGatesDto } from './dto/list-gates.dto';
import { SetGateUnitsDto } from './dto/set-gate-units.dto';
import { UpdateGateDto } from './dto/update-gate.dto';

const gateWithUnitsInclude = {
  unitAccesses: {
    where: { deletedAt: null },
    select: { unitId: true },
  },
} as const;

type GateWithUnitsRow = Prisma.GateGetPayload<{
  include: typeof gateWithUnitsInclude;
}>;

type GateUnitAccessRow = Prisma.GateUnitAccessGetPayload<object>;

type AccessQrLogRow = Prisma.AccessQRCodeGetPayload<{
  select: {
    id: true;
    visitorName: true;
    requesterNameSnapshot: true;
    type: true;
    status: true;
    checkedInAt: true;
    checkedOutAt: true;
    forUnit: {
      select: {
        unitNumber: true;
      };
    };
    gateOperator: {
      select: {
        nameEN: true;
        nameAR: true;
      };
    };
  };
}>;

@Injectable()
export class GatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListGatesDto): Promise<GateResponseDto[]> {
    if (!query.communityId) {
      const rows = await this.prisma.gate.findMany({
        where: {
          deletedAt: null,
          ...(query.includeInactive ? {} : { isActive: true }),
        },
        include: gateWithUnitsInclude,
        orderBy: [{ name: 'asc' }],
      });
      return rows.map((row) => this.mapGate(row));
    }

    return this.listGates(query.communityId, query.includeInactive ?? false);
  }

  async listGates(communityId: string, includeInactive = false): Promise<GateResponseDto[]> {
    await this.assertCommunityExists(communityId);

    const rows = await this.prisma.gate.findMany({
      where: {
        communityId,
        deletedAt: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: gateWithUnitsInclude,
      orderBy: [{ name: 'asc' }],
    });

    return rows.map((row) => this.mapGate(row));
  }

  async listCommunityGates(communityId: string): Promise<GateResponseDto[]> {
    return this.listGates(communityId, false);
  }

  async create(payload: CreateGateRequestDto): Promise<GateResponseDto> {
    const { communityId, ...dto } = payload;
    return this.createGate(communityId, dto);
  }

  async createGate(communityId: string, dto: CreateGateDto): Promise<GateResponseDto> {
    await this.assertCommunityExists(communityId);
    await this.assertNoNameDuplicate(communityId, dto.name);

    const created = await this.prisma.gate.create({
      data: {
        communityId,
        name: dto.name.trim(),
        code: this.normalizeCode(dto.code),
        status: dto.status ?? EntityStatus.ACTIVE,
        allowedRoles: this.normalizeRoles(dto.allowedRoles),
        etaMinutes: dto.etaMinutes ?? null,
        isActive: true,
        isVisitorRequestRequired: dto.isVisitorRequestRequired ?? false,
      },
      include: gateWithUnitsInclude,
    });

    return this.mapGate(created);
  }

  async createForCommunity(
    communityId: string,
    dto: CreateCommunityGateDto,
  ): Promise<GateResponseDto> {
    return this.createGate(communityId, dto);
  }

  async getById(id: string): Promise<GateResponseDto> {
    const row = await this.prisma.gate.findFirst({
      where: { id, deletedAt: null },
      include: gateWithUnitsInclude,
    });

    if (!row) {
      throw new NotFoundException('Gate not found');
    }

    return this.mapGate(row);
  }

  async update(id: string, dto: UpdateGateDto): Promise<GateResponseDto> {
    return this.updateGate(id, dto);
  }

  async updateGate(id: string, dto: UpdateGateDto): Promise<GateResponseDto> {
    const current = await this.prisma.gate.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        communityId: true,
        name: true,
      },
    });
    if (!current) {
      throw new NotFoundException('Gate not found');
    }

    if (dto.name !== undefined) {
      await this.assertNoNameDuplicate(current.communityId, dto.name, id);
    }

    const updated = await this.prisma.gate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
        ...(dto.allowedRoles !== undefined
          ? { allowedRoles: this.normalizeRoles(dto.allowedRoles) }
          : {}),
        ...(dto.etaMinutes !== undefined ? { etaMinutes: dto.etaMinutes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isVisitorRequestRequired !== undefined
          ? { isVisitorRequestRequired: dto.isVisitorRequestRequired }
          : {}),
      },
      include: gateWithUnitsInclude,
    });

    return this.mapGate(updated);
  }

  async updateGateRoles(id: string, roles: GateRole[]): Promise<GateResponseDto> {
    const gate = await this.prisma.gate.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate not found');
    }

    const updated = await this.prisma.gate.update({
      where: { id },
      data: {
        allowedRoles: this.normalizeRoles(roles),
      },
      include: gateWithUnitsInclude,
    });

    return this.mapGate(updated);
  }

  async remove(id: string): Promise<{ success: true }> {
    return this.softDeleteGate(id);
  }

  async softDeleteGate(id: string): Promise<{ success: true }> {
    const gate = await this.prisma.gate.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate not found');
    }

    const activeQrCodes = await this.prisma.accessQRCode.count({
      where: {
        status: AccessStatus.ACTIVE,
        gates: { has: id },
      },
    });

    if (activeQrCodes > 0) {
      throw new BadRequestException('Gate has active QR codes. Revoke them first.');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.gateUnitAccess.updateMany({
        where: { gateId: id, deletedAt: null },
        data: { deletedAt: now },
      });

      await tx.gate.update({
        where: { id },
        data: {
          status: EntityStatus.INACTIVE,
          isActive: false,
          deletedAt: now,
        },
      });
    });

    return { success: true };
  }

  async listUnits(gateId: string): Promise<GateUnitAccessResponseDto[]> {
    await this.assertGateExists(gateId);

    const rows = await this.prisma.gateUnitAccess.findMany({
      where: {
        gateId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return rows.map((row) => this.mapGateUnitAccess(row));
  }

  async setUnits(gateId: string, dto: SetGateUnitsDto): Promise<GateUnitAccessResponseDto[]> {
    const gate = await this.prisma.gate.findFirst({
      where: { id: gateId, deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate not found');
    }

    const unitIds = Array.from(new Set(dto.unitIds));
    if (unitIds.length > 0) {
      const units = await this.prisma.unit.findMany({
        where: { id: { in: unitIds } },
        select: {
          id: true,
          communityId: true,
          deletedAt: true,
          isActive: true,
        },
      });

      if (units.length !== unitIds.length) {
        throw new NotFoundException('One or more units were not found');
      }

      const invalid = units.find(
        (unit) =>
          !unit.isActive ||
          unit.deletedAt !== null ||
          unit.communityId !== gate.communityId,
      );

      if (invalid) {
        throw new BadRequestException(
          'All units must be active and belong to the same community as the gate',
        );
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (unitIds.length === 0) {
        await tx.gateUnitAccess.updateMany({
          where: {
            gateId,
            deletedAt: null,
          },
          data: { deletedAt: now },
        });
      } else {
        await tx.gateUnitAccess.updateMany({
          where: {
            gateId,
            deletedAt: null,
            unitId: {
              notIn: unitIds,
            },
          },
          data: { deletedAt: now },
        });
      }

      for (const unitId of unitIds) {
        await tx.gateUnitAccess.upsert({
          where: {
            gateId_unitId: {
              gateId,
              unitId,
            },
          },
          create: {
            gateId,
            unitId,
          },
          update: {
            deletedAt: null,
          },
        });
      }
    });

    return this.listUnits(gateId);
  }

  async listGatesForUnit(unitId: string): Promise<GateResponseDto[]> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const rows = await this.prisma.gate.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        status: EntityStatus.ACTIVE,
        unitAccesses: {
          some: {
            unitId,
            deletedAt: null,
          },
        },
      },
      include: gateWithUnitsInclude,
      orderBy: [{ name: 'asc' }],
    });

    return rows.map((row) => this.mapGate(row));
  }

  async listLogs(query: ListGateLogsDto): Promise<PaginatedGateLogResponseDto> {
    return this.getGateLog(query.gateId ?? null, query);
  }

  async getGateLog(
    gateId: string | null,
    query: ListGateLogsDto,
  ): Promise<PaginatedGateLogResponseDto> {
    if (gateId) {
      await this.assertGateExists(gateId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    let communityGateIds: string[] = [];
    if (!gateId && query.communityId) {
      await this.assertCommunityExists(query.communityId);
      const communityGates = await this.prisma.gate.findMany({
        where: {
          communityId: query.communityId,
          deletedAt: null,
        },
        select: { id: true },
      });
      communityGateIds = communityGates.map((gate) => gate.id);
      if (communityGateIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
        };
      }
    }

    const where: Prisma.AccessQRCodeWhereInput = {
      ...(gateId ? { gates: { has: gateId } } : {}),
      ...(!gateId && communityGateIds.length > 0
        ? { gates: { hasSome: communityGateIds } }
        : {}),
      ...(query.qrType ? { type: query.qrType } : {}),
      ...(from || to
        ? {
            checkedInAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    if (query.status === GateLogStatusFilter.INSIDE) {
      const checkedInFilter =
        where.checkedInAt && typeof where.checkedInAt === 'object'
          ? (where.checkedInAt as Prisma.DateTimeNullableFilter)
          : {};
      where.checkedInAt = { ...checkedInFilter, not: null };
      where.checkedOutAt = null;
    }

    if (query.status === GateLogStatusFilter.EXITED) {
      where.checkedOutAt = { not: null };
    }

    if (query.status === GateLogStatusFilter.ACTIVE) {
      where.status = AccessStatus.ACTIVE;
    }

    const [total, rows] = await Promise.all([
      this.prisma.accessQRCode.count({ where }),
      this.prisma.accessQRCode.findMany({
        where,
        select: {
          id: true,
          visitorName: true,
          requesterNameSnapshot: true,
          type: true,
          status: true,
          checkedInAt: true,
          checkedOutAt: true,
          forUnit: {
            select: {
              unitNumber: true,
            },
          },
          gateOperator: {
            select: {
              nameEN: true,
              nameAR: true,
            },
          },
        },
        orderBy: [{ checkedInAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map((row) => this.mapGateLog(row)),
      total,
      page,
      limit,
    };
  }

  async getGateStats(communityId: string): Promise<GateStatsResponseDto> {
    await this.assertCommunityExists(communityId);

    const [totalGates, activeGates, gates] = await Promise.all([
      this.prisma.gate.count({
        where: {
          communityId,
          deletedAt: null,
        },
      }),
      this.prisma.gate.count({
        where: {
          communityId,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.gate.findMany({
        where: {
          communityId,
          deletedAt: null,
        },
        select: { id: true },
      }),
    ]);

    const gateIds = gates.map((gate) => gate.id);
    if (gateIds.length === 0) {
      return {
        totalGates,
        activeGates,
        todayEntries: 0,
        currentlyInside: 0,
        todayVisitors: 0,
        todayDeliveries: 0,
      };
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const baseWhere: Prisma.AccessQRCodeWhereInput = {
      gates: { hasSome: gateIds },
    };

    const [todayEntries, currentlyInside, todayVisitors, todayDeliveries] =
      await Promise.all([
        this.prisma.accessQRCode.count({
          where: {
            ...baseWhere,
            checkedInAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        }),
        this.prisma.accessQRCode.count({
          where: {
            ...baseWhere,
            checkedInAt: { not: null },
            checkedOutAt: null,
          },
        }),
        this.prisma.accessQRCode.count({
          where: {
            ...baseWhere,
            type: QRType.VISITOR,
            checkedInAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        }),
        this.prisma.accessQRCode.count({
          where: {
            ...baseWhere,
            type: QRType.DELIVERY,
            checkedInAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        }),
      ]);

    return {
      totalGates,
      activeGates,
      todayEntries,
      currentlyInside,
      todayVisitors,
      todayDeliveries,
    };
  }

  private normalizeCode(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed.toUpperCase() : null;
  }

  private normalizeRoles(value: GateRole[]): GateRole[] {
    if (value.length === 0) {
      throw new BadRequestException('allowedRoles must contain at least one role');
    }
    return Array.from(new Set(value));
  }

  private async assertCommunityExists(communityId: string): Promise<void> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }
  }

  private async assertNoNameDuplicate(
    communityId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.gate.findFirst({
      where: {
        communityId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        name: { equals: name.trim(), mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Gate name already exists in this community');
    }
  }

  private async assertGateExists(gateId: string): Promise<void> {
    const gate = await this.prisma.gate.findFirst({
      where: { id: gateId, deletedAt: null },
      select: { id: true },
    });
    if (!gate) {
      throw new NotFoundException('Gate not found');
    }
  }

  private mapGate(row: GateWithUnitsRow): GateResponseDto {
    const unitIds = row.unitAccesses.map((item) => item.unitId);
    return {
      id: row.id,
      communityId: row.communityId,
      name: row.name,
      code: row.code,
      status: row.status,
      allowedRoles: row.allowedRoles,
      etaMinutes: row.etaMinutes,
      isVisitorRequestRequired: row.isVisitorRequestRequired,
      unitIds,
      unitCount: unitIds.length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapGateUnitAccess(row: GateUnitAccessRow): GateUnitAccessResponseDto {
    return {
      id: row.id,
      gateId: row.gateId,
      unitId: row.unitId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapGateLog(row: AccessQrLogRow): GateLogItemResponseDto {
    const checkedInAt = row.checkedInAt ? row.checkedInAt.toISOString() : null;
    const checkedOutAt = row.checkedOutAt ? row.checkedOutAt.toISOString() : null;

    let durationMinutes: number | null = null;
    if (row.checkedInAt && row.checkedOutAt) {
      const diffMs = row.checkedOutAt.getTime() - row.checkedInAt.getTime();
      durationMinutes = diffMs >= 0 ? Math.ceil(diffMs / 60000) : null;
    }

    return {
      id: row.id,
      visitorName: row.visitorName,
      requesterName: row.requesterNameSnapshot,
      unitNumber: row.forUnit?.unitNumber ?? null,
      qrType: row.type,
      status: row.status,
      checkedInAt,
      checkedOutAt,
      durationMinutes,
      gateOperatorName: row.gateOperator?.nameEN ?? row.gateOperator?.nameAR ?? null,
    };
  }
}
