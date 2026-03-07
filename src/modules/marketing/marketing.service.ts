import { Injectable, NotFoundException } from '@nestjs/common';
import { ReferralStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateMarketingProjectDto,
  MarketingProjectResponseDto,
  UpdateMarketingProjectDto,
} from './dto/marketing-project.dto';
import {
  ListMarketingReferralsDto,
  MarketingReferralListItemDto,
  MarketingReferralListResponseDto,
} from './dto/list-marketing-referrals.dto';
import { MarketingStatsResponseDto } from './dto/marketing-stats.dto';
import { UpdateMarketingReferralStatusDto } from './dto/update-marketing-referral-status.dto';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<MarketingStatsResponseDto> {
    const [totalProjects, totalReferrals, newReferrals, contactedReferrals, convertedReferrals, rejectedReferrals] =
      await Promise.all([
        this.prisma.project.count(),
        this.prisma.referral.count(),
        this.prisma.referral.count({ where: { status: ReferralStatus.NEW } }),
        this.prisma.referral.count({ where: { status: ReferralStatus.CONTACTED } }),
        this.prisma.referral.count({ where: { status: ReferralStatus.CONVERTED } }),
        this.prisma.referral.count({ where: { status: ReferralStatus.REJECTED } }),
      ]);

    return {
      totalProjects,
      totalReferrals,
      newReferrals,
      contactedReferrals,
      convertedReferrals,
      rejectedReferrals,
    };
  }

  async listProjects(): Promise<MarketingProjectResponseDto[]> {
    const rows = await this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      mobileNumber: row.mobileNumber,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async createProject(
    dto: CreateMarketingProjectDto,
  ): Promise<MarketingProjectResponseDto> {
    const row = await this.prisma.project.create({
      data: {
        nameEn: dto.nameEn.trim(),
        nameAr: dto.nameAr?.trim() || null,
        descriptionEn: dto.descriptionEn.trim(),
        descriptionAr: dto.descriptionAr?.trim() || null,
        mobileNumber: dto.mobileNumber.trim(),
      },
    });

    return {
      id: row.id,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      mobileNumber: row.mobileNumber,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async updateProject(
    projectId: string,
    dto: UpdateMarketingProjectDto,
  ): Promise<MarketingProjectResponseDto> {
    const existing = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    const row = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn.trim() } : {}),
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() || null } : {}),
        ...(dto.descriptionEn !== undefined
          ? { descriptionEn: dto.descriptionEn.trim() }
          : {}),
        ...(dto.descriptionAr !== undefined
          ? { descriptionAr: dto.descriptionAr.trim() || null }
          : {}),
        ...(dto.mobileNumber !== undefined
          ? { mobileNumber: dto.mobileNumber.trim() }
          : {}),
      },
    });

    return {
      id: row.id,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      descriptionEn: row.descriptionEn,
      descriptionAr: row.descriptionAr,
      mobileNumber: row.mobileNumber,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listReferrals(
    query: ListMarketingReferralsDto,
  ): Promise<MarketingReferralListResponseDto> {
    const safePage =
      Number.isFinite(query.page) && Number(query.page) > 0
        ? Math.floor(Number(query.page))
        : 1;
    const safeLimit =
      Number.isFinite(query.limit) && Number(query.limit) > 0
        ? Math.min(Math.floor(Number(query.limit)), 100)
        : 25;

    const where = this.buildReferralWhere(query);
    const [rows, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        include: {
          referrer: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              phone: true,
            },
          },
          convertedUser: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.referral.count({ where }),
    ]);

    const data: MarketingReferralListItemDto[] = rows.map((row) => ({
      id: row.id,
      friendFullName: row.friendFullName,
      friendMobile: row.friendMobile,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
      referrer: {
        id: row.referrer.id,
        name: row.referrer.nameEN || row.referrer.nameAR || row.referrer.id,
        phone: row.referrer.phone,
      },
      convertedUser: row.convertedUser
        ? {
            id: row.convertedUser.id,
            name:
              row.convertedUser.nameEN ||
              row.convertedUser.nameAR ||
              row.convertedUser.id,
            phone: row.convertedUser.phone,
          }
        : null,
    }));

    return {
      data,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  async updateReferralStatus(
    referralId: string,
    dto: UpdateMarketingReferralStatusDto,
  ): Promise<MarketingReferralListItemDto> {
    const existing = await this.prisma.referral.findUnique({
      where: { id: referralId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Referral not found');
    }

    const row = await this.prisma.referral.update({
      where: { id: referralId },
      data: {
        status: dto.status,
      },
      include: {
        referrer: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            phone: true,
          },
        },
        convertedUser: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            phone: true,
          },
        },
      },
    });

    return {
      id: row.id,
      friendFullName: row.friendFullName,
      friendMobile: row.friendMobile,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
      referrer: {
        id: row.referrer.id,
        name: row.referrer.nameEN || row.referrer.nameAR || row.referrer.id,
        phone: row.referrer.phone,
      },
      convertedUser: row.convertedUser
        ? {
            id: row.convertedUser.id,
            name:
              row.convertedUser.nameEN ||
              row.convertedUser.nameAR ||
              row.convertedUser.id,
            phone: row.convertedUser.phone,
          }
        : null,
    };
  }

  private buildReferralWhere(
    query: ListMarketingReferralsDto,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { friendFullName: { contains: search, mode: 'insensitive' } },
        { friendMobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (query.dateFrom) {
        const from = new Date(query.dateFrom);
        if (!Number.isNaN(from.getTime())) {
          createdAt.gte = from;
        }
      }
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        if (!Number.isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          createdAt.lte = to;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    return where;
  }
}
