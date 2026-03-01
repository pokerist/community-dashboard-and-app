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

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

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
    const pushDispatch = this.pushDispatchRouter.getStatus();
    return {
      providers: {
        email: {
          provider: 'smtp',
          enabled: integrations.smtp.enabled,
          configured: integrations.smtp.configured,
          host: integrations.smtp.host || null,
          port: integrations.smtp.port || null,
          from: integrations.smtp.fromEmail || null,
        },
        sms: {
          ...this.smsProvider.getStatus(),
          enabled: integrations.smsOtp.enabled,
          configured: integrations.smsOtp.configured,
        },
        push: pushDispatch,
        runtime: {
          capabilities: await this.integrationConfigService.getMobileCapabilities(),
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
      channels,
      targetAudience,
      audienceMeta,
      payload,
      scheduledAt,
    } = dto;

    if (!channels?.length) {
      throw new BadRequestException('At least one channel is required');
    }

    const normalizedAudienceMeta = this.validateAudienceMeta(
      targetAudience,
      audienceMeta,
    );

    const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
    const now = new Date();

    const isScheduled =
      scheduledDate !== null && scheduledDate.getTime() > now.getTime();

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
      return notification.id;
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
          const residentUnits = await this.prisma.residentUnit.findMany({
            where: { unitId: { in: audienceMeta.unitIds } },
            select: { resident: { select: { userId: true } } },
          });
          recipients.push(
            ...residentUnits.map((r) => r.resident.userId).filter(Boolean),
          );
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

        const residentUnits = await this.prisma.residentUnit.findMany({
          where: { unitId: { in: units.map((u) => u.id) } },
          select: { resident: { select: { userId: true } } },
        });

        recipients.push(
          ...residentUnits.map((r) => r.resident.userId).filter(Boolean),
        );
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
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });

    const userUnits = resident
      ? await this.prisma.residentUnit.findMany({
          where: { residentId: resident.id },
          select: { unitId: true, unit: { select: { block: true } } },
        })
      : [];

    const unitIds = userUnits.map((u) => u.unitId);
    const blocks = [
      ...new Set(
        userUnits
          .map((u) => (u.unit?.block ? String(u.unit.block) : null))
          .filter(Boolean),
      ),
    ] as string[];

    return { residentId: resident?.id ?? null, unitIds, blocks };
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
    const cursorDate =
      typeof after === 'string' && after.trim()
        ? new Date(after)
        : null;
    if (cursorDate && Number.isNaN(cursorDate.getTime())) {
      throw new BadRequestException('Invalid "after" datetime cursor');
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

    return {
      success: true,
      notificationId,
      ...totals,
      byChannel: channelResults,
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
    if (!integrations.smtp.enabled || !integrations.smtp.configured) {
      this.logger.warn(
        `SMTP disabled or not configured. Skipping ${targetLogs.length} email logs for notification ${notification.id}`,
      );
      for (const log of targetLogs) {
        await this.prisma.notificationLog.update({
          where: { id: log.id },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: ({
              provider: 'smtp',
              mode,
              skipped: true,
              reason: 'SMTP_DISABLED_OR_NOT_CONFIGURED',
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
        provider: 'smtp',
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
              provider: 'twilio',
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
      select: { id: true, phone: true },
    });
    const phoneByUserId = new Map(users.map((u) => [u.id, u.phone!] as const));
    const smsBody = this.buildSmsContent(notification);

    let sent = 0;
    let failed = 0;

    for (const log of targetLogs) {
      const metaBase = {
        provider: 'twilio',
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

    const integrations = await this.integrationConfigService.getResolvedIntegrations();
    if (!integrations.fcm.enabled || !integrations.fcm.configured) {
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
    const pushBody = this.buildSmsContent(notification);
    const pushData = this.buildPushData(notification);

    for (const log of targetLogs) {
      const metaBase = {
        mode,
        attemptedAt: new Date().toISOString(),
        actorUserId: actorUserId ?? null,
      };
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
            return {
              ok: false as const,
              tokenId: tokenRow.id,
              platform: tokenRow.platform,
              provider:
                tokenRow.token.startsWith('ExpoPushToken[') ||
                tokenRow.token.startsWith('ExponentPushToken[')
                  ? 'expo'
                  : 'fcm',
              error: error instanceof Error ? error.message : String(error),
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

  private buildSmsContent(notification: any): string {
    const title = String(notification.title ?? '').trim();
    const message = String(notification.messageEn ?? '').trim();
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
}
