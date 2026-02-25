import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Audience, BannerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ListBannersDto } from './dto/list-banners.dto';

@Injectable()
export class BannersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeAudienceMeta(meta: unknown): Prisma.InputJsonValue | undefined {
    if (meta === undefined || meta === null) return undefined;
    if (typeof meta !== 'object') {
      throw new BadRequestException('audienceMeta must be an object');
    }
    return meta as Prisma.InputJsonValue;
  }

  private validateDates(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid banner date values');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }
  }

  private async validateImageFile(imageFileId?: string) {
    if (!imageFileId) return;
    const file = await this.prisma.file.findUnique({
      where: { id: imageFileId },
      select: { id: true, mimeType: true },
    });
    if (!file) throw new BadRequestException('imageFileId not found');
    const mime = (file.mimeType ?? '').toLowerCase();
    if (mime && !mime.startsWith('image/')) {
      throw new BadRequestException('imageFileId must reference an image file');
    }
  }

  private buildCtr(banner: { views: number; clicks: number }) {
    if (!banner.views || banner.views <= 0) return 0;
    return Number(((banner.clicks / banner.views) * 100).toFixed(2));
  }

  private readStringArrayFromJsonObject(
    value: unknown,
    key: 'userIds' | 'unitIds' | 'blocks',
  ): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const raw = (value as Record<string, unknown>)[key];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }

  private audienceMatches(
    banner: {
      targetAudience: Audience;
      audienceMeta: Prisma.JsonValue | null;
    },
    scope: {
      userId: string;
      unitIds: Set<string>;
      blocks: Set<string>;
      selectedUnitId?: string | null;
      selectedBlock?: string | null;
    },
  ) {
    if (banner.targetAudience === Audience.ALL) return true;

    if (banner.targetAudience === Audience.SPECIFIC_RESIDENCES) {
      const userIds = this.readStringArrayFromJsonObject(
        banner.audienceMeta,
        'userIds',
      );
      return userIds.includes(scope.userId);
    }

    if (banner.targetAudience === Audience.SPECIFIC_UNITS) {
      const unitIds = this.readStringArrayFromJsonObject(
        banner.audienceMeta,
        'unitIds',
      );
      if (scope.selectedUnitId) return unitIds.includes(scope.selectedUnitId);
      return unitIds.some((id) => scope.unitIds.has(id));
    }

    if (banner.targetAudience === Audience.SPECIFIC_BLOCKS) {
      const blocks = this.readStringArrayFromJsonObject(banner.audienceMeta, 'blocks')
        .map((v) => v.toLowerCase());
      if (scope.selectedBlock) return blocks.includes(scope.selectedBlock.toLowerCase());
      for (const b of scope.blocks) {
        if (blocks.includes(String(b).toLowerCase())) return true;
      }
      return false;
    }

    return false;
  }

  async findMobileForUser(actorUserId: string, options?: { unitId?: string }) {
    const activeAccesses = await this.prisma.unitAccess.findMany({
      where: {
        userId: actorUserId,
        status: 'ACTIVE',
      },
      select: {
        unitId: true,
        unit: {
          select: {
            id: true,
            block: true,
          },
        },
      },
    });

    const unitIds = new Set(
      activeAccesses.map((a) => a.unitId).filter((id): id is string => Boolean(id)),
    );
    const blocks = new Set(
      activeAccesses
        .map((a) => a.unit?.block ?? null)
        .filter((b): b is string => Boolean(b)),
    );

    const selectedUnitId =
      options?.unitId && unitIds.has(options.unitId) ? options.unitId : null;
    const selectedBlock =
      selectedUnitId != null
        ? (activeAccesses.find((a) => a.unitId === selectedUnitId)?.unit?.block ?? null)
        : null;

    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        status: BannerStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const priorityRank: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const data = banners
      .filter((banner) =>
        this.audienceMatches(
          {
            targetAudience: banner.targetAudience,
            audienceMeta: banner.audienceMeta as Prisma.JsonValue | null,
          },
          {
            userId: actorUserId,
            unitIds,
            blocks,
            selectedUnitId,
            selectedBlock,
          },
        ),
      )
      .sort((a, b) => {
        const pr =
          (priorityRank[String(b.displayPriority)] ?? 0) -
          (priorityRank[String(a.displayPriority)] ?? 0);
        if (pr !== 0) return pr;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map((banner) => ({
        ...banner,
        ctr: this.buildCtr(banner),
        imageStreamPath: banner.imageFileId
          ? `/files/${banner.imageFileId}/stream`
          : null,
        imagePublicPath: banner.imageFileId
          ? `/files/public/banner-image/${banner.imageFileId}`
          : null,
      }));

    return {
      data,
      meta: {
        total: data.length,
        unitId: selectedUnitId,
        generatedAt: now.toISOString(),
      },
    };
  }

  async create(dto: CreateBannerDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.validateDates(startDate, endDate);
    await this.validateImageFile(dto.imageFileId);

    const created = await this.prisma.banner.create({
      data: {
        titleEn: dto.titleEn.trim(),
        titleAr: dto.titleAr?.trim() || null,
        imageFileId: dto.imageFileId ?? null,
        description: dto.description?.trim() || null,
        ctaText: dto.ctaText?.trim() || null,
        ctaUrl: dto.ctaUrl?.trim() || null,
        targetAudience: dto.targetAudience,
        audienceMeta: this.normalizeAudienceMeta(dto.audienceMeta),
        startDate,
        endDate,
        status: dto.status ?? BannerStatus.ACTIVE,
        displayPriority: dto.displayPriority ?? 'MEDIUM',
        views: dto.views ?? 0,
        clicks: dto.clicks ?? 0,
      },
    });

    return { ...created, ctr: this.buildCtr(created) };
  }

  async findAll(query: ListBannersDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 100;
    const q = query.q?.trim();
    const where: Prisma.BannerWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.activeOnly) where.status = BannerStatus.ACTIVE;
    if (q) {
      where.OR = [
        { titleEn: { contains: q, mode: 'insensitive' } },
        { titleAr: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { ctaText: { contains: q, mode: 'insensitive' } },
        { ctaUrl: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.banner.count({ where }),
    ]);

    return {
      data: data.map((b) => ({ ...b, ctr: this.buildCtr(b) })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return { ...banner, ctr: this.buildCtr(banner) };
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.findOne(id);

    const data: Prisma.BannerUpdateInput = {};

    if (dto.titleEn !== undefined) data.titleEn = dto.titleEn.trim();
    if (dto.titleAr !== undefined) data.titleAr = dto.titleAr?.trim() || null;
    if (dto.imageFileId !== undefined) {
      await this.validateImageFile(dto.imageFileId);
      data.imageFileId = dto.imageFileId || null;
    }
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.ctaText !== undefined) data.ctaText = dto.ctaText?.trim() || null;
    if (dto.ctaUrl !== undefined) data.ctaUrl = dto.ctaUrl?.trim() || null;
    if (dto.targetAudience !== undefined) data.targetAudience = dto.targetAudience;
    if (dto.audienceMeta !== undefined) {
      data.audienceMeta = this.normalizeAudienceMeta(dto.audienceMeta);
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.displayPriority !== undefined) data.displayPriority = dto.displayPriority;
    if (dto.views !== undefined) data.views = dto.views;
    if (dto.clicks !== undefined) data.clicks = dto.clicks;

    const nextStart =
      dto.startDate !== undefined
        ? new Date(dto.startDate)
        : (await this.prisma.banner.findUnique({
            where: { id },
            select: { startDate: true },
          }))!.startDate;
    const nextEnd =
      dto.endDate !== undefined
        ? new Date(dto.endDate)
        : (await this.prisma.banner.findUnique({
            where: { id },
            select: { endDate: true },
          }))!.endDate;
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      this.validateDates(nextStart, nextEnd);
    }
    if (dto.startDate !== undefined) data.startDate = nextStart;
    if (dto.endDate !== undefined) data.endDate = nextEnd;

    const updated = await this.prisma.banner.update({
      where: { id },
      data,
    });

    return { ...updated, ctr: this.buildCtr(updated) };
  }

  async updateStatus(id: string, status: BannerStatus) {
    const updated = await this.prisma.banner.update({
      where: { id },
      data: { status },
    });
    return { ...updated, ctr: this.buildCtr(updated) };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.banner.delete({ where: { id } });
    return { success: true };
  }
}
