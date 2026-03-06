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
  Audience,
  Channel,
  EntityStatus,
  GateAccessRole,
  GateDirection,
  GateScanResult,
  NotificationType,
  Prisma,
  QRType,
  UnitAccessRole,
} from '@prisma/client';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAccessQrCodeDto } from './dto/create-access-qr-code.dto';
import { HikCentralQrService } from './hikcentral/hikcentral-qr.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AccessControlService {
  private readonly enforceSingleActivePerTypeUnit =
    (process.env.QR_ENFORCE_SINGLE_ACTIVE ?? 'true').toLowerCase() !== 'false';

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikCentralQr: HikCentralQrService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async isAdminUser(userId: string): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    return !!admin;
  }

  private async getRequesterSnapshot(userId: string): Promise<{
    requesterNameSnapshot: string | null;
    requesterPhoneSnapshot: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nameEN: true, nameAR: true, phone: true },
    });
    return {
      requesterNameSnapshot: user?.nameEN?.trim() || user?.nameAR?.trim() || null,
      requesterPhoneSnapshot: user?.phone?.trim() || null,
    };
  }

  private async assertGateOperator(userId: string) {
    const isAdmin = await this.isAdminUser(userId);
    if (isAdmin) return;
    throw new ForbiddenException('Only gate operators/admin users can perform this action');
  }

  private roleFromQrType(type: QRType): GateAccessRole {
    switch (type) {
      case QRType.DELIVERY:
        return GateAccessRole.DELIVERY;
      case QRType.WORKER:
      case QRType.SERVICE_PROVIDER:
        return GateAccessRole.WORKER;
      case QRType.RIDESHARE:
        return GateAccessRole.RIDESHARE;
      case QRType.SELF:
        return GateAccessRole.RESIDENT;
      case QRType.VISITOR:
      default:
        return GateAccessRole.VISITOR;
    }
  }

  private async getConfiguredUnitGateIds(unitId: string): Promise<string[]> {
    const rows = await this.prisma.gateUnitAccess.findMany({
      where: {
        unitId,
        deletedAt: null,
        gate: {
          deletedAt: null,
          status: EntityStatus.ACTIVE,
        },
      },
      select: { gateId: true },
    });

    return rows.map((row) => row.gateId);
  }

  private async resolveGateForScan(
    qrGateScope: string[],
    gateId?: string,
  ): Promise<{ id: string; name: string } | null> {
    if (!gateId) {
      return null;
    }

    const gate = await this.prisma.gate.findFirst({
      where: {
        id: gateId,
        deletedAt: null,
        status: EntityStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
      },
    });
    if (!gate) {
      throw new BadRequestException('Gate not found or inactive');
    }

    if (qrGateScope.length > 0 && !qrGateScope.includes(gate.id)) {
      throw new ForbiddenException('QR code is not valid for this gate');
    }

    return gate;
  }

  private async logGateEntry(params: {
    qrCodeId: string;
    unitId: string | null;
    gateId?: string | null;
    direction: GateDirection;
    result: GateScanResult;
    qrType: QRType;
    operatorUserId: string;
    visitorName?: string | null;
    notes?: string | null;
    scannedAt: Date;
  }): Promise<void> {
    await this.prisma.gateEntryLog.create({
      data: {
        qrCodeId: params.qrCodeId,
        unitId: params.unitId ?? null,
        gateId: params.gateId ?? null,
        direction: params.direction,
        result: params.result,
        scanRole: this.roleFromQrType(params.qrType),
        operatorUserId: params.operatorUserId,
        visitorNameSnapshot: params.visitorName ?? null,
        scannedAt: params.scannedAt,
        notes: params.notes ?? null,
      },
    });
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

  private assertWorkerWindow(validFrom: Date) {
    const now = new Date();
    const leadHours = (validFrom.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (leadHours < 24) {
      throw new BadRequestException(
        'Worker permits must be requested at least 24 hours in advance',
      );
    }

    const day = validFrom.getDay(); // 0=Sun ... 5=Fri ... 6=Sat
    if (day === 5 || day === 6) {
      throw new BadRequestException(
        'Worker permits cannot start on Friday or Saturday',
      );
    }
  }

  private async notifyAdminsWorkerPermitPending(params: {
    qrId: string;
    unitId: string;
    requestedById: string;
    visitorName: string | null;
    validFrom: Date;
    validTo: Date;
  }) {
    try {
      const admins = await this.prisma.admin.findMany({
        select: { userId: true },
      });
      const userIds = admins.map((x) => x.userId).filter(Boolean);
      if (!userIds.length) return;

      await this.notificationsService.sendNotification(
        {
          type: NotificationType.MAINTENANCE_ALERT,
          title: 'Worker permit requires approval',
          messageEn: `A new worker permit request is waiting for approval (Unit ${params.unitId}).`,
          messageAr:
            'يوجد طلب تصريح عمال جديد بانتظار الموافقة من الإدارة.',
          channels: [Channel.IN_APP],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds },
          payload: {
            route: '/access-control',
            entityType: 'ACCESS_QR',
            entityId: params.qrId,
            eventKey: 'worker_qr.pending',
            requesterId: params.requestedById,
            unitId: params.unitId,
            visitorName: params.visitorName,
            validFrom: params.validFrom.toISOString(),
            validTo: params.validTo.toISOString(),
          },
        },
        params.requestedById,
      );
    } catch {
      // Worker request should never fail due to notification delivery issues.
    }
  }

  private async notifyOwnerWorkerPermitApproved(params: {
    qrId: string;
    ownerUserId: string;
    unitId: string | null;
    approvedById: string;
    visitorName: string | null;
  }) {
    try {
      await this.notificationsService.sendNotification(
        {
          type: NotificationType.ANNOUNCEMENT,
          title: 'Worker permit approved',
          messageEn:
            'Your workers permit has been approved. You can now share the generated QR code.',
          messageAr:
            'تمت الموافقة على تصريح العمال. يمكنك الآن مشاركة رمز الدخول.',
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [params.ownerUserId] },
          payload: {
            route: '/qr-codes',
            entityType: 'ACCESS_QR',
            entityId: params.qrId,
            eventKey: 'worker_qr.approved',
            unitId: params.unitId,
            visitorName: params.visitorName,
          },
        },
        params.approvedById,
      );
    } catch {
      // Approval should never fail due to notification issues.
    }
  }

  private async notifyOwnerWorkerPermitRejected(params: {
    qrId: string;
    ownerUserId: string;
    rejectedById: string;
    reason?: string;
  }) {
    try {
      await this.notificationsService.sendNotification(
        {
          type: NotificationType.ANNOUNCEMENT,
          title: 'Worker permit rejected',
          messageEn: params.reason
            ? `Your workers permit was rejected: ${params.reason}`
            : 'Your workers permit was rejected by management.',
          messageAr:
            'تم رفض تصريح العمال من الإدارة. يمكنك مراجعة التفاصيل والتقديم مرة أخرى.',
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [params.ownerUserId] },
          payload: {
            route: '/qr-codes',
            entityType: 'ACCESS_QR',
            entityId: params.qrId,
            eventKey: 'worker_qr.rejected',
            reason: params.reason ?? null,
          },
        },
        params.rejectedById,
      );
    } catch {
      // Rejection flow should not break on notification failure.
    }
  }

  private async notifyOwnerQrUsedArrival(params: {
    qrId: string;
    ownerUserId: string;
    visitorName: string | null;
    gateName?: string | null;
    scannedAt: Date;
    actorUserId: string;
  }) {
    try {
      const visitor = params.visitorName?.trim() || 'Visitor';
      const gatePart = params.gateName ? ` via ${params.gateName}` : '';
      await this.notificationsService.sendNotification(
        {
          type: NotificationType.ANNOUNCEMENT,
          title: 'QR scanned: visitor arrived',
          messageEn: `${visitor} has arrived${gatePart}.`,
          messageAr: 'تم استخدام رمز الدخول ووصول الزائر.',
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [params.ownerUserId] },
          payload: {
            route: '/qr-codes',
            entityType: 'ACCESS_QR',
            entityId: params.qrId,
            eventKey: 'access_qr.used',
            visitorName: params.visitorName,
            gateName: params.gateName ?? null,
            scannedAt: params.scannedAt.toISOString(),
          },
        },
        params.actorUserId,
      );
    } catch {
      // QR status update should not fail due to notification delivery issues.
    }
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
    const isWorkerPermit = dto.type === QRType.WORKER && !isAdmin;
    if (isWorkerPermit) {
      this.assertWorkerWindow(validFrom);
    }

    if (validTo <= validFrom) {
      throw new BadRequestException('validTo must be after validFrom');
    }

    const usageMode =
      dto.usageMode === 'MULTI_USE' ? 'MULTI_USE' : 'SINGLE_USE';
    const requestedGates = dto.gates ?? [];
    const gates =
      dto.type === QRType.VISITOR && requestedGates.length === 0
        ? await this.getConfiguredUnitGateIds(dto.unitId)
        : requestedGates;
    const requesterSnapshot = await this.getRequesterSnapshot(userId);

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

      if (isWorkerPermit) {
        const qrCode = await this.prisma.accessQRCode.create({
          data: {
            qrId: `PENDING-${randomUUID()}`,
            type: dto.type,
            usageMode,
            generatedById: userId,
            unitId: dto.unitId,
            accessGrantId,
            visitorName: dto.visitorName,
            validFrom,
            validTo,
            status: AccessStatus.PENDING,
            gates,
            notes: dto.notes,
            requesterNameSnapshot: requesterSnapshot.requesterNameSnapshot,
            requesterPhoneSnapshot: requesterSnapshot.requesterPhoneSnapshot,
            qrImageBase64: null,
          },
        });

        await this.notifyAdminsWorkerPermitPending({
          qrId: qrCode.id,
          unitId: dto.unitId,
          requestedById: userId,
          visitorName: dto.visitorName ?? null,
          validFrom,
          validTo,
        });

        return {
          qrCode,
          qrImageBase64: null,
          pendingApproval: true,
          hasQrImage: false,
        };
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
          usageMode,
          generatedById: userId,
          unitId: dto.unitId,
          accessGrantId,
          visitorName: dto.visitorName,
          validFrom,
          validTo,
          status: AccessStatus.ACTIVE,
          gates,
          notes: dto.notes,
          requesterNameSnapshot: requesterSnapshot.requesterNameSnapshot,
          requesterPhoneSnapshot: requesterSnapshot.requesterPhoneSnapshot,
          qrImageBase64: hik.qrImageBase64,
        },
      });

      return {
        qrCode,
        qrImageBase64: hik.qrImageBase64,
        pendingApproval: false,
        hasQrImage: Boolean(hik.qrImageBase64),
      };
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

  async approveWorkerQrCode(actorUserId: string, qrCodeId: string) {
    const isAdmin = await this.isAdminUser(actorUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can approve worker permits');
    }

    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
      select: {
        id: true,
        type: true,
        status: true,
        generatedById: true,
        unitId: true,
        visitorName: true,
        validFrom: true,
        validTo: true,
        notes: true,
      },
    });

    if (!qr) throw new NotFoundException('QR code not found');
    if (qr.type !== QRType.WORKER) {
      throw new BadRequestException('Only worker permits can be approved here');
    }
    if (qr.status !== AccessStatus.PENDING) {
      throw new BadRequestException('Only pending worker permits can be approved');
    }
    if (!qr.unitId) {
      throw new BadRequestException('Worker permit is missing unit reference');
    }

    const permissions = this.defaultPermissionsForType(QRType.WORKER);
    const hik = await this.hikCentralQr.createQrCode({
      unitId: qr.unitId,
      type: QRType.WORKER,
      validFrom: qr.validFrom,
      validTo: qr.validTo,
      visitorName: qr.visitorName ?? undefined,
      permissions,
      gates: [],
      notes: qr.notes ?? undefined,
    });

    const updated = await this.prisma.accessQRCode.update({
      where: { id: qr.id },
      data: {
        qrId: hik.qrId,
        status: AccessStatus.ACTIVE,
        qrImageBase64: hik.qrImageBase64,
      },
    });

    await this.notifyOwnerWorkerPermitApproved({
      qrId: updated.id,
      ownerUserId: qr.generatedById,
      unitId: qr.unitId,
      approvedById: actorUserId,
      visitorName: qr.visitorName ?? null,
    });

    return {
      qrCode: updated,
      qrImageBase64: hik.qrImageBase64,
      pendingApproval: false,
      hasQrImage: Boolean(hik.qrImageBase64),
    };
  }

  async rejectWorkerQrCode(actorUserId: string, qrCodeId: string, reason?: string) {
    const isAdmin = await this.isAdminUser(actorUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can reject worker permits');
    }

    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
      select: {
        id: true,
        type: true,
        status: true,
        generatedById: true,
        notes: true,
      },
    });

    if (!qr) throw new NotFoundException('QR code not found');
    if (qr.type !== QRType.WORKER) {
      throw new BadRequestException('Only worker permits can be rejected here');
    }
    if (qr.status !== AccessStatus.PENDING) {
      throw new BadRequestException('Only pending worker permits can be rejected');
    }

    const updated = await this.prisma.accessQRCode.update({
      where: { id: qr.id },
      data: {
        status: AccessStatus.CANCELLED,
        notes: reason
          ? `${qr.notes ? `${qr.notes}\n` : ''}Rejected by admin: ${reason}`
          : qr.notes ?? undefined,
      },
    });

    await this.notifyOwnerWorkerPermitRejected({
      qrId: updated.id,
      ownerUserId: qr.generatedById,
      rejectedById: actorUserId,
      reason,
    });

    return updated;
  }

  async markQrCodeUsed(
    actorUserId: string,
    qrCodeId: string,
    dto?: {
      scannedAt?: string;
      gateId?: string;
      gateName?: string;
      notes?: string;
    },
  ) {
    const isAdmin = await this.isAdminUser(actorUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admin can mark QR as used');
    }

    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
      select: {
        id: true,
        status: true,
        usageMode: true,
        scans: true,
        type: true,
        unitId: true,
        gates: true,
        generatedById: true,
        visitorName: true,
        notes: true,
      },
    });
    if (!qr) throw new NotFoundException('QR code not found');

    const scannedAt = dto?.scannedAt ? new Date(dto.scannedAt) : new Date();
    if (Number.isNaN(scannedAt.getTime())) {
      throw new BadRequestException('scannedAt must be a valid datetime');
    }
    const gate = await this.resolveGateForScan(qr.gates, dto?.gateId);

    if (qr.status === AccessStatus.USED) {
      return {
        qrCode: qr,
        message: 'QR is already marked as used',
      };
    }
    if (
      qr.status === AccessStatus.CANCELLED ||
      qr.status === AccessStatus.EXPIRED
    ) {
      throw new BadRequestException('Cannot mark a cancelled/expired QR as used');
    }

    const noteParts = [
      qr.notes?.trim() || '',
      dto?.notes?.trim() || '',
      gate?.name
        ? `Scanned at gate: ${gate.name}`
        : dto?.gateName?.trim()
          ? `Scanned at gate: ${dto.gateName.trim()}`
          : '',
      `Marked as USED at ${scannedAt.toISOString()}`,
    ].filter(Boolean);

    const isMultiUse = qr.usageMode === 'MULTI_USE';
    const updated = await this.prisma.accessQRCode.update({
      where: { id: qr.id },
      data: isMultiUse
        ? {
            scans: { increment: 1 },
            notes: noteParts.join('\n'),
          }
        : {
            status: AccessStatus.USED,
            scans: { increment: 1 },
            notes: noteParts.join('\n'),
          },
    });

    await this.logGateEntry({
      qrCodeId: updated.id,
      unitId: qr.unitId ?? null,
      gateId: gate?.id ?? null,
      direction: GateDirection.ENTRY,
      result: GateScanResult.ALLOWED,
      qrType: qr.type,
      operatorUserId: actorUserId,
      visitorName: qr.visitorName ?? null,
      notes: dto?.notes ?? null,
      scannedAt,
    });

    await this.notifyOwnerQrUsedArrival({
      qrId: updated.id,
      ownerUserId: qr.generatedById,
      visitorName: qr.visitorName ?? null,
      gateName: gate?.name ?? dto?.gateName ?? null,
      scannedAt,
      actorUserId,
    });

    return {
      qrCode: updated,
      message: isMultiUse
        ? 'QR scan recorded and owner notified'
        : 'QR marked as used and owner notified',
    };
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

    const where: Prisma.AccessQRCodeWhereInput = {
      ...(scopeWhere as Prisma.AccessQRCodeWhereInput),
    };
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

  async getQrImageForUser(userId: string, qrCodeId: string) {
    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
      select: {
        id: true,
        generatedById: true,
        unitId: true,
        qrImageBase64: true,
      },
    });
    if (!qr) throw new NotFoundException('QR code not found');

    const isAdmin = await this.isAdminUser(userId);
    if (!isAdmin && qr.generatedById !== userId) {
      if (!qr.unitId) {
        throw new ForbiddenException('You are not allowed to view this QR image');
      }
      await this.assertHasActiveUnitAccess(userId, qr.unitId);
    }

    if (!qr.qrImageBase64) {
      throw new NotFoundException('QR image is not available yet');
    }

    return {
      id: qr.id,
      contentType: 'image/png',
      base64: qr.qrImageBase64,
      dataUrl: `data:image/png;base64,${qr.qrImageBase64}`,
    };
  }

  async getGateFeed(
    actorUserId: string,
    filters?: {
      unitNumber?: string;
      type?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    await this.assertGateOperator(actorUserId);
    const from = filters?.from ? new Date(filters.from) : undefined;
    const to = filters?.to ? new Date(filters.to) : undefined;
    const requestedAtFilter =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const where: Prisma.AccessQRCodeWhereInput = {};

    if (requestedAtFilter) {
      where.createdAt = requestedAtFilter;
    }

    if (filters?.unitNumber) {
      where.forUnit = {
        is: {
          unitNumber: {
            contains: String(filters.unitNumber),
            mode: Prisma.QueryMode.insensitive,
          },
        },
      };
    }

    if (filters?.type) {
      const normalizedType = String(filters.type).toUpperCase();
      const validType = Object.values(QRType).find((value) => value === normalizedType);
      if (validType) {
        where.type = validType;
      }
    }

    if (filters?.status) {
      const normalizedStatus = String(filters.status).toUpperCase();
      const validStatus = Object.values(AccessStatus).find(
        (value) => value === normalizedStatus,
      );
      if (validStatus) {
        where.status = validStatus;
      }
    }

    return this.prisma.accessQRCode.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        forUnit: {
          select: { id: true, unitNumber: true, block: true, projectName: true },
        },
        generatedBy: {
          select: { id: true, nameEN: true, email: true, phone: true },
        },
        gateOperator: {
          select: { id: true, nameEN: true, email: true },
        },
      },
      take: 300,
    });
  }

  async checkInQr(
    actorUserId: string,
    qrCodeId: string,
    body?: { gateId?: string; gateName?: string; notes?: string },
  ) {
    await this.assertGateOperator(actorUserId);
    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
      select: {
        id: true,
        type: true,
        unitId: true,
        gates: true,
        status: true,
        generatedById: true,
        visitorName: true,
        notes: true,
        checkedInAt: true,
      },
    });
    if (!qr) throw new NotFoundException('QR code not found');
    if (
      qr.status === AccessStatus.CANCELLED ||
      qr.status === AccessStatus.EXPIRED ||
      qr.status === AccessStatus.REVOKED
    ) {
      throw new BadRequestException('This QR code is not valid for check-in');
    }

    const now = new Date();
    const gate = await this.resolveGateForScan(qr.gates, body?.gateId);
    const lines = [
      qr.notes?.trim() || '',
      body?.notes?.trim() || '',
      gate?.name
        ? `Checked in at gate: ${gate.name}`
        : body?.gateName?.trim()
          ? `Checked in at gate: ${body.gateName.trim()}`
          : '',
      `Checked in at ${now.toISOString()}`,
    ].filter(Boolean);

    const updated = await this.prisma.accessQRCode.update({
      where: { id: qr.id },
      data: {
        checkedInAt: qr.checkedInAt ?? now,
        checkedOutAt: null,
        overdueExitAt: new Date(now.getTime() + 60 * 60 * 1000),
        gateOperatorId: actorUserId,
        notes: lines.join('\n'),
        arrivalNotifiedAt: now,
      },
    });

    await this.logGateEntry({
      qrCodeId: updated.id,
      unitId: qr.unitId ?? null,
      gateId: gate?.id ?? null,
      direction: GateDirection.ENTRY,
      result: GateScanResult.ALLOWED,
      qrType: qr.type,
      operatorUserId: actorUserId,
      visitorName: qr.visitorName ?? null,
      notes: body?.notes ?? null,
      scannedAt: now,
    });

    await this.notifyOwnerQrUsedArrival({
      qrId: updated.id,
      ownerUserId: qr.generatedById,
      visitorName: qr.visitorName ?? null,
      gateName: gate?.name ?? body?.gateName ?? null,
      scannedAt: now,
      actorUserId,
    });

    return updated;
  }

  async checkOutQr(
    actorUserId: string,
    qrCodeId: string,
    body?: { gateId?: string; notes?: string },
  ) {
    await this.assertGateOperator(actorUserId);
    const qr = await this.prisma.accessQRCode.findUnique({
      where: { id: qrCodeId },
      select: {
        id: true,
        type: true,
        unitId: true,
        visitorName: true,
        notes: true,
        gates: true,
      },
    });
    if (!qr) throw new NotFoundException('QR code not found');

    const now = new Date();
    const gate = await this.resolveGateForScan(qr.gates, body?.gateId);
    const lines = [
      qr.notes?.trim() || '',
      body?.notes?.trim() || '',
      gate?.name ? `Checked out at gate: ${gate.name}` : '',
      `Checked out at ${now.toISOString()}`,
    ].filter(Boolean);

    const updated = await this.prisma.accessQRCode.update({
      where: { id: qr.id },
      data: {
        checkedOutAt: now,
        overdueExitAt: null,
        gateOperatorId: actorUserId,
        notes: lines.join('\n'),
      },
    });

    await this.logGateEntry({
      qrCodeId: updated.id,
      unitId: qr.unitId ?? null,
      gateId: gate?.id ?? null,
      direction: GateDirection.EXIT,
      result: GateScanResult.ALLOWED,
      qrType: qr.type,
      operatorUserId: actorUserId,
      visitorName: qr.visitorName ?? null,
      notes: body?.notes ?? null,
      scannedAt: now,
    });

    return updated;
  }

  async processOverdueExits() {
    const now = new Date();
    const overdue = await this.prisma.accessQRCode.findMany({
      where: {
        checkedInAt: { not: null },
        checkedOutAt: null,
        overdueExitAt: { lte: now },
      },
      include: {
        forUnit: { select: { unitNumber: true, block: true } },
      },
      take: 200,
    });
    if (overdue.length === 0) return { processed: 0 };

    const admins = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              permissions: {
                some: {
                    permission: { key: 'admin.update' },
                },
              },
            },
          },
        },
      },
      select: { id: true },
      take: 200,
    });
    const adminIds = admins.map((x) => x.id);

    for (const row of overdue) {
      if (adminIds.length > 0) {
        await this.notificationsService.sendNotification(
          {
            type: NotificationType.EMERGENCY_ALERT,
            title: 'Gate exit overdue',
            messageEn: `Visitor ${row.visitorName || 'Unknown'} did not check out within 1 hour.`,
            channels: [Channel.IN_APP, Channel.PUSH],
            targetAudience: Audience.SPECIFIC_RESIDENCES,
            audienceMeta: { userIds: adminIds },
            payload: {
              route: '/access',
              webRoute: '#gate-live',
              entityType: 'ACCESS_QR',
              entityId: row.id,
              eventKey: 'access_qr.exit_overdue',
              unitNumber: row.forUnit?.unitNumber ?? null,
            },
          },
          undefined,
        );
      }

      await this.prisma.accessQRCode.update({
        where: { id: row.id },
        data: {
          overdueExitAt: new Date(now.getTime() + 15 * 60 * 1000),
        },
      });
    }

    return { processed: overdue.length };
  }
}
