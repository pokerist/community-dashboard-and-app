import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintStatus,
  EntryRole,
  UnitStatus,
  UserStatusEnum,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommunityDetailResponseDto } from './dto/community-detail-response.dto';
import { CommunityStatsResponseDto } from './dto/community-stats-response.dto';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.community.findMany({
      include: {
        _count: {
          select: {
            clusters: {
              where: {
                isActive: true,
                deletedAt: null,
              },
            },
            gates: {
              where: {
                isActive: true,
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateCommunityDto) {
    const name = dto.name.trim();
    const code = dto.code?.trim() || null;

    try {
      return await this.prisma.community.create({
        data: {
          name,
          code,
          displayOrder: dto.displayOrder ?? 0,
          isActive: dto.isActive ?? true,
          allowedEntryRoles: dto.allowedEntryRoles ?? [],
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Community name/code already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCommunityDto) {
    const current = await this.prisma.community.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Community not found');

    const nextName = dto.name?.trim();
    const nextCode = dto.code === undefined ? undefined : dto.code.trim() || null;

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        ...(nextName !== undefined ? { name: nextName } : {}),
        ...(nextCode !== undefined ? { code: nextCode } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.allowedEntryRoles !== undefined
          ? { allowedEntryRoles: dto.allowedEntryRoles }
          : {}),
      },
    });

    if (nextName && nextName !== current.name) {
      await this.prisma.unit.updateMany({
        where: { communityId: id },
        data: { projectName: nextName },
      });
    }

    return updated;
  }

  async remove(id: string) {
    const current = await this.prisma.community.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Community not found');

    const linkedUnits = await this.prisma.unit.count({ where: { communityId: id } });
    if (linkedUnits > 0) {
      throw new BadRequestException(
        'Cannot delete community while units are linked. Reassign units first.',
      );
    }

    await this.prisma.community.delete({ where: { id } });
    return { success: true };
  }

  async updateAllowedEntryRoles(
    id: string,
    roles: EntryRole[],
  ): Promise<{ id: string; allowedEntryRoles: EntryRole[] }> {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        allowedEntryRoles: roles,
      },
      select: {
        id: true,
        allowedEntryRoles: true,
      },
    });

    return updated;
  }

  async getCommunityStats(id: string): Promise<CommunityStatsResponseDto> {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const unitWhere = {
      communityId: id,
      isActive: true,
      deletedAt: null,
    } as const;

    const [
      totalUnits,
      occupiedUnits,
      deliveredUnits,
      activeResidents,
      openComplaints,
    ] = await Promise.all([
      this.prisma.unit.count({
        where: unitWhere,
      }),
      this.prisma.unit.count({
        where: {
          ...unitWhere,
          status: {
            in: [UnitStatus.OCCUPIED, UnitStatus.LEASED, UnitStatus.RENTED],
          },
        },
      }),
      this.prisma.unit.count({
        where: {
          ...unitWhere,
          isDelivered: true,
        },
      }),
      this.prisma.residentUnit.count({
        where: {
          unit: unitWhere,
          resident: {
            user: {
              userStatus: UserStatusEnum.ACTIVE,
            },
          },
        },
      }),
      this.prisma.complaint.count({
        where: {
          status: {
            in: [ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS],
          },
          unit: {
            communityId: id,
            isActive: true,
            deletedAt: null,
          },
        },
      }),
    ]);

    return {
      totalUnits,
      occupiedUnits,
      deliveredUnits,
      activeResidents,
      openComplaints,
    };
  }

  async getCommunityDetail(id: string): Promise<CommunityDetailResponseDto> {
    const community = await this.prisma.community.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        allowedEntryRoles: true,
        createdAt: true,
      },
    });
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const [clusters, gates, stats] = await Promise.all([
      this.prisma.cluster.findMany({
        where: {
          communityId: id,
          isActive: true,
          deletedAt: null,
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: {
              units: {
                where: {
                  isActive: true,
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      this.prisma.gate.findMany({
        where: {
          communityId: id,
          isActive: true,
          deletedAt: null,
        },
        orderBy: [{ name: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          allowedRoles: true,
          etaMinutes: true,
          isActive: true,
        },
      }),
      this.getCommunityStats(id),
    ]);

    return {
      id: community.id,
      name: community.name,
      code: community.code,
      isActive: community.isActive,
      allowedEntryRoles: community.allowedEntryRoles,
      clusters: clusters.map((cluster) => ({
        id: cluster.id,
        name: cluster.name,
        code: cluster.code,
        displayOrder: cluster.displayOrder,
        unitCount: cluster._count.units,
      })),
      gates: gates.map((gate) => ({
        id: gate.id,
        name: gate.name,
        code: gate.code,
        allowedRoles: gate.allowedRoles,
        etaMinutes: gate.etaMinutes,
        isActive: gate.isActive,
      })),
      stats,
      createdAt: community.createdAt.toISOString(),
    };
  }
}

