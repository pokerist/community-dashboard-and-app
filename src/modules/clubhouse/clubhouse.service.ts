import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Audience, Channel, NotificationType, UnitStatus } from '@prisma/client';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';

@Injectable()
export class ClubhouseService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  private async assertIsAdmin(userId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!admin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private async notifyAdmins(title: string, messageEn: string) {
    const admins = await this.prisma.admin.findMany({ select: { userId: true } });
    const adminUserIds = admins.map((a) => a.userId).filter(Boolean);
    if (adminUserIds.length === 0) return;

    await this.notificationsService.sendNotification(
      {
        type: NotificationType.EVENT_NOTIFICATION,
        title,
        messageEn,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: adminUserIds },
      },
      undefined,
    );
  }

  private async notifyUser(userId: string, title: string, messageEn: string) {
    await this.notificationsService.sendNotification(
      {
        type: NotificationType.EVENT_NOTIFICATION,
        title,
        messageEn,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [userId] },
      },
      undefined,
    );
  }

  // Create clubhouse access request
  async createAccessRequest(userId: string, unitId: string) {
    // Check if user exists and has access to unit
    await getActiveUnitAccess(this.prisma, userId, unitId);

    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    const allowedUnitStatuses: UnitStatus[] = [
      UnitStatus.DELIVERED,
    ];

    if (!unit || !allowedUnitStatuses.includes(unit.status)) {
      throw new BadRequestException(
        'Clubhouse access is only available after delivery/occupancy',
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

    const request = await this.prisma.clubhouseAccessRequest.create({
      data: {
        userId,
        unitId,
        status: 'PENDING',
      },
    });

    await this.notifyAdmins(
      'Clubhouse access request pending',
      `A new clubhouse access request was created for unit ${unit.unitNumber}.`,
    ).catch(() => undefined);

    await this.notifyUser(
      userId,
      'Clubhouse access request submitted',
      `Your clubhouse access request for unit ${unit.unitNumber} is pending admin approval.`,
    ).catch(() => undefined);

    return request;
  }

  // Approve access request
  async approveAccessRequest(requestId: string, approvedBy: string) {
    await this.assertIsAdmin(approvedBy);

    const request = await this.prisma.clubhouseAccessRequest.findUnique({
      where: { id: requestId },
      include: { unit: true },
    });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.clubhouseAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
      },
    });

    await this.notifyUser(
      request.userId,
      'Clubhouse access approved',
      `Your clubhouse access request for unit ${request.unit?.unitNumber ?? ''} has been approved.`,
    ).catch(() => undefined);

    return updated;
  }

  // Reject access request
  async rejectAccessRequest(requestId: string, rejectedBy: string) {
    await this.assertIsAdmin(rejectedBy);
    const request = await this.prisma.clubhouseAccessRequest.findUnique({
      where: { id: requestId },
      include: { unit: true },
    });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.clubhouseAccessRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
      },
    });

    await this.notifyUser(
      request.userId,
      'Clubhouse access rejected',
      `Your clubhouse access request for unit ${request.unit?.unitNumber ?? ''} was rejected.`,
    ).catch(() => undefined);

    return updated;
  }

  // Get pending requests
  async getPendingRequests(requestedBy: string) {
    await this.assertIsAdmin(requestedBy);
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
