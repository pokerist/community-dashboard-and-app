import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDelegateDto } from './dto/create-delegate.dto';
import { CreateDelegateByContactDto } from './dto/create-delegate-by-contact.dto';
import { UpdateDelegateDto } from './dto/update-delegate.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Audience,
  Channel,
  FileCategory,
  NotificationType,
  UnitStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class DelegatesService {
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
    const admins = await this.prisma.admin.findMany({
      select: { userId: true },
    });
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

  private coerceOptionalDate(value?: string) {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    return d;
  }

  private async sendCredentialSetupIfNeeded(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user) return;
    if (user.passwordHash) return;
    if (!user.email) return;

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await this.notificationsService.sendNotification(
      {
        type: NotificationType.OTP,
        title: 'Set up your account',
        messageEn: `Your delegate access has been approved. Set your password here: ${resetLink}`,
        channels: [Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [user.id] },
      },
      undefined,
    );
  }

  private async ensureCommunityRole(userId: string) {
    const communityRole = await this.prisma.role.findUnique({
      where: { name: 'COMMUNITY_USER' },
      select: { id: true },
    });
    if (!communityRole) return;

    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: communityRole.id,
        },
      },
      select: { userId: true },
    });
    if (existing) return;

    await this.prisma.userRole.create({
      data: {
        userId,
        roleId: communityRole.id,
      },
    });
  }

  async createDelegateRequestByContact(
    dto: CreateDelegateByContactDto,
    requestedBy: string,
  ) {
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone.trim();
    const name = dto.name.trim();
    if (!email) throw new BadRequestException('email is required');
    if (!phone) throw new BadRequestException('phone is required');
    if (!name) throw new BadRequestException('name is required');

    const [existingByEmail, existingByPhone] = await Promise.all([
      this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, phone: true, nameEN: true },
      }),
      this.prisma.user.findFirst({
        where: { phone },
        select: { id: true, email: true, phone: true, nameEN: true },
      }),
    ]);

    if (
      existingByEmail &&
      existingByPhone &&
      existingByEmail.id !== existingByPhone.id
    ) {
      throw new BadRequestException(
        'Email and phone belong to different existing users',
      );
    }

    let userId = existingByEmail?.id ?? existingByPhone?.id;
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          nameEN: name || undefined,
          email,
          phone,
        },
      });
      await this.ensureCommunityRole(userId);
    } else {
      const communityRole = await this.prisma.role.findUnique({
        where: { name: 'COMMUNITY_USER' },
        select: { id: true },
      });

      const created = await this.prisma.user.create({
        data: {
          nameEN: name,
          email,
          phone,
          signupSource: 'mobile_delegate_request',
          userStatus: 'INVITED' as any,
          roles: communityRole
            ? {
                create: [{ roleId: communityRole.id }],
              }
            : undefined,
        },
        select: { id: true },
      });
      userId = created.id;
    }

    const createDto: CreateDelegateDto = {
      userId,
      unitId: dto.unitId,
      type: dto.type,
      idFileId: dto.idFileId,
      startsAt: dto.startsAt,
      endsAt: dto.endsAt,
      canViewFinancials: dto.canViewFinancials,
      canReceiveBilling: dto.canReceiveBilling,
      canBookFacilities: dto.canBookFacilities,
      canGenerateQR: dto.canGenerateQR,
      canManageWorkers: dto.canManageWorkers,
    };

    return this.createDelegateRequest(createDto, requestedBy);
  }

  // Create delegate request (by owner)
  async createDelegateRequest(dto: CreateDelegateDto, requestedBy: string) {
    // Check if unit is delivered
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
    const allowedUnitStatuses: UnitStatus[] = [
      UnitStatus.DELIVERED,
      UnitStatus.OCCUPIED,
      UnitStatus.LEASED,
    ];
    if (!allowedUnitStatuses.includes(unit.status)) {
      throw new ForbiddenException(
        'Cannot add delegates until unit is delivered/occupied/leased',
      );
    }

    // Check if requester is the owner
    const ownerAccess = await this.prisma.unitAccess.findFirst({
      where: {
        unitId: dto.unitId,
        userId: requestedBy,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    if (!ownerAccess) {
      throw new ForbiddenException('Only owner can add delegates');
    }

    // Check if user already has access
    const existingAccess = await this.prisma.unitAccess.findFirst({
      where: {
        unitId: dto.unitId,
        userId: dto.userId,
        status: { in: ['PENDING', 'APPROVED', 'ACTIVE'] },
      },
    });
    if (existingAccess) {
      throw new BadRequestException('User already has access to this unit');
    }

    const delegateUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true, phone: true },
    });
    if (!delegateUser) {
      throw new NotFoundException('Delegate user not found');
    }

    const idFile = await this.prisma.file.findUnique({
      where: { id: dto.idFileId },
      select: { id: true, category: true },
    });
    if (!idFile) {
      throw new BadRequestException('Delegate ID file not found');
    }
    const allowedIdFileCategories: FileCategory[] = [
      FileCategory.DELEGATE_ID,
      FileCategory.NATIONAL_ID,
    ];
    if (!allowedIdFileCategories.includes(idFile.category)) {
      throw new BadRequestException(
        'idFileId must be a DELEGATE_ID or NATIONAL_ID file',
      );
    }

    // Update user's national ID file
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { nationalIdFileId: dto.idFileId },
    });

    // Create pending delegate access
    const startsAt = this.coerceOptionalDate(dto.startsAt) ?? new Date();
    const endsAt = this.coerceOptionalDate(dto.endsAt);
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const access = await this.prisma.unitAccess.create({
      data: {
        unitId: dto.unitId,
        userId: dto.userId,
        role: 'DELEGATE',
        delegateType: dto.type,
        startsAt,
        endsAt,
        grantedBy: requestedBy,
        status: 'PENDING', // Wait for admin approval
        source: 'OWNER_DELEGATION',
        canViewFinancials: dto.canViewFinancials ?? true,
        canReceiveBilling: dto.canReceiveBilling ?? false,
        canBookFacilities: dto.canBookFacilities ?? true,
        canGenerateQR: dto.canGenerateQR ?? true,
        canManageWorkers: dto.canManageWorkers ?? true,
      },
    });

    await this.notifyAdmins(
      'Delegate request pending',
      `A new delegate request was created for unit ${unit.unitNumber}.`,
    ).catch(() => undefined);

    await this.notifyUser(
      dto.userId,
      'Delegate request submitted',
      `Your delegate access request for unit ${unit.unitNumber} is pending admin approval.`,
    ).catch(() => undefined);

    return access;
  }

  // Approve delegate (by admin)
  async approveDelegate(unitAccessId: string, approvedBy: string) {
    await this.assertIsAdmin(approvedBy);

    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
      include: { unit: true, user: true },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }
    if (access.status !== 'PENDING') {
      throw new BadRequestException('Delegate is not pending approval');
    }

    if (!access.user.email) {
      throw new BadRequestException('Delegate must have an email before approval');
    }
    if (!access.user.phone) {
      throw new BadRequestException('Delegate must have a phone number before approval');
    }
    if (!access.user.nationalIdFileId) {
      throw new BadRequestException('Delegate must have an ID document before approval');
    }

    // Update status to ACTIVE
    const updatedAccess = await this.prisma.unitAccess.update({
      where: { id: unitAccessId },
      data: { status: 'ACTIVE' },
    });

    await this.notifyUser(
      access.userId,
      'Delegate access approved',
      `Your delegate access for unit ${access.unit?.unitNumber ?? ''} is now active.`,
    ).catch(() => undefined);

    await this.sendCredentialSetupIfNeeded(access.userId).catch(() => undefined);

    return updatedAccess;
  }

  // Revoke delegate (by admin or owner)
  async revokeDelegate(unitAccessId: string, revokedBy: string) {
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
      include: { unit: true },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }

    // Check permission: admin or owner
    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: revokedBy },
    });
    const isOwner =
      access.unit &&
      (await this.prisma.unitAccess.findFirst({
        where: {
          unitId: access.unitId,
          userId: revokedBy,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      }));

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Not authorized to revoke delegate');
    }

    // Update status to REVOKED
    const updatedAccess = await this.prisma.unitAccess.update({
      where: { id: unitAccessId },
      data: { status: 'REVOKED', endsAt: new Date() },
    });

    await this.notifyUser(
      access.userId,
      'Delegate access revoked',
      `Your delegate access for unit ${access.unit?.unitNumber ?? ''} has been revoked.`,
    ).catch(() => undefined);

    return updatedAccess;
  }

  // Get delegates for a unit
  async getDelegatesForUnit(unitId: string, requestedBy: string) {
    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: requestedBy },
      select: { id: true },
    });
    const isOwner = await this.prisma.unitAccess.findFirst({
      where: {
        unitId,
        userId: requestedBy,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Not authorized to view delegates for this unit');
    }

    return this.prisma.unitAccess.findMany({
      where: {
        unitId,
        role: 'DELEGATE',
      },
      include: {
        user: true,
      },
    });
  }

  // Get pending delegate requests
  async getPendingRequests(requestedBy: string) {
    await this.assertIsAdmin(requestedBy);
    return this.prisma.unitAccess.findMany({
      where: {
        role: 'DELEGATE',
        status: 'PENDING',
      },
      include: {
        user: true,
        unit: true,
      },
    });
  }

  // Update delegate permissions
  async updateDelegate(unitAccessId: string, dto: UpdateDelegateDto, updatedBy: string) {
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }

    const isAdmin = await this.prisma.admin.findUnique({
      where: { userId: updatedBy },
      select: { id: true },
    });
    const isOwner = await this.prisma.unitAccess.findFirst({
      where: {
        unitId: access.unitId,
        userId: updatedBy,
        role: 'OWNER',
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Not authorized to update this delegate');
    }

    const startsAt = this.coerceOptionalDate(dto.startsAt as any);
    const endsAt = this.coerceOptionalDate(dto.endsAt as any);
    if (startsAt && endsAt && endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    return this.prisma.unitAccess.update({
      where: { id: unitAccessId },
      data: {
        startsAt: startsAt ?? undefined,
        endsAt: endsAt ?? undefined,
        canViewFinancials: dto.canViewFinancials,
        canReceiveBilling: dto.canReceiveBilling,
        canBookFacilities: dto.canBookFacilities,
        canGenerateQR: dto.canGenerateQR,
        canManageWorkers: dto.canManageWorkers,
      },
    });
  }

  // Remove delegate (hard delete)
  async remove(unitAccessId: string, removedBy: string) {
    await this.assertIsAdmin(removedBy);
    const access = await this.prisma.unitAccess.findUnique({
      where: { id: unitAccessId },
    });
    if (!access || access.role !== 'DELEGATE') {
      throw new NotFoundException('Delegate access not found');
    }

    return this.prisma.unitAccess.delete({
      where: { id: unitAccessId },
    });
  }
}
