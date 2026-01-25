import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ClubhouseService {
  constructor(private prisma: PrismaService) {}

  // Create clubhouse access request
  async createAccessRequest(userId: string, unitId: string) {
    // Check if user exists and has access to unit
    const userAccess = await this.prisma.unitAccess.findFirst({
      where: {
        unitId,
        userId,
        status: 'ACTIVE',
      },
    });
    if (!userAccess) {
      throw new BadRequestException('User does not have access to this unit');
    }

    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (unit?.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Clubhouse access is only available after delivery',
      );
    }

    // Check if request already exists
    const existingRequest = await this.prisma.clubhouseAccessRequest.findFirst({
      where: {
        userId,
        unitId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existingRequest) {
      throw new BadRequestException('Access request already exists');
    }

    return this.prisma.clubhouseAccessRequest.create({
      data: {
        userId,
        unitId,
        status: 'PENDING',
      },
    });
  }

  // Approve access request
  async approveAccessRequest(requestId: string, approvedBy: string) {
    const request = await this.prisma.clubhouseAccessRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    return this.prisma.clubhouseAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });
  }

  // Reject access request
  async rejectAccessRequest(requestId: string) {
    const request = await this.prisma.clubhouseAccessRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    return this.prisma.clubhouseAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
      },
    });
  }

  // Get pending requests
  async getPendingRequests() {
    return this.prisma.clubhouseAccessRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: true,
        unit: true,
      },
    });
  }

  // Check if user has clubhouse access
  async hasClubhouseAccess(userId: string, unitId?: string): Promise<boolean> {
    const where: any = {
      userId,
      status: 'APPROVED',
    };
    if (unitId) {
      where.unitId = unitId;
    }

    const access = await this.prisma.clubhouseAccessRequest.findFirst({
      where,
    });

    return !!access;
  }

  // Get user's clubhouse access
  async getUserAccess(userId: string) {
    return this.prisma.clubhouseAccessRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
      },
      include: {
        unit: true,
      },
    });
  }
}
