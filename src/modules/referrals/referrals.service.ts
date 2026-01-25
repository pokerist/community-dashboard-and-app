import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';
import { ValidateReferralResponseDto } from './dto/validate-referral.dto';
import { ReferralStatus } from '@prisma/client';
interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  async create(createReferralDto: CreateReferralDto, referrerId: string) {
    const { friendFullName, friendMobile, message } = createReferralDto;

    // Check if referrer is trying to refer themselves
    const referrer = await this.prisma.user.findUnique({
      where: { id: referrerId },
      select: { phone: true },
    });

    if (!referrer) {
      throw new NotFoundException('Referrer not found');
    }

    if (referrer.phone === friendMobile) {
      throw new BadRequestException('Cannot refer yourself');
    }

    // Check for existing active referral for this phone
    const existingReferral = await this.prisma.referral.findFirst({
      where: {
        friendMobile,
        status: {
          in: [ReferralStatus.NEW, ReferralStatus.CONTACTED],
        },
      },
    });

    if (existingReferral) {
      throw new ConflictException(
        'An active referral already exists for this phone number',
      );
    }

    // Create the referral
    const referral = await this.prisma.referral.create({
      data: {
        referrerId,
        friendFullName,
        friendMobile,
        message,
        status: ReferralStatus.NEW,
      },
      include: {
        referrer: {
          select: { nameEN: true, nameAR: true },
        },
      },
    });

    // TODO: Trigger invitation delivery (SMS/WhatsApp/Email)
    // For now, just return the referral

    return referral;
  }

  async findAll(query: ReferralQueryDto, userId?: string) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      referrerId,
      dateFrom,
      dateTo,
    } = query;

    const where: any = {};

    // If userId provided, only show their own referrals
    if (userId) {
      where.referrerId = userId;
    }

    // Apply filters
    if (status) {
      where.status = status;
    }

    if (referrerId) {
      where.referrerId = referrerId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        include: {
          referrer: {
            select: { nameEN: true, nameAR: true, phone: true },
          },
          convertedUser: {
            select: { nameEN: true, nameAR: true, phone: true },
          },
        },
        orderBy: {
          [sortBy || 'createdAt']: sortOrder || 'desc',
        },
        skip: ((page || 1) - 1) * (limit || 10),
        take: limit || 10,
      }),
      this.prisma.referral.count({ where }),
    ]);

    const totalPages = Math.ceil(total / (limit || 10));

    return {
      data: referrals,
      meta: {
        total,
        page: page || 1,
        limit: limit || 10,
        totalPages,
      },
    };
  }

  async validateReferral(phone: string): Promise<ValidateReferralResponseDto> {
    const referral = await this.prisma.referral.findFirst({
      where: {
        friendMobile: phone,
        status: {
          in: [ReferralStatus.NEW, ReferralStatus.CONTACTED],
        },
      },
      include: {
        referrer: {
          select: { nameEN: true, nameAR: true },
        },
      },
    });

    if (!referral) {
      return { valid: false, message: 'No active referral found for this phone number' };
    }

    const referrerName =
      referral.referrer.nameEN || referral.referrer.nameAR || 'Referrer';
    return { valid: true, referrerName, message: `Referral found for this phone number from ${referrerName}` };
  }

  async reject(id: string, reason?: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    if (referral.status === ReferralStatus.CONVERTED) {
      throw new BadRequestException('Cannot reject a converted referral');
    }

    if (referral.status === ReferralStatus.REJECTED) {
      throw new BadRequestException('Referral is already rejected');
    }

    return this.prisma.referral.update({
      where: { id },
      data: {
        status: ReferralStatus.REJECTED,
      },
      include: {
        referrer: {
          select: { nameEN: true, nameAR: true },
        },
      },
    });
  }

  async convertReferral(phone: string, userId: string) {
    const referral = await this.prisma.referral.findFirst({
      where: {
        friendMobile: phone,
        status: {
          in: [ReferralStatus.NEW, ReferralStatus.CONTACTED],
        },
      },
    });

    if (!referral) {
      throw new BadRequestException(
        'No valid referral found for this phone number',
      );
    }

    // Update referral status and link to converted user
    return this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: ReferralStatus.CONVERTED,
        convertedUserId: userId,
      },
    });
  }
}
