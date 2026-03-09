import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  GateAccessMode,
  GateRole,
  InvoiceStatus,
  Prisma,
  UnitAccessRole,
  UnitCategory,
  UnitStatus,
  UnitType,
  UserStatusLogSource,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { paginate } from '../../common/utils/pagination.util';
import { UnitStatusChangedEvent } from '../../events/contracts/unit-status-changed.event';
import { AssignUserDto } from './dto/assign-user.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { DeactivateUnitDto } from './dto/deactivate-unit.dto';
import { UnitDisplayStatus, UnitQueryDto } from './dto/unit-query.dto';
import { UnitDetailResponse, UnitListItem } from './dto/unit-response.dto';
import { UpdateUnitGateAccessDto } from './dto/update-unit-gate-access.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

const COMMERCIAL_TYPES: UnitType[] = [UnitType.ADMINISTRATIVE, UnitType.COMMERCIAL_UNIT];

function deriveCategory(type: UnitType, explicit?: UnitCategory): UnitCategory {
  if (explicit) return explicit;
  return COMMERCIAL_TYPES.includes(type) ? UnitCategory.COMMERCIAL : UnitCategory.RESIDENTIAL;
}

interface UnitListRecord {
  id: string;
  communityId: string | null;
  clusterId: string | null;
  unitNumber: string;
  block: string | null;
  category: UnitCategory;
  type: UnitType;
  status: UnitStatus;
  isDelivered: boolean;
  isActive: boolean;
  bedrooms: number | null;
  sizeSqm: number | null;
  price: Prisma.Decimal | null;
  createdAt: Date;
  community: { name: string } | null;
  cluster: { name: string } | null;
  residents: Array<{ id: string }>;
}

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private mapDisplayStatus(unit: {
    status: UnitStatus;
  }): UnitDisplayStatus {
    return unit.status as string as UnitDisplayStatus;
  }

  private normalizeUnitStatus(
    rawStatus?: string,
    fieldName: 'status' | 'displayStatus' = 'status',
  ): UnitStatus | undefined {
    if (!rawStatus) return undefined;

    switch (rawStatus) {
      case UnitStatus.OFF_PLAN:
        return UnitStatus.OFF_PLAN;
      case UnitStatus.UNDER_CONSTRUCTION:
      case 'NOT_DELIVERED':
        return UnitStatus.UNDER_CONSTRUCTION;
      case UnitStatus.DELIVERED:
      case 'AVAILABLE':
      case 'OCCUPIED':
      case 'LEASED':
      case 'HELD':
      case 'UNRELEASED':
      case 'RENTED':
        return UnitStatus.DELIVERED;
      default:
        throw new BadRequestException(
          `${fieldName} must be one of OFF_PLAN, UNDER_CONSTRUCTION, DELIVERED`,
        );
    }
  }

  private displayStatusWhere(
    status?: UnitDisplayStatus | string,
  ): Prisma.UnitWhereInput {
    const normalized = this.normalizeUnitStatus(status, 'displayStatus');
    if (!normalized) return {};
    return { status: normalized };
  }

  private activeFilterWhere(params: {
    includeInactive?: boolean;
    isActive?: boolean;
  }): Prisma.UnitWhereInput {
    if (params.isActive !== undefined) {
      return params.isActive
        ? { isActive: true, deletedAt: null }
        : { isActive: false };
    }

    if (params.includeInactive) {
      return {};
    }

    return { isActive: true, deletedAt: null };
  }

  private mapUnitListItem(record: UnitListRecord): UnitListItem {
    return {
      id: record.id,
      communityId: record.communityId,
      clusterId: record.clusterId,
      unitNumber: record.unitNumber,
      block: record.block,
      category: record.category,
      type: record.type,
      status: record.status,
      displayStatus: this.mapDisplayStatus(record),
      isDelivered: record.isDelivered,
      isActive: record.isActive,
      communityName: record.community?.name ?? '-',
      clusterName: record.cluster?.name ?? null,
      bedrooms: record.bedrooms,
      sizeSqm: record.sizeSqm,
      price: record.price ? Number(record.price) : null,
      residentCount: record.residents.length,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private async resolveResidentId(
    tx: Prisma.TransactionClient,
    idOrUserId: string,
  ): Promise<string> {
    const byResidentId = await tx.resident.findUnique({
      where: { id: idOrUserId },
      select: { id: true },
    });
    if (byResidentId) return byResidentId.id;

    const byUserId = await tx.resident.findUnique({
      where: { userId: idOrUserId },
      select: { id: true },
    });
    if (byUserId) return byUserId.id;

    throw new NotFoundException('Resident not found');
  }

  private async assertCommunity(communityId: string): Promise<{ id: string; name: string }> {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, isActive: true },
    });
    if (!community) {
      throw new BadRequestException('Selected community does not exist');
    }
    if (!community.isActive) {
      throw new BadRequestException('Selected community is inactive');
    }
    return { id: community.id, name: community.name };
  }

  private async assertClusterBelongsToCommunity(
    clusterId: string,
    communityId: string,
  ): Promise<void> {
    const cluster = await this.prisma.cluster.findFirst({
      where: {
        id: clusterId,
        communityId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!cluster) {
      throw new BadRequestException(
        'clusterId is invalid for the selected community',
      );
    }
  }

  private async assertGateIdsBelongToCommunity(
    gateIds: string[],
    communityId: string,
  ): Promise<void> {
    if (gateIds.length === 0) return;

    const gates = await this.prisma.gate.findMany({
      where: {
        id: { in: gateIds },
        communityId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (gates.length !== gateIds.length) {
      throw new BadRequestException(
        'allowedGateIds must belong to active gates in the same community',
      );
    }
  }

  private async validateGateAccessConfig(params: {
    communityId: string;
    gateAccessMode: GateAccessMode;
    allowedGateIds: string[];
  }): Promise<string[]> {
    const normalizedGateIds = Array.from(new Set(params.allowedGateIds));

    if (params.gateAccessMode === GateAccessMode.SELECTED_GATES) {
      if (normalizedGateIds.length === 0) {
        throw new BadRequestException(
          'allowedGateIds is required when gateAccessMode is SELECTED_GATES',
        );
      }
      await this.assertGateIdsBelongToCommunity(normalizedGateIds, params.communityId);
      return normalizedGateIds;
    }

    return [];
  }

  async findAll(query: UnitQueryDto) {
    const {
      type,
      status,
      category,
      block,
      communityId,
      clusterId,
      displayStatus,
      includeInactive,
      isActive,
      ...baseQuery
    } = query;
    const normalizedStatus = this.normalizeUnitStatus(status, 'status');

    const where: Prisma.UnitWhereInput = {
      ...(type ? { type } : {}),
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(category ? { category } : {}),
      ...(block ? { block } : {}),
      ...(communityId ? { communityId } : {}),
      ...(clusterId ? { clusterId } : {}),
      ...this.displayStatusWhere(displayStatus),
      ...this.activeFilterWhere({ includeInactive, isActive }),
    };

    const result = await paginate<UnitListRecord>(this.prisma.unit, baseQuery, {
      searchFields: ['unitNumber', 'projectName', 'block'],
      where,
      include: {
        community: { select: { name: true } },
        cluster: { select: { name: true } },
        residents: { select: { id: true } },
      },
    });

    return {
      ...result,
      data: result.data.map((row) => this.mapUnitListItem(row)),
    };
  }

  async findMyUnits(
    actorUserId: string,
    query: UnitQueryDto,
    context?: { permissions?: string[]; roles?: string[] },
  ) {
    const permissions = Array.isArray(context?.permissions)
      ? context.permissions
      : [];
    if (permissions.includes('unit.view_all')) {
      return this.findAll(query);
    }

    const {
      type,
      status,
      block,
      communityId,
      clusterId,
      displayStatus,
      includeInactive,
      isActive,
      ...baseQuery
    } = query;
    const normalizedStatus = this.normalizeUnitStatus(status, 'status');

    const where: Prisma.UnitWhereInput = {
      ...(type ? { type } : {}),
      ...(normalizedStatus ? { status: normalizedStatus } : {}),
      ...(block ? { block } : {}),
      ...(communityId ? { communityId } : {}),
      ...(clusterId ? { clusterId } : {}),
      ...this.displayStatusWhere(displayStatus),
      ...this.activeFilterWhere({ includeInactive, isActive }),
      OR: [
        {
          unitAccesses: {
            some: {
              userId: actorUserId,
              status: 'ACTIVE',
            },
          },
        },
        {
          residents: {
            some: {
              resident: {
                userId: actorUserId,
              },
            },
          },
        },
      ],
    };

    const result = await paginate<UnitListRecord>(this.prisma.unit, baseQuery, {
      searchFields: ['unitNumber', 'projectName', 'block'],
      where,
      include: {
        community: { select: { name: true } },
        cluster: { select: { name: true } },
        residents: { select: { id: true } },
      },
    });

    return {
      ...result,
      data: result.data.map((row) => this.mapUnitListItem(row)),
    };
  }

  async findOne(id: string): Promise<UnitDetailResponse> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        community: { select: { name: true } },
        cluster: { select: { name: true } },
        residents: {
          include: {
            resident: {
              include: {
                user: {
                  select: {
                    id: true,
                    nameEN: true,
                    nameAR: true,
                    email: true,
                    phone: true,
                    userStatus: true,
                  },
                },
                familyMembers: {
                  include: {
                    familyResident: {
                      include: {
                        user: {
                          select: {
                            id: true,
                            nameEN: true,
                            email: true,
                            phone: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        leases: {
          where: { status: 'ACTIVE' },
          orderBy: [{ createdAt: 'desc' }],
        },
        complaints: {
          orderBy: [{ createdAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            complaintNumber: true,
            categoryLegacy: true,
            category: {
              select: {
                name: true,
              },
            },
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const [gateAccess, paidAgg, pendingAgg, overdueCount] = await Promise.all([
      this.getUnitGateAccess(unit.id),
      this.prisma.invoice.aggregate({
        where: {
          unitId: unit.id,
          status: InvoiceStatus.PAID,
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          unitId: unit.id,
          status: InvoiceStatus.PENDING,
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: {
          unitId: unit.id,
          status: InvoiceStatus.OVERDUE,
        },
      }),
    ]);

    return {
      id: unit.id,
      communityId: unit.communityId,
      clusterId: unit.clusterId,
      unitNumber: unit.unitNumber,
      block: unit.block,
      category: (unit as any).category ?? deriveCategory(unit.type),
      type: unit.type,
      status: unit.status,
      displayStatus: this.mapDisplayStatus(unit),
      isDelivered: unit.isDelivered,
      isActive: unit.isActive,
      communityName: unit.community?.name ?? '-',
      clusterName: unit.cluster?.name ?? null,
      bedrooms: unit.bedrooms,
      sizeSqm: unit.sizeSqm,
      price: unit.price ? Number(unit.price) : null,
      residentCount: unit.residents.length,
      createdAt: unit.createdAt.toISOString(),
      gateAccess,
      leases: unit.leases.map((lease) => ({
        id: lease.id,
        startDate: lease.startDate.toISOString(),
        endDate: lease.endDate.toISOString(),
        status: lease.status,
        tenantId: lease.tenantId,
        tenantEmail: lease.tenantEmail,
      })),
      currentResidents: await (async () => {
        const userIds = unit.residents.map((ru) => ru.resident.userId);
        const unitAccesses = await this.prisma.unitAccess.findMany({
          where: { unitId: unit.id, userId: { in: userIds }, status: 'ACTIVE' },
          select: { userId: true, role: true },
        });
        const accessRoleMap = new Map<string, string>();
        for (const access of unitAccesses) {
          accessRoleMap.set(access.userId, access.role);
        }
        return unit.residents.map((ru) => {
          const user = ru.resident.user;
          const accessRole = accessRoleMap.get(ru.resident.userId) ?? (ru.isPrimary ? 'OWNER' : 'TENANT');
          return {
            id: ru.id,
            residentId: ru.resident.id,
            userId: ru.resident.userId,
            name: user?.nameEN ?? user?.nameAR ?? null,
            email: user?.email ?? null,
            phone: user?.phone ?? null,
            userStatus: user?.userStatus ?? null,
            isPrimary: ru.isPrimary,
            role: accessRole,
            assignedAt: ru.assignedAt,
            familyMembers: (ru.resident as any).familyMembers?.map((fm: any) => ({
              id: fm.id,
              name: fm.familyResident?.user?.nameEN ?? null,
              email: fm.familyResident?.user?.email ?? null,
              phone: fm.familyResident?.user?.phone ?? null,
              relationship: fm.relationship,
              status: fm.status,
            })) ?? [],
          };
        });
      })(),
      recentComplaints: unit.complaints.map((complaint) => ({
        id: complaint.id,
        complaintNumber: complaint.complaintNumber,
        category: complaint.category?.name ?? complaint.categoryLegacy ?? '-',
        status: complaint.status,
        createdAt: complaint.createdAt.toISOString(),
      })),
      invoiceSummary: {
        totalPaid: paidAgg._sum.amount ? Number(paidAgg._sum.amount) : 0,
        totalPending: pendingAgg._sum.amount ? Number(pendingAgg._sum.amount) : 0,
        overdueCount,
      },
    };
  }

  async create(dto: CreateUnitDto) {
    const community = await this.assertCommunity(dto.communityId);
    if (dto.clusterId) {
      await this.assertClusterBelongsToCommunity(dto.clusterId, dto.communityId);
    }

    const mode = dto.gateAccessMode ?? GateAccessMode.ALL_GATES;
    const allowedGateIds = await this.validateGateAccessConfig({
      communityId: dto.communityId,
      gateAccessMode: mode,
      allowedGateIds: dto.allowedGateIds ?? [],
    });

    const category = deriveCategory(dto.type, dto.category);

    const created = await this.prisma.unit.create({
      data: {
        communityId: dto.communityId,
        clusterId: dto.clusterId,
        projectName: community.name,
        block: dto.block,
        unitNumber: dto.unitNumber.trim(),
        category,
        type: dto.type,
        status: dto.status ?? UnitStatus.OFF_PLAN,
        isDelivered: dto.isDelivered ?? false,
        floors: dto.floors,
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        sizeSqm: dto.sizeSqm,
        price: dto.price,
        gateAccessMode: mode,
        allowedGateIds,
        isActive: true,
      },
    });

    // Auto-create commercial entity for commercial units
    if (category === UnitCategory.COMMERCIAL) {
      await this.prisma.commercialEntity.create({
        data: {
          name: `${dto.unitNumber.trim()} - ${community.name}`,
          communityId: dto.communityId,
          unitId: created.id,
          isActive: true,
        },
      });
    }

    return this.findOne(created.id);
  }

  async update(id: string, dto: UpdateUnitDto) {
    const current = await this.prisma.unit.findUnique({
      where: { id },
      select: {
        id: true,
        communityId: true,
        clusterId: true,
        gateAccessMode: true,
        allowedGateIds: true,
      },
    });
    if (!current) {
      throw new NotFoundException('Unit not found');
    }

    const nextCommunityId = dto.communityId ?? current.communityId;
    if (!nextCommunityId) {
      throw new BadRequestException('Unit must belong to a community');
    }
    const community = await this.assertCommunity(nextCommunityId);

    const nextClusterId =
      dto.clusterId !== undefined ? dto.clusterId : current.clusterId;
    if (nextClusterId) {
      await this.assertClusterBelongsToCommunity(nextClusterId, nextCommunityId);
    }

    const nextMode = dto.gateAccessMode ?? current.gateAccessMode;
    const nextGateIds =
      dto.allowedGateIds !== undefined ? dto.allowedGateIds : current.allowedGateIds;
    const normalizedGateIds = await this.validateGateAccessConfig({
      communityId: nextCommunityId,
      gateAccessMode: nextMode,
      allowedGateIds: nextGateIds,
    });

    await this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.communityId !== undefined ? { communityId: dto.communityId } : {}),
        ...(dto.clusterId !== undefined ? { clusterId: dto.clusterId } : {}),
        ...(dto.block !== undefined ? { block: dto.block } : {}),
        ...(dto.unitNumber !== undefined ? { unitNumber: dto.unitNumber.trim() } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isDelivered !== undefined ? { isDelivered: dto.isDelivered } : {}),
        ...(dto.floors !== undefined ? { floors: dto.floors } : {}),
        ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
        ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
        ...(dto.sizeSqm !== undefined ? { sizeSqm: dto.sizeSqm } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        gateAccessMode: nextMode,
        allowedGateIds: normalizedGateIds,
        projectName: community.name,
      },
    });

    return this.findOne(id);
  }

  async remove(id: string, dto?: DeactivateUnitDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    if (!unit.isActive) {
      return { success: true, alreadyInactive: true };
    }

    const activeLease = await this.prisma.lease.count({
      where: {
        unitId: id,
        status: 'ACTIVE',
      },
    });
    if (activeLease > 0) {
      throw new ConflictException(
        'Cannot deactivate a unit with an active lease. Terminate the lease first.',
      );
    }

    await this.prisma.unit.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      reason: dto?.reason?.trim() || null,
    };
  }

  async reactivate(id: string, actorUserId?: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: { id: true, isActive: true, unitNumber: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    await this.prisma.unit.update({
      where: { id },
      data: {
        isActive: true,
        deletedAt: null,
      },
    });

    if (actorUserId) {
      await this.prisma.userStatusLog.create({
        data: {
          userId: actorUserId,
          source: UserStatusLogSource.MANUAL,
          note: `Reactivated unit ${unit.unitNumber} (${unit.id})`,
        },
      });
    }

    return { success: true };
  }

  async getUnitsByCluster(clusterId: string): Promise<UnitListItem[]> {
    const rows = await this.prisma.unit.findMany({
      where: {
        clusterId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        community: { select: { name: true } },
        cluster: { select: { name: true } },
        residents: { select: { id: true } },
      },
      orderBy: [{ unitNumber: 'asc' }],
    });

    return rows.map((row) => this.mapUnitListItem(row as UnitListRecord));
  }

  async getUnitGateAccess(unitId: string): Promise<{
    mode: GateAccessMode;
    gates: Array<{
      id: string;
      name: string;
      code: string | null;
      allowedRoles: GateRole[];
      etaMinutes: number | null;
      isActive: boolean;
    }>;
  }> {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        communityId: true,
        gateAccessMode: true,
        allowedGateIds: true,
      },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    if (!unit.communityId) {
      return { mode: unit.gateAccessMode, gates: [] };
    }

    const where: Prisma.GateWhereInput =
      unit.gateAccessMode === GateAccessMode.ALL_GATES
        ? {
            communityId: unit.communityId,
            isActive: true,
            deletedAt: null,
          }
        : {
            communityId: unit.communityId,
            id: { in: unit.allowedGateIds },
            isActive: true,
            deletedAt: null,
          };

    const gates =
      unit.gateAccessMode === GateAccessMode.SELECTED_GATES &&
      unit.allowedGateIds.length === 0
        ? []
        : await this.prisma.gate.findMany({
            where,
            select: {
              id: true,
              name: true,
              code: true,
              allowedRoles: true,
              etaMinutes: true,
              isActive: true,
            },
            orderBy: [{ name: 'asc' }],
          });

    return {
      mode: unit.gateAccessMode,
      gates,
    };
  }

  async updateGateAccess(unitId: string, dto: UpdateUnitGateAccessDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true, communityId: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    if (!unit.communityId) {
      throw new BadRequestException('Unit has no community assigned');
    }

    const normalizedGateIds = await this.validateGateAccessConfig({
      communityId: unit.communityId,
      gateAccessMode: dto.mode,
      allowedGateIds: dto.allowedGateIds,
    });

    await this.prisma.unit.update({
      where: { id: unitId },
      data: {
        gateAccessMode: dto.mode,
        allowedGateIds: normalizedGateIds,
      },
    });

    return this.getUnitGateAccess(unitId);
  }

  async assignUser(
    unitId: string,
    userIdOrResidentId: string,
    role: AssignUserDto['role'],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.unit.findFirst({
        where: { id: unitId, isActive: true, deletedAt: null },
      });
      if (!unit) throw new NotFoundException('Unit not found');

      const residentId = await this.resolveResidentId(tx, userIdOrResidentId);

      const existingAssignment = await tx.residentUnit.findUnique({
        where: { residentId_unitId: { residentId, unitId } },
      });
      if (existingAssignment) {
        throw new BadRequestException('Resident is already assigned to this unit');
      }

      return tx.residentUnit.create({
        data: {
          unitId,
          residentId,
          isPrimary: role === 'OWNER',
        },
      });
    });
  }

  async removeUser(unitId: string, userIdOrResidentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const residentId = await this.resolveResidentId(tx, userIdOrResidentId);

      const assignment = await tx.residentUnit.findUnique({
        where: { residentId_unitId: { residentId, unitId } },
      });
      if (!assignment) {
        throw new NotFoundException('Resident assignment not found for this unit');
      }

      return tx.residentUnit.delete({
        where: { residentId_unitId: { residentId, unitId } },
      });
    });
  }

  async getUsers(unitId: string) {
    const residentUnits = await this.prisma.residentUnit.findMany({
      where: { unitId },
      include: {
        resident: {
          include: {
            user: {
              select: {
                id: true,
                nameEN: true,
                nameAR: true,
                email: true,
                phone: true,
                userStatus: true,
              },
            },
            familyMembers: {
              include: {
                familyResident: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        nameEN: true,
                        email: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Fetch unit access roles for all residents in this unit
    const userIds = residentUnits.map((ru) => ru.resident.userId);
    const unitAccesses = await this.prisma.unitAccess.findMany({
      where: {
        unitId,
        userId: { in: userIds },
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        role: true,
      },
    });

    const accessRoleMap = new Map<string, string>();
    for (const access of unitAccesses) {
      accessRoleMap.set(access.userId, access.role);
    }

    return residentUnits.map((ru) => {
      const user = ru.resident.user;
      const accessRole = accessRoleMap.get(ru.resident.userId) ?? (ru.isPrimary ? 'OWNER' : 'TENANT');

      return {
        id: ru.id,
        residentId: ru.resident.id,
        userId: ru.resident.userId,
        name: user?.nameEN ?? user?.nameAR ?? null,
        email: user?.email ?? null,
        phone: user?.phone ?? null,
        userStatus: user?.userStatus ?? null,
        isPrimary: ru.isPrimary,
        role: accessRole,
        assignedAt: ru.assignedAt,
        familyMembers: ru.resident.familyMembers.map((fm) => ({
          id: fm.id,
          name: fm.familyResident?.user?.nameEN ?? null,
          email: fm.familyResident?.user?.email ?? null,
          phone: fm.familyResident?.user?.phone ?? null,
          relationship: fm.relationship,
          status: fm.status,
        })),
      };
    });
  }

  async updateStatus(unitId: string, status: UnitStatus) {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, isActive: true, deletedAt: null },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const previousStatus = unit.status;

    const isDelivered = status === UnitStatus.DELIVERED;

    const updatedUnit = await this.prisma.unit.update({
      where: { id: unitId },
      data: { status, isDelivered },
    });

    if (previousStatus !== status) {
      this.eventEmitter.emit(
        'unit.status.changed',
        new UnitStatusChangedEvent(
          unitId,
          unit.unitNumber,
          previousStatus,
          status,
          unit.projectName,
        ),
      );
    }

    return updatedUnit;
  }

  async getLeases(unitId: string) {
    return this.prisma.lease.findMany({
      where: { unitId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getByNumber(unitNumber: string) {
    const units = await this.prisma.unit.findMany({
      where: {
        unitNumber: {
          contains: unitNumber,
          mode: 'insensitive',
        },
        isActive: true,
        deletedAt: null,
      },
    });
    if (units.length === 0) {
      throw new NotFoundException('No units found matching the number');
    }
    return units;
  }

  async canAccessFeature(unitId: string, feature: string): Promise<boolean> {
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, isActive: true, deletedAt: null },
    });
    if (!unit) return false;

    switch (feature) {
      case 'add_tenant':
      case 'add_family':
      case 'manage_delegates':
        return unit.status === UnitStatus.DELIVERED;
      case 'view_payment_plan':
      case 'view_announcements':
      case 'view_overdue_checks':
        return true;
      default:
        return false;
    }
  }

  async getUserAccessForUnit(unitId: string, userId: string) {
    return this.prisma.unitAccess.findFirst({
      where: {
        unitId,
        userId,
        status: 'ACTIVE',
      },
    });
  }
}
