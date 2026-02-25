import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessGrantPermission,
  AccessStatus,
  QRType,
  UnitAccessRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAccessQrCodeDto } from './dto/create-access-qr-code.dto';
import { HikCentralQrService } from './hikcentral/hikcentral-qr.service';

@Injectable()
export class AccessControlService {
  private readonly enforceSingleActivePerTypeUnit =
    (process.env.QR_ENFORCE_SINGLE_ACTIVE ?? 'true').toLowerCase() !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikCentralQr: HikCentralQrService,
  ) {}

  private async isAdminUser(userId: string): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    return !!admin;
  }

  private defaultDurationForType(
    type: QRType,
  ): { value: number; unit: 'm' | 'h' } {
    switch (type) {
      case QRType.SELF:
        return { value: 5, unit: 'm' };
      case QRType.DELIVERY:
        return { value: 30, unit: 'm' };
      case QRType.VISITOR:
      case QRType.WORKER:
      case QRType.SERVICE_PROVIDER:
      case QRType.RIDESHARE:
      default:
        return { value: 1, unit: 'h' };
    }
  }

  private defaultPermissionsForType(type: QRType): AccessGrantPermission[] {
    switch (type) {
      case QRType.DELIVERY:
        return [AccessGrantPermission.DELIVER];
      case QRType.WORKER:
      case QRType.SERVICE_PROVIDER:
        return [AccessGrantPermission.WORK];
      case QRType.SELF:
      case QRType.VISITOR:
      case QRType.RIDESHARE:
      default:
        return [AccessGrantPermission.ENTER];
    }
  }

  private requiresAccessGrant(type: QRType): boolean {
    switch (type) {
      case QRType.VISITOR:
      case QRType.DELIVERY:
      case QRType.WORKER:
      case QRType.SERVICE_PROVIDER:
        return true;
      case QRType.SELF:
      case QRType.RIDESHARE:
      default:
        return false;
    }
  }

  private async assertHasActiveUnitAccess(userId: string, unitId: string) {
    const now = new Date();
    const access = await this.prisma.unitAccess.findFirst({
      where: {
        userId,
        unitId,
        status: AccessStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });
    if (!access) {
      throw new ForbiddenException('You do not have active access to this unit');
    }
    return access;
  }

  private async assertCanGenerateQr(userId: string, unitId: string) {
    const access = await this.assertHasActiveUnitAccess(userId, unitId);
    if (!access.canGenerateQR) {
      throw new ForbiddenException(
        'You do not have permission to generate QR codes for this unit',
      );
    }
    return access;
  }

  private async assertIsUnitOwner(userId: string, unitId: string) {
    const now = new Date();
    const access = await this.prisma.unitAccess.findFirst({
      where: {
        userId,
        unitId,
        role: UnitAccessRole.OWNER,
        status: AccessStatus.ACTIVE,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException('Only the unit owner can perform this action');
    }
  }

  private computeValidity(type: QRType, validFrom?: Date, validTo?: Date) {
    const from = validFrom ?? new Date();
    if (validTo) return { validFrom: from, validTo };

    const duration = this.defaultDurationForType(type);
    const to = dayjs(from)
      .add(duration.value, duration.unit === 'm' ? 'minute' : 'hour')
      .toDate();
    return { validFrom: from, validTo: to };
  }

  async generateQrCode(dto: CreateAccessQrCodeDto, userId: string) {
    if (dto.type === QRType.VISITOR && !dto.visitorName) {
      throw new BadRequestException('visitorName is required for VISITOR QR');
    }

    const isAdmin = await this.isAdminUser(userId);
    if (!isAdmin) {
      await this.assertCanGenerateQr(userId, dto.unitId);
    }

    const { validFrom, validTo } = this.computeValidity(
      dto.type,
      dto.validFrom,
      dto.validTo,
    );

    if (validTo <= validFrom) {
      throw new BadRequestException('validTo must be after validFrom');
    }

    const gates = dto.gates ?? [];

    if (this.enforceSingleActivePerTypeUnit) {
      const existing = await this.prisma.accessQRCode.findFirst({
        where: {
          unitId: dto.unitId,
          type: dto.type,
          status: AccessStatus.ACTIVE,
          validTo: { gt: new Date() },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          'An active QR code already exists for this type and unit',
        );
      }
    }

    const permissions = dto.permissions ?? this.defaultPermissionsForType(dto.type);
    const needsGrant = this.requiresAccessGrant(dto.type);

    let accessGrantId: string | undefined;
    let accessProfileId: string | undefined;
    try {
      if (needsGrant) {
        const accessProfile = await this.prisma.accessProfile.create({
          data: {
            fullName: dto.visitorName || `QR ${dto.type}`,
            nationalId: `QR-${randomUUID()}`,
          },
          select: { id: true },
        });
        accessProfileId = accessProfile.id;

        const grant = await this.prisma.accessGrant.create({
          data: {
            accessProfileId: accessProfile.id,
            unitId: dto.unitId,
            validFrom,
            validTo,
            permissions,
          },
          select: { id: true },
        });

        accessGrantId = grant.id;
      }

      const hik = await this.hikCentralQr.createQrCode({
        unitId: dto.unitId,
        type: dto.type,
        validFrom,
        validTo,
        visitorName: dto.visitorName,
        permissions,
        gates,
        notes: dto.notes,
      });

      const qrCode = await this.prisma.accessQRCode.create({
        data: {
          qrId: hik.qrId,
          type: dto.type,
          generatedById: userId,
          unitId: dto.unitId,
          accessGrantId,
          visitorName: dto.visitorName,
          validFrom,
          validTo,
          status: AccessStatus.ACTIVE,
          gates,
          notes: dto.notes,
        },
      });

      return { qrCode, qrImageBase64: hik.qrImageBase64 };
    } catch (err: unknown) {
      if (accessGrantId) {
        await this.prisma.accessGrant
          .delete({ where: { id: accessGrantId } })
          .catch(() => undefined);
      }
      if (accessProfileId) {
        await this.prisma.accessProfile
          .delete({ where: { id: accessProfileId } })
          .catch(() => undefined);
      }
      throw err;
    }
  }

  async listQrCodes(userId: string, unitId?: string, includeInactive?: boolean) {
    const isAdmin = await this.isAdminUser(userId);
    let accessForUnit:
      | Awaited<ReturnType<AccessControlService['assertHasActiveUnitAccess']>>
      | undefined;
    if (unitId && !isAdmin) {
      accessForUnit = await this.assertHasActiveUnitAccess(userId, unitId);
    }

    const canViewAllForUnit = isAdmin || accessForUnit?.role === UnitAccessRole.OWNER;
    const scopeWhere = unitId
      ? canViewAllForUnit
        ? { unitId }
        : { unitId, generatedById: userId }
      : isAdmin
        ? {}
        : { generatedById: userId };

    await this.prisma.accessQRCode.updateMany({
      where: {
        ...scopeWhere,
        status: AccessStatus.ACTIVE,
        validTo: { lte: new Date() },
      },
      data: { status: AccessStatus.EXPIRED },
    });

    const where: any = { ...scopeWhere };
    if (!includeInactive) {
      where.status = AccessStatus.ACTIVE;
    }

    return this.prisma.accessQRCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeQrCode(userId: string, qrCodeId: string) {
    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
    });
    if (!qr) throw new NotFoundException('QR code not found');

    const isAdmin = await this.isAdminUser(userId);
    if (qr.generatedById !== userId) {
      if (isAdmin) {
        // Admin override path for dashboard operations.
      } else if (!qr.unitId) {
        throw new ForbiddenException('You are not allowed to revoke this QR');
      } else {
        await this.assertIsUnitOwner(userId, qr.unitId);
      }
    }

    if (qr.status !== AccessStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE QR codes can be revoked');
    }

    return this.prisma.accessQRCode.update({
      where: { id: qrCodeId },
      data: { status: AccessStatus.REVOKED },
    });
  }
}
