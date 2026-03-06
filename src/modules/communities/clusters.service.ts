import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateClusterDto } from './dto/create-cluster.dto';
import { ReorderClustersDto } from './dto/reorder-clusters.dto';
import { UpdateClusterDto } from './dto/update-cluster.dto';

export interface ClusterListItem {
  id: string;
  communityId: string;
  name: string;
  code: string | null;
  displayOrder: number;
  isActive: boolean;
  unitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ClustersService {
  constructor(private readonly prisma: PrismaService) {}

  async listClusters(communityId: string): Promise<ClusterListItem[]> {
    await this.assertCommunityExists(communityId);
    const rows = await this.prisma.cluster.findMany({
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
      isActive: row.isActive,
      unitCount: row._count.units,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createCluster(
    communityId: string,
    dto: CreateClusterDto,
  ): Promise<ClusterListItem> {
    await this.assertCommunityExists(communityId);
    const name = dto.name.trim();
    const code = dto.code?.trim() || null;

    try {
      const created = await this.prisma.cluster.create({
        data: {
          communityId,
          name,
          code,
          displayOrder: dto.displayOrder ?? 0,
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
        isActive: created.isActive,
        unitCount: created._count.units,
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
        throw new ConflictException('Cluster name already exists in this community');
      }
      throw error;
    }
  }

  async updateCluster(id: string, dto: UpdateClusterDto): Promise<ClusterListItem> {
    const current = await this.prisma.cluster.findFirst({
      where: {
        id,
        deletedAt: null,
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
          },
        },
      },
    });
    if (!current) {
      throw new NotFoundException('Cluster not found');
    }

    try {
      const updated = await this.prisma.cluster.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.code !== undefined ? { code: dto.code?.trim() || null } : {}),
          ...(dto.displayOrder !== undefined
            ? { displayOrder: dto.displayOrder }
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
        isActive: updated.isActive,
        unitCount: updated._count.units,
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
        throw new ConflictException('Cluster name already exists in this community');
      }
      throw error;
    }
  }

  async deleteCluster(id: string): Promise<{ success: true }> {
    const cluster = await this.prisma.cluster.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
    if (!cluster) {
      throw new NotFoundException('Cluster not found');
    }

    const activeUnits = await this.prisma.unit.count({
      where: {
        clusterId: id,
        isActive: true,
        deletedAt: null,
      },
    });
    if (activeUnits > 0) {
      throw new BadRequestException(
        'Cannot delete cluster while active units are assigned to it',
      );
    }

    await this.prisma.cluster.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { success: true };
  }

  async reorderClusters(
    communityId: string,
    dto: ReorderClustersDto,
  ): Promise<{ success: true }> {
    await this.assertCommunityExists(communityId);

    const clusters = await this.prisma.cluster.findMany({
      where: {
        communityId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    if (clusters.length === 0) {
      throw new BadRequestException('No active clusters found to reorder');
    }

    const existingIds = new Set(clusters.map((item) => item.id));
    const nextIds = dto.orderedIds;

    if (nextIds.length !== clusters.length) {
      throw new BadRequestException(
        'orderedIds must include all active clusters exactly once',
      );
    }

    const hasInvalidId = nextIds.some((id) => !existingIds.has(id));
    if (hasInvalidId) {
      throw new BadRequestException(
        'orderedIds contains cluster IDs that do not belong to this community',
      );
    }

    if (new Set(nextIds).size !== nextIds.length) {
      throw new BadRequestException(
        'orderedIds must include each cluster exactly once',
      );
    }

    await this.prisma.$transaction(
      nextIds.map((id, index) =>
        this.prisma.cluster.update({
          where: { id },
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
