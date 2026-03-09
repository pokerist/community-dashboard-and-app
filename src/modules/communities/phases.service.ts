import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { ReorderPhasesDto } from './dto/reorder-phases.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';

export interface PhaseListItem {
  id: string;
  communityId: string;
  name: string;
  code: string | null;
  displayOrder: number;
  description: string | null;
  isActive: boolean;
  unitCount: number;
  clusterCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PhasesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPhases(communityId: string): Promise<PhaseListItem[]> {
    await this.assertCommunityExists(communityId);

    const rows = await this.prisma.phase.findMany({
      where: {
        communityId,
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
            clusters: {
              where: {
                isActive: true,
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      communityId: row.communityId,
      name: row.name,
      code: row.code,
      displayOrder: row.displayOrder,
      description: row.description,
      isActive: row.isActive,
      unitCount: row._count.units,
      clusterCount: row._count.clusters,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createPhase(communityId: string, dto: CreatePhaseDto): Promise<PhaseListItem> {
    await this.assertCommunityExists(communityId);

    try {
      const created = await this.prisma.phase.create({
        data: {
          communityId,
          name: dto.name.trim(),
          code: dto.code?.trim() || null,
          displayOrder: dto.displayOrder ?? 0,
          description: dto.description?.trim() || null,
          isActive: true,
        },
        include: {
          _count: {
            select: {
              units: {
                where: {
                  isActive: true,
                  deletedAt: null,
                },
              },
              clusters: {
                where: {
                  isActive: true,
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      return {
        id: created.id,
        communityId: created.communityId,
        name: created.name,
        code: created.code,
        displayOrder: created.displayOrder,
        description: created.description,
        isActive: created.isActive,
        unitCount: created._count.units,
        clusterCount: created._count.clusters,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Phase name already exists in this community');
      }
      throw error;
    }
  }

  async updatePhase(id: string, dto: UpdatePhaseDto): Promise<PhaseListItem> {
    const current = await this.prisma.phase.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            units: {
              where: {
                isActive: true,
                deletedAt: null,
              },
            },
            clusters: {
              where: {
                isActive: true,
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!current) throw new NotFoundException('Phase not found');

    try {
      const updated = await this.prisma.phase.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
        },
        include: {
          _count: {
            select: {
              units: {
                where: {
                  isActive: true,
                  deletedAt: null,
                },
              },
              clusters: {
                where: {
                  isActive: true,
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      return {
        id: updated.id,
        communityId: updated.communityId,
        name: updated.name,
        code: updated.code,
        displayOrder: updated.displayOrder,
        description: updated.description,
        isActive: updated.isActive,
        unitCount: updated._count.units,
        clusterCount: updated._count.clusters,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Phase name already exists in this community');
      }
      throw error;
    }
  }

  async deletePhase(id: string): Promise<{ success: true }> {
    const phase = await this.prisma.phase.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!phase) throw new NotFoundException('Phase not found');

    const [activeUnits, activeClusters] = await Promise.all([
      this.prisma.unit.count({
        where: {
          phaseId: id,
          isActive: true,
          deletedAt: null,
        },
      }),
      this.prisma.cluster.count({
        where: {
          phaseId: id,
          isActive: true,
          deletedAt: null,
        },
      }),
    ]);

    if (activeUnits > 0 || activeClusters > 0) {
      throw new BadRequestException(
        'Cannot delete phase while active clusters/units are assigned to it',
      );
    }

    await this.prisma.phase.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  async reorderPhases(
    communityId: string,
    dto: ReorderPhasesDto,
  ): Promise<{ success: true }> {
    await this.assertCommunityExists(communityId);

    const phases = await this.prisma.phase.findMany({
      where: {
        communityId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    if (phases.length === 0) {
      throw new BadRequestException('No active phases found to reorder');
    }

    const existingIds = new Set(phases.map((phase) => phase.id));
    const nextIds = dto.orderedIds;

    if (nextIds.length !== phases.length) {
      throw new BadRequestException(
        'orderedIds must include all active phases exactly once',
      );
    }

    const hasInvalidId = nextIds.some((entryId) => !existingIds.has(entryId));
    if (hasInvalidId) {
      throw new BadRequestException(
        'orderedIds contains phase IDs that do not belong to this community',
      );
    }

    if (new Set(nextIds).size !== nextIds.length) {
      throw new BadRequestException('orderedIds must include each phase exactly once');
    }

    await this.prisma.$transaction(
      nextIds.map((entryId, index) =>
        this.prisma.phase.update({
          where: { id: entryId },
          data: { displayOrder: index },
        }),
      ),
    );

    return { success: true };
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
}
