import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationCreatedEvent } from '../../events/contracts/notification-created.event';
import { EmailService } from './email.service';
import { IntegrationConfigService } from '../system-settings/integration-config.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { ListDeviceTokensDto } from './dto/list-device-tokens.dto';
import { SmsProviderService } from './providers/sms-provider.service';
import { PushProviderService } from './providers/push-provider.service';
import { PushDispatchRouterService } from './providers/push-dispatch-router.service';
import {
  Audience,
  Channel,
  NotificationLogStatus,
  NotificationStatus,
  Prisma,
} from '@prisma/client';

type DeliveryMode = 'pending' | 'failed';
type NotificationDedupEntry = {
  notificationId: string;
  expiresAt: number;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly dedupWindowMs = 30_000;
  private readonly dedupCache = new Map<string, NotificationDedupEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
    private readonly integrationConfigService: IntegrationConfigService,
    private readonly smsProvider: SmsProviderService,
    private readonly pushProvider: PushProviderService,
    private readonly pushDispatchRouter: PushDispatchRouterService,
  ) {}

  async getProviderStatus() {
    const integrations = await this.integrationConfigService.getResolvedIntegrations();
    const smsOtpDiagnostics = await this.integrationConfigService.getSmsOtpDiagnostics();
    const pushDispatch = this.pushDispatchRouter.getStatus();
    const capabilities = await this.integrationConfigService.getMobileCapabilities();
    const resendKey = (process.env.RESEND_API_KEY ?? '').trim();
    const resendConfigured = Boolean(resendKey);
    const emailMockMode = this.emailService.isMockMode();
    const emailProvider = resendConfigured
      ? 'resend'
      : integrations.smtp.configured
        ? 'smtp'
        : 'none';

    const fcmConfigured = Boolean((pushDispatch as any)?.fcm?.configured);
    const fcmMockMode = Boolean((pushDispatch as any)?.fcm?.mockMode);
    const expoConfigured = Boolean((pushDispatch as any)?.expo?.configured);
    const expoMockMode = Boolean((pushDispatch as any)?.expo?.mockMode);
    const pushConfigured = fcmConfigured || expoConfigured;
    const pushLive =
      (fcmConfigured && !fcmMockMode) || (expoConfigured && !expoMockMode);
    const effectiveProvider = fcmConfigured
      ? fcmMockMode
        ? 'fcm-mock'
        : 'fcm'
      : expoConfigured
        ? expoMockMode
          ? 'expo-mock'
          : 'expo'
        : 'none';

    const [activeDeviceTokens, recentPushFailures] = await Promise.all([
      this.prisma.notificationDeviceToken.count({ where: { isActive: true } }),
      this.prisma.notificationLog.findMany({
        where: {
          channel: Channel.PUSH,
          status: NotificationLogStatus.FAILED,
        },
        select: {
          id: true,
          notificationId: true,
          recipient: true,
          providerResponse: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const mappedPushFailures = recentPushFailures.map((row) => {
      const response =
        row.providerResponse && typeof row.providerResponse === 'object'
          ? (row.providerResponse as Record<string, unknown>)
          : {};
      const reasonCode = String(
        response.reasonCode ??
          response.reason ??
          this.classifyPushFailure(
            String(response.error ?? response.message ?? ''),
            String(response.provider ?? ''),
          ),
      );
      return {
        id: row.id,
        notificationId: row.notificationId,
        recipient: row.recipient,
        reasonCode,
        message: String(response.error ?? response.message ?? 'Push send failed'),
        createdAt: row.createdAt,
      };
    });

    return {
      providers: {
        email: {
          provider: emailProvider,
          enabled: resendConfigured || integrations.smtp.enabled,
          configured: resendConfigured || integrations.smtp.configured,
          mockMode: emailMockMode,
          resendConfigured,
          smtpEnabled: integrations.smtp.enabled,
          host: integrations.smtp.host || null,
          port: integrations.smtp.port || null,
          from:
            (process.env.RESEND_FROM_EMAIL ?? '').trim() ||
            integrations.smtp.fromEmail ||
            null,
        },
        sms: {
          ...this.smsProvider.getStatus(),
        },
        smsOtp: {
          provider: 'firebase_auth',
          enabled: integrations.smsOtp.enabled,
          configured: integrations.smsOtp.configured,
          reason: smsOtpDiagnostics.reasonCode,
        },
        push: {
          configured: pushConfigured,
          enabled: integrations.fcm.enabled || expoConfigured,
          mockMode: pushConfigured && !pushLive,
          effectiveProvider,
          router: 'auto',
          fcm: (pushDispatch as any)?.fcm ?? null,
          expo: (pushDispatch as any)?.expo ?? null,
        },
        runtime: {
          capabilities,
          diagnostics: {
            activeDeviceTokens,
            recentPushFailures: mappedPushFailures,
          },
        },
      },
    };
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
    const token = dto.token.trim();
    if (!token) throw new BadRequestException('token is required');

    return this.prisma.notificationDeviceToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: dto.platform,
        deviceId: dto.deviceId?.trim() || null,
        appVersion: dto.appVersion?.trim() || null,
        metadata: (dto.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        isActive: true,
        lastUsedAt: new Date(),
      },
      update: {
        userId,
        platform: dto.platform,
        deviceId: dto.deviceId?.trim() || null,
        appVersion: dto.appVersion?.trim() || null,
        metadata: (dto.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        isActive: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async listDeviceTokens(query: ListDeviceTokensDto) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.platform) where.platform = query.platform;
    if (typeof query.isActive === 'boolean') where.isActive = query.isActive;

    const [data, total] = await Promise.all([
      this.prisma.notificationDeviceToken.findMany({
        where,
        include: {
          user: { select: { id: true, nameEN: true, email: true, phone: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.notificationDeviceToken.count({ where }),
    ]);

    return { data, meta: { total } };
  }

  async revokeDeviceToken(tokenId: string, actorUserId: string) {
    const token = await this.prisma.notificationDeviceToken.findUnique({
      where: { id: tokenId },
      select: { id: true, userId: true, isActive: true },
    });
    if (!token) throw new NotFoundException('Device token not found');

    const isAdmin = await this.isAdminUser(actorUserId);
    if (!isAdmin && token.userId !== actorUserId) {
      throw new ForbiddenException('You cannot revoke this device token');
    }

    return this.prisma.notificationDeviceToken.update({
      where: { id: token.id },
      data: { isActive: false },
    });
  }

  async getAllNotifications(page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 && limit <= 100 ? limit : 20;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        include: {
          sender: {
            select: { id: true, nameEN: true, nameAR: true, email: true },
          },
          logs: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.notification.count(),
    ]);

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

  async sendNotification(dto: SendNotificationDto, senderId?: string): Promise<string> {
    const {
      type,
      title,
      messageEn,
      messageAr,
      channels: requestedChannels,
      targetAudience,
      audienceMeta,
      payload,
      scheduledAt,
    } = dto;

    if (!requestedChannels?.length) {
      throw new BadRequestException('At least one channel is required');
    }

    let channels = [...new Set(requestedChannels)];
    const isAdminSender = senderId ? await this.isAdminUser(senderId) : false;
    if (isAdminSender) {
      channels = [...new Set([...channels, Channel.IN_APP, Channel.PUSH])];
    }

    const normalizedAudienceMeta = this.validateAudienceMeta(
      targetAudience,
      audienceMeta,
    );

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const now = new Date();

    const isScheduled =
      scheduledDate !== null && scheduledDate.getTime() > now.getTime();

    const dedupKey = this.buildDedupKey({
      targetAudience,
      audienceMeta: normalizedAudienceMeta,
      payload,
      channels,
      isScheduled,
    });
    const existingDedup = dedupKey ? this.consumeDedupEntry(dedupKey) : null;
    if (existingDedup) {
      this.logger.debug(
        `Skipping duplicate notification for dedupKey=${dedupKey} -> ${existingDedup}`,
      );
      return existingDedup;
    }

    const notification = await this.prisma.notification.create({
      data: {
        type,
        title,
        messageEn,
        messageAr,
        channels,
        targetAudience,
        audienceMeta: normalizedAudienceMeta,
        payload: (payload ?? undefined) as Prisma.InputJsonValue | undefined,
        scheduledAt: scheduledDate,
        senderId,
        sentAt: isScheduled ? null : now,
        status: isScheduled ? NotificationStatus.SCHEDULED : NotificationStatus.PENDING,
      },
    });

    if (isScheduled) {
      this.logger.log(
        `Notification ${notification.id} scheduled for ${scheduledAt}`,
      );
      if (dedupKey) {
        this.rememberDedupEntry(dedupKey, notification.id);
      }
      return notification.id;
    }

    if (dedupKey) {
      this.rememberDedupEntry(dedupKey, notification.id);
    }
    await this.dispatchNow(notification.id);
    return notification.id;
  }

  async dispatchNow(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) return;

    if (
      notification.status === NotificationStatus.SCHEDULED &&
      notification.scheduledAt &&
      notification.scheduledAt > new Date()
    ) {
      return;
    }

    const recipients = await this.resolveRecipients(
      notification.targetAudience,
      notification.audienceMeta,
    );

    await this.createNotificationLogs(notification.id, recipients, notification.channels);

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });

    this.eventEmitter.emit(
      'notification.created',
      new NotificationCreatedEvent(notification.id, notification.channels, recipients),
    );
  }

  async deliverPendingChannels(notificationId: string, channels?: Channel[]) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { logs: true },
    });
    if (!notification) return;

    const targetChannels = (channels?.length ? channels : notification.channels) ?? [];
    for (const channel of targetChannels) {
      switch (channel) {
        case Channel.EMAIL:
          await this.deliverEmail(notification, 'pending');
          break;
        case Channel.SMS:
          await this.deliverSms(notification, 'pending');
          break;
        case Channel.PUSH:
          await this.deliverPush(notification, 'pending');
          break;
        case Channel.IN_APP:
        default:
          break;
      }
    }
  }

  async dispatchScheduled(): Promise<void> {
    const dueNotifications = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.SCHEDULED,
        scheduledAt: { lte: new Date() },
      },
    });

    for (const notification of dueNotifications) {
      await this.dispatchNow(notification.id);
    }
  }

  private validateAudienceMeta(audience: Audience, audienceMeta: any) {
    const meta =
      audienceMeta && typeof audienceMeta === 'object' ? audienceMeta : {};

    switch (audience) {
      case Audience.ALL:
        return undefined;
      case Audience.SPECIFIC_RESIDENCES: {
        const userIds = Array.isArray(meta.userIds)
          ? meta.userIds.filter((v: unknown) => typeof v === 'string' && v.trim())
          : [];
        if (userIds.length === 0) {
          throw new BadRequestException(
            'audienceMeta.userIds is required for SPECIFIC_RESIDENCES',
          );
        }
        return { userIds };
      }
      case Audience.SPECIFIC_BLOCKS: {
        const blocksRaw = meta.blocks ?? meta.block;
        const blocks = Array.isArray(blocksRaw)
          ? blocksRaw.filter((v: unknown) => typeof v === 'string' && v.trim())
          : typeof blocksRaw === 'string' && blocksRaw.trim()
            ? [blocksRaw.trim()]
            : [];
        if (blocks.length === 0) {
          throw new BadRequestException(
            'audienceMeta.blocks is required for SPECIFIC_BLOCKS',
          );
        }
        return { blocks };
      }
      case Audience.SPECIFIC_UNITS: {
        const unitIds = Array.isArray(meta.unitIds)
          ? meta.unitIds.filter((v: unknown) => typeof v === 'string' && v.trim())
          : [];
        if (unitIds.length === 0) {
          throw new BadRequestException(
            'audienceMeta.unitIds is required for SPECIFIC_UNITS',
          );
        }
        return { unitIds };
      }
      default:
        return meta;
    }
  }

  private async resolveRecipients(audience: Audience, audienceMeta?: any): Promise<string[]> {
    const recipients: string[] = [];

    switch (audience) {
      case Audience.ALL: {
        const users = await this.prisma.user.findMany({
          where: { userStatus: 'ACTIVE' },
          select: { id: true },
        });
        recipients.push(...users.map((u) => u.id));
        break;
      }
      case Audience.SPECIFIC_RESIDENCES:
        recipients.push(...(audienceMeta?.userIds ?? []));
        break;
      case Audience.SPECIFIC_UNITS:
        if (audienceMeta?.unitIds?.length) {
          const accesses = await this.prisma.unitAccess.findMany({
            where: {
              unitId: { in: audienceMeta.unitIds },
              status: 'ACTIVE',
            },
            select: { userId: true },
          });
          recipients.push(...accesses.map((r) => r.userId).filter(Boolean));
        }
        break;
      case Audience.SPECIFIC_BLOCKS: {
        const blocksRaw = audienceMeta?.blocks ?? audienceMeta?.block;
        const blocks = Array.isArray(blocksRaw)
          ? blocksRaw
          : typeof blocksRaw === 'string'
            ? [blocksRaw]
            : [];

        if (blocks.length === 0) break;

        const units = await this.prisma.unit.findMany({
          where: { block: { in: blocks } },
          select: { id: true },
        });
        if (!units.length) break;

        const accesses = await this.prisma.unitAccess.findMany({
          where: {
            unitId: { in: units.map((u) => u.id) },
            status: 'ACTIVE',
          },
          select: { userId: true },
        });

        recipients.push(...accesses.map((r) => r.userId).filter(Boolean));
        break;
      }
    }

    return [...new Set(recipients)];
  }

  private async createNotificationLogs(
    notificationId: string,
    recipients: string[],
    channels: Channel[],
  ) {
    const logs = recipients.flatMap((recipient) =>
      channels.map((channel) => ({
        notificationId,
        channel,
        recipient,
        status:
          channel === Channel.IN_APP
            ? NotificationLogStatus.DELIVERED
            : NotificationLogStatus.PENDING,
      })),
    );

    if (logs.length === 0) return;
    await this.prisma.notificationLog.createMany({ data: logs });
  }

  private async getUserAudienceContext(userId: string) {
    const userUnits = await this.prisma.unitAccess.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: { unitId: true, unit: { select: { block: true } } },
    });

    const unitIds = userUnits.map((u) => u.unitId);
    const blocks = [
      ...new Set(
        userUnits
          .map((u) => (u.unit?.block ? String(u.unit.block) : null))
          .filter(Boolean),
      ),
    ] as string[];

    return { unitIds, blocks };
  }

  private async buildUserNotificationWhereClause(
    userId: string,
  ): Promise<Prisma.NotificationWhereInput> {
    const ctx = await this.getUserAudienceContext(userId);

    return {
      OR: [
        { targetAudience: Audience.ALL },
        {
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { path: ['userIds'], array_contains: userId },
        },
        ...ctx.unitIds.map((unitId) => ({
          targetAudience: Audience.SPECIFIC_UNITS,
          audienceMeta: { path: ['unitIds'], array_contains: unitId },
        })),
        ...ctx.blocks.map((block) => ({
          targetAudience: Audience.SPECIFIC_BLOCKS,
          audienceMeta: { path: ['blocks'], array_contains: block },
        })),
      ],
    };
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
    const whereClause = await this.buildUserNotificationWhereClause(userId);

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        include: {
          logs: {
            where: { recipient: userId, channel: Channel.IN_APP },
          },
          sender: { select: { id: true, nameEN: true, nameAR: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.notification.count({ where: whereClause }),
    ]);

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

  async getUserNotificationChanges(userId: string, after?: string, limit = 50) {
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 50;
    let cursorDate =
      typeof after === 'string' && after.trim()
        ? new Date(after)
        : null;
    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new BadRequestException('Invalid "after" datetime cursor');
    }
    if (cursorDate && cursorDate.getTime() > Date.now() + 60_000) {
      this.logger.warn(
        `Ignoring future notification cursor for user ${userId}: ${cursorDate.toISOString()}`,
      );
      cursorDate = null;
    }

    const baseWhere = await this.buildUserNotificationWhereClause(userId);
    const where: Prisma.NotificationWhereInput = {
      AND: [
        baseWhere,
        cursorDate ? { createdAt: { gt: cursorDate } } : {},
      ],
    };

    const data = await this.prisma.notification.findMany({
      where,
      include: {
        logs: {
          where: { recipient: userId, channel: Channel.IN_APP },
        },
        sender: { select: { id: true, nameEN: true, nameAR: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: safeLimit,
    });

    const last = data[data.length - 1];
    return {
      data,
      meta: {
        limit: safeLimit,
        count: data.length,
        nextCursor: last?.createdAt
          ? new Date(last.createdAt).toISOString()
          : cursorDate?.toISOString() ?? null,
        serverTime: new Date().toISOString(),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const log = await this.prisma.notificationLog.findFirst({
      where: {
        notificationId,
        recipient: userId,
        channel: Channel.IN_APP,
      },
    });

    if (!log) return false;

    await this.prisma.notificationLog.update({
      where: { id: log.id },
      data: { status: NotificationLogStatus.READ },
    });

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readCount: { increment: 1 } },
    });

    return true;
  }

  async resendFailedNotification(notificationId: string, actorUserId?: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { logs: true },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    const resendableChannels = new Set<Channel>([
      Channel.EMAIL,
      Channel.SMS,
      Channel.PUSH,
    ]);
    const failedLogs = notification.logs.filter(
      (l) =>
        resendableChannels.has(l.channel) &&
        l.status === NotificationLogStatus.FAILED,
    );

    if (failedLogs.length === 0) {
      return {
        success: true,
        notificationId,
        message: 'No failed channel logs to resend',
        attempted: 0,
        sent: 0,
        failed: 0,
        byChannel: {},
      };
    }

    const channelResults: Record<string, { attempted: number; sent: number; failed: number }> =
      {};

    if (failedLogs.some((l) => l.channel === Channel.EMAIL)) {
      channelResults.EMAIL = await this.deliverEmail(notification, 'failed', actorUserId);
    }
    if (failedLogs.some((l) => l.channel === Channel.SMS)) {
      channelResults.SMS = await this.deliverSms(notification, 'failed', actorUserId);
    }
    if (failedLogs.some((l) => l.channel === Channel.PUSH)) {
      channelResults.PUSH = await this.deliverPush(notification, 'failed', actorUserId);
    }

    const totals = Object.values(channelResults).reduce(
      (acc, item) => ({
        attempted: acc.attempted + item.attempted,
        sent: acc.sent + item.sent,
        failed: acc.failed + item.failed,
      }),
      { attempted: 0, sent: 0, failed: 0 },
    );

    const refreshedFailedLogs = await this.prisma.notificationLog.findMany({
      where: {
        notificationId,
        channel: { in: [Channel.EMAIL, Channel.SMS, Channel.PUSH] },
        status: NotificationLogStatus.FAILED,
      },
      select: {
        channel: true,
        providerResponse: true,
      },
    });
    const failureReasons: Record<string, number> = {};
    for (const log of refreshedFailedLogs) {
      const response =
        log.providerResponse && typeof log.providerResponse === 'object'
          ? (log.providerResponse as Record<string, unknown>)
          : {};
      const reasonCode = String(
        response.reasonCode ??
          response.reason ??
          this.classifyPushFailure(
            String(response.error ?? response.message ?? ''),
            String(response.provider ?? ''),
          ),
      );
      failureReasons[reasonCode] = (failureReasons[reasonCode] ?? 0) + 1;
    }

    return {
      success: true,
      notificationId,
      ...totals,
      byChannel: channelResults,
      failureReasons,
    };
  }

  private async deliverEmail(
    notification: any,
    mode: DeliveryMode,
    actorUserId?: string,
  ): Promise<{ attempted: number; sent: number; failed: number }> {
    const statuses: NotificationLogStatus[] =
      mode === 'pending'
        ? [NotificationLogStatus.PENDING]
        : [NotificationLogStatus.FAILED];

    const targetLogs = notification.logs.filter(
      (l: any) => l.channel === Channel.EMAIL && statuses.includes(l.status),
    );
    if (!targetLogs.length) return { attempted: 0, sent: 0, failed: 0 };

    const integrations = await this.integrationConfigService.getResolvedIntegrations();
    const resendConfigured = Boolean((process.env.RESEND_API_KEY ?? '').trim());
    const smtpReady = integrations.smtp.enabled && integrations.smtp.configured;
    const emailReady = resendConfigured || smtpReady;
    if (!emailReady) {
      this.logger.warn(
        `Email provider disabled or not configured. Skipping ${targetLogs.length} email logs for notification ${notification.id}`,
      );
      for (const log of targetLogs) {
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              provider: resendConfigured ? 'resend' : 'smtp',
              mode,
              skipped: true,
              reason: 'EMAIL_PROVIDER_DISABLED_OR_NOT_CONFIGURED',
              reasonCode: 'EMAIL_PROVIDER_DISABLED_OR_NOT_CONFIGURED',
              attemptedAt: new Date().toISOString(),
              actorUserId: actorUserId ?? null,
            } as Prisma.InputJsonValue),
          },
        });
      }
      return { attempted: targetLogs.length, sent: 0, failed: targetLogs.length };
    }

    const recipients: string[] = [
      ...new Set<string>(targetLogs.map((l: any) => String(l.recipient))),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: recipients }, email: { not: null } },
      select: { id: true, email: true },
    });
    const userEmailById = new Map(users.map((u) => [u.id, u.email!] as const));

    let sent = 0;
    let failed = 0;
    const htmlContent = this.buildEmailContent(notification);

    for (const log of targetLogs) {
      const metaBase = {
        provider: resendConfigured ? 'resend' : 'smtp',
        mode,
        attemptedAt: new Date().toISOString(),
        actorUserId: actorUserId ?? null,
      };
      const email = userEmailById.get(log.recipient);
      if (!email) {
        failed += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              ...metaBase,
              error: 'User has no email or user not found',
            } as Prisma.InputJsonValue),
          },
        });
        continue;
      }

      try {
        await this.emailService.sendEmail(notification.title, email, htmlContent);
        sent += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.SENT,
            providerResponse: ({
              ...metaBase,
              to: email,
            } as Prisma.InputJsonValue),
          },
        });
      } catch (error: unknown) {
        failed += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              ...metaBase,
              to: email,
              error: error instanceof Error ? error.message : String(error),
            } as Prisma.InputJsonValue),
          },
        });
      }
    }

    return { attempted: targetLogs.length, sent, failed };
  }

  private async deliverSms(
    notification: any,
    mode: DeliveryMode,
    actorUserId?: string,
  ): Promise<{ attempted: number; sent: number; failed: number }> {
    const statuses: NotificationLogStatus[] =
      mode === 'pending'
        ? [NotificationLogStatus.PENDING]
        : [NotificationLogStatus.FAILED];

    const targetLogs = notification.logs.filter(
      (l: any) => l.channel === Channel.SMS && statuses.includes(l.status),
    );
    if (!targetLogs.length) return { attempted: 0, sent: 0, failed: 0 };

    const integrations = await this.integrationConfigService.getResolvedIntegrations();
    if (!integrations.smsOtp.enabled || !integrations.smsOtp.configured) {
      this.logger.warn(
        `SMS OTP provider disabled or not configured. Skipping ${targetLogs.length} sms logs for notification ${notification.id}`,
      );
      for (const log of targetLogs) {
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              provider: 'sms_otp',
              mode,
              skipped: true,
              reason: 'SMS_DISABLED_OR_NOT_CONFIGURED',
              attemptedAt: new Date().toISOString(),
              actorUserId: actorUserId ?? null,
            } as Prisma.InputJsonValue),
          },
        });
      }
      return { attempted: targetLogs.length, sent: 0, failed: targetLogs.length };
    }

    const recipients: string[] = [
      ...new Set<string>(targetLogs.map((l: any) => String(l.recipient))),
    ];
    const users = await this.prisma.user.findMany({
      where: { id: { in: recipients }, phone: { not: null } },
      select: { id: true, phone: true, preferredLanguage: true },
    });
    const phoneByUserId = new Map(users.map((u) => [u.id, u.phone!] as const));
    const languageByUserId = new Map(
      users.map((u) => [u.id, String(u.preferredLanguage ?? '').toLowerCase()] as const),
    );

    let sent = 0;
    let failed = 0;

    for (const log of targetLogs) {
      const metaBase = {
        provider: 'sms_otp',
        mode,
        attemptedAt: new Date().toISOString(),
        actorUserId: actorUserId ?? null,
      };
      const phone = phoneByUserId.get(log.recipient);
      if (!phone) {
        failed += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              ...metaBase,
              error: 'User has no phone or user not found',
            } as Prisma.InputJsonValue),
          },
        });
        continue;
      }
      const smsBody = this.buildSmsContent(
        notification,
        languageByUserId.get(log.recipient),
      );

      try {
        const providerResponse = await this.smsProvider.sendSms({
          to: phone,
          body: smsBody,
        });
        sent += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.SENT,
            providerResponse: ({
              ...metaBase,
              to: phone,
              ...providerResponse,
            } as Prisma.InputJsonValue),
          },
        });
      } catch (error: unknown) {
        failed += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              ...metaBase,
              to: phone,
              error: error instanceof Error ? error.message : String(error),
            } as Prisma.InputJsonValue),
          },
        });
      }
    }

    return { attempted: targetLogs.length, sent, failed };
  }

  private async deliverPush(
    notification: any,
    mode: DeliveryMode,
    actorUserId?: string,
  ): Promise<{ attempted: number; sent: number; failed: number }> {
    const statuses: NotificationLogStatus[] =
      mode === 'pending'
        ? [NotificationLogStatus.PENDING]
        : [NotificationLogStatus.FAILED];

    const targetLogs = notification.logs.filter(
      (l: any) => l.channel === Channel.PUSH && statuses.includes(l.status),
    );
    if (!targetLogs.length) return { attempted: 0, sent: 0, failed: 0 };

    const pushStatus = this.pushDispatchRouter.getStatus() as any;
    const fcmConfigured = Boolean(pushStatus?.fcm?.configured);
    const expoConfigured = Boolean(pushStatus?.expo?.configured);
    const pushConfigured = fcmConfigured || expoConfigured;
    const pushLive =
      (fcmConfigured && !Boolean(pushStatus?.fcm?.mockMode)) ||
      (expoConfigured && !Boolean(pushStatus?.expo?.mockMode));
    if (!pushConfigured || !pushLive) {
      this.logger.warn(
        `Push provider disabled or not configured. Skipping ${targetLogs.length} push logs for notification ${notification.id}`,
      );
      for (const log of targetLogs) {
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              provider: 'push',
              mode,
              skipped: true,
              reason: 'PUSH_DISABLED_OR_NOT_CONFIGURED',
              reasonCode: 'PUSH_PROVIDER_DISABLED',
              attemptedAt: new Date().toISOString(),
              actorUserId: actorUserId ?? null,
            } as Prisma.InputJsonValue),
          },
        });
      }
      return { attempted: targetLogs.length, sent: 0, failed: targetLogs.length };
    }

    const recipients: string[] = [
      ...new Set<string>(targetLogs.map((l: any) => String(l.recipient))),
    ];
    const deviceTokens = await this.prisma.notificationDeviceToken.findMany({
      where: {
        userId: { in: recipients },
        isActive: true,
      },
      select: { id: true, userId: true, token: true, platform: true },
    });

    const tokensByUser = new Map<
      string,
      Array<{ id: string; token: string; platform: string }>
    >();
    for (const row of deviceTokens) {
      const arr = tokensByUser.get(row.userId) ?? [];
      arr.push({
        id: row.id,
        token: row.token,
        platform: String(row.platform),
      });
      tokensByUser.set(row.userId, arr);
    }

    let sent = 0;
    let failed = 0;
    const languageRows = await this.prisma.user.findMany({
      where: { id: { in: recipients } },
      select: { id: true, preferredLanguage: true },
    });
    const languageByUserId = new Map(
      languageRows.map((u) => [u.id, String(u.preferredLanguage ?? '').toLowerCase()] as const),
    );
    const pushData = this.buildPushData(notification);

    for (const log of targetLogs) {
      const metaBase = {
        mode,
        attemptedAt: new Date().toISOString(),
        actorUserId: actorUserId ?? null,
      };
      const pushBody = this.buildSmsContent(
        notification,
        languageByUserId.get(log.recipient),
      );
      const userTokens = tokensByUser.get(log.recipient) ?? [];
      if (userTokens.length === 0) {
        failed += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              ...metaBase,
              error: 'No active device tokens for recipient',
              reasonCode: 'NO_ACTIVE_DEVICE_TOKEN',
            } as Prisma.InputJsonValue),
          },
        });
        continue;
      }

      const results = await Promise.all(
        userTokens.map(async (tokenRow) => {
          try {
            const response = await this.pushDispatchRouter.sendPush({
              token: tokenRow.token,
              title: notification.title,
              body: pushBody,
              data: pushData,
            });

            await this.prisma.notificationDeviceToken.update({
              where: { id: tokenRow.id },
              data: { lastUsedAt: new Date() },
            });

            return {
              ok: true as const,
              tokenId: tokenRow.id,
              platform: tokenRow.platform,
              provider: String((response as any)?.provider ?? 'push'),
              response,
            };
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            return {
              ok: false as const,
              tokenId: tokenRow.id,
              platform: tokenRow.platform,
              provider:
                tokenRow.token.startsWith('ExpoPushToken[') ||
                tokenRow.token.startsWith('ExponentPushToken[')
                  ? 'expo'
                  : 'fcm',
              error: errorMessage,
              reasonCode: this.classifyPushFailure(
                errorMessage,
                tokenRow.token.startsWith('ExpoPushToken[') ||
                  tokenRow.token.startsWith('ExponentPushToken[')
                  ? 'expo'
                  : 'fcm',
              ),
            };
          }
        }),
      );

      const successful = results.filter((r) => r.ok);
      const failedResults = results.filter((r) => !r.ok);
      const deviceResultsJson = results.map((r) =>
        r.ok
          ? {
              ok: true,
              tokenId: r.tokenId,
              platform: r.platform,
              provider: r.provider,
              response: r.response as Record<string, unknown>,
            }
          : {
              ok: false,
              tokenId: r.tokenId,
              platform: r.platform,
              provider: r.provider,
              error: r.error,
              reasonCode: r.reasonCode,
            },
      );

      if (successful.length > 0) {
        sent += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.SENT,
            providerResponse: ({
              ...metaBase,
              provider: 'multi',
              deviceCount: userTokens.length,
              sentDevices: successful.length,
              failedDevices: failedResults.length,
              deviceResults: deviceResultsJson,
            } as Prisma.InputJsonValue),
          },
        });
      } else {
        failed += 1;
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              ...metaBase,
              provider: 'multi',
              deviceCount: userTokens.length,
              sentDevices: 0,
              failedDevices: failedResults.length,
              deviceResults: deviceResultsJson,
              error: 'All device sends failed',
              reasonCode:
                String((failedResults[0] as any)?.reasonCode ?? '') ||
                'PUSH_SEND_FAILED',
            } as Prisma.InputJsonValue),
          },
        });
      }
    }

    return { attempted: targetLogs.length, sent, failed };
  }

  private buildEmailContent(notification: any): string {
    const messageEn = String(notification.messageEn ?? '').replace(/\n/g, '<br>');
    const messageAr = notification.messageAr
      ? `<div dir="rtl">${String(notification.messageAr).replace(/\n/g, '<br>')}</div>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${notification.title}</h2>
        <div>${messageEn}</div>
        ${messageAr ? `<div style="margin-top: 20px;">${messageAr}</div>` : ''}
        <hr style="margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message from Alkarma Community Dashboard.</p>
      </div>
    `;
  }

  private pickLocalizedMessage(notification: any, language?: string) {
    const normalized = String(language ?? '').toLowerCase();
    if (normalized.startsWith('ar')) {
      const ar = String(notification.messageAr ?? '').trim();
      if (ar) return ar;
    }
    const en = String(notification.messageEn ?? '').trim();
    if (en) return en;
    return String(notification.messageAr ?? '').trim();
  }

  private buildSmsContent(notification: any, language?: string): string {
    const title = String(notification.title ?? '').trim();
    const message = this.pickLocalizedMessage(notification, language);
    const body = title ? `${title}\n${message}` : message;
    return body.slice(0, 1400);
  }

  private buildPushData(notification: any): Record<string, string> {
    const payload =
      notification && typeof notification.payload === 'object' && notification.payload
        ? (notification.payload as Record<string, unknown>)
        : {};
    const stringify = (v: unknown): string | undefined => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      try {
        return JSON.stringify(v);
      } catch {
        return undefined;
      }
    };

    return {
      notificationId: String(notification.id),
      type: String(notification.type ?? ''),
      targetAudience: String(notification.targetAudience ?? ''),
      createdAt: notification.createdAt
        ? new Date(notification.createdAt).toISOString()
        : new Date().toISOString(),
      ...(stringify(payload.route) ? { route: stringify(payload.route)! } : {}),
      ...(stringify(payload.entityType)
        ? { entityType: stringify(payload.entityType)! }
        : {}),
      ...(stringify(payload.entityId) ? { entityId: stringify(payload.entityId)! } : {}),
      ...(stringify(payload.eventKey) ? { eventKey: stringify(payload.eventKey)! } : {}),
    };
  }

  private async isAdminUser(userId: string): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId },
      select: { id: true },
    });
    return !!admin;
  }

  private classifyPushFailure(errorMessage: string, provider: string): string {
    const normalized = String(errorMessage ?? '').toLowerCase();
    const providerNorm = String(provider ?? '').toLowerCase();
    if (normalized.includes('no active device token')) return 'NO_ACTIVE_DEVICE_TOKEN';
    if (
      normalized.includes('oauth') ||
      normalized.includes('jwt') ||
      normalized.includes('invalid_grant') ||
      normalized.includes('permission') ||
      normalized.includes('unauth') ||
      normalized.includes('token')
    ) {
      return providerNorm.includes('expo') ? 'EXPO_AUTH_ERROR' : 'FCM_AUTH_ERROR';
    }
    if (providerNorm.includes('expo')) return 'EXPO_TICKET_ERROR';
    return 'PUSH_SEND_FAILED';
  }

  private buildDedupKey(params: {
    targetAudience: Audience;
    audienceMeta: Record<string, unknown> | undefined;
    payload: Record<string, unknown> | undefined;
    channels: Channel[];
    isScheduled: boolean;
  }): string | null {
    if (params.isScheduled) return null;
    const payload = params.payload ?? {};
    const eventKey =
      typeof payload.eventKey === 'string' ? payload.eventKey.trim() : '';
    const entityId =
      typeof payload.entityId === 'string' ? payload.entityId.trim() : '';
    if (!eventKey || !entityId) return null;
    const audienceMeta = params.audienceMeta ?? {};
    const userIds = Array.isArray((audienceMeta as any).userIds)
      ? ((audienceMeta as any).userIds as unknown[])
          .map((id) => String(id))
          .sort()
          .join(',')
      : '';
    return [
      eventKey,
      entityId,
      params.targetAudience,
      userIds,
      [...params.channels].sort().join(','),
    ].join('|');
  }

  private consumeDedupEntry(key: string): string | null {
    const entry = this.dedupCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.dedupCache.delete(key);
      return null;
    }
    return entry.notificationId;
  }

  private rememberDedupEntry(key: string, notificationId: string) {
    this.dedupCache.set(key, {
      notificationId,
      expiresAt: Date.now() + this.dedupWindowMs,
    });
  }
}
