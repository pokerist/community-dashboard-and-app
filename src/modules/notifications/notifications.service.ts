import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationCreatedEvent } from '../../events/contracts/notification-created.event';
import { EmailService } from './email.service';
import {
  Audience,
  Channel,
  NotificationType,
  NotificationLogStatus,
  NotificationStatus,
} from '@prisma/client';
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly emailService: EmailService,
  ) {}

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

  async sendNotification(
    dto: SendNotificationDto,
    senderId?: string,
  ): Promise<string> {
    const {
      type,
      title,
      messageEn,
      messageAr,
      channels,
      targetAudience,
      audienceMeta,
      scheduledAt,
    } = dto;

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
        audienceMeta,
        scheduledAt: scheduledDate,
        senderId,
        sentAt: isScheduled ? null : now,
        status: isScheduled
          ? NotificationStatus.SCHEDULED
          : NotificationStatus.PENDING,
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

    await this.createNotificationLogs(
      notification.id,
      recipients,
      notification.channels,
    );

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });

    this.eventEmitter.emit(
      'notification.created',
      new NotificationCreatedEvent(
        notification.id,
        notification.channels,
        recipients,
      ),
    );
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

  private async resolveRecipients(
    audience: Audience,
    audienceMeta?: any,
  ): Promise<string[]> {
    const recipients: string[] = [];

    switch (audience) {
      case Audience.ALL:
        const users = await this.prisma.user.findMany({
          where: { userStatus: 'ACTIVE' },
          select: { id: true },
        });
        recipients.push(...users.map((u) => u.id));
        break;

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

        if (units.length === 0) break;

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
            : channel === Channel.EMAIL
              ? NotificationLogStatus.PENDING
              : NotificationLogStatus.PENDING,
      })),
    );

    await this.prisma.notificationLog.createMany({ data: logs });
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const resident = await this.prisma.resident.findUnique({
      where: { userId },
      select: { id: true },
    });

    const userUnits = resident
      ? await this.prisma.residentUnit.findMany({
          where: { residentId: resident.id },
          select: { unitId: true },
        })
      : [];

    const unitIds = userUnits.map((u) => u.unitId);

    const whereClause = {
      OR: [
        { targetAudience: Audience.ALL },
        {
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { path: ['userIds'], array_contains: userId },
        },
        ...unitIds.map((unitId) => ({
          targetAudience: Audience.SPECIFIC_UNITS,
          audienceMeta: { path: ['unitIds'], array_contains: unitId },
        })),
      ],
    };

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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: whereClause }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

    const failedEmailLogs = notification.logs.filter(
      (l) =>
        l.channel === Channel.EMAIL && l.status === NotificationLogStatus.FAILED,
    );

    if (failedEmailLogs.length === 0) {
      return {
        success: true,
        notificationId,
        message: 'No failed EMAIL logs to resend',
        attempted: 0,
        sent: 0,
        failed: 0,
      };
    }

    const recipients = failedEmailLogs.map((l) => l.recipient);
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: recipients },
        email: { not: null },
      },
      select: { id: true, email: true },
    });

    const userEmailById = new Map(users.map((u) => [u.id, u.email!] as const));

    const results = await Promise.all(
      failedEmailLogs.map(async (log) => {
        const email = userEmailById.get(log.recipient);
        const attemptMeta = {
          resentAt: new Date().toISOString(),
          actorUserId: actorUserId ?? null,
        };

        if (!email) {
          await this.prisma.notificationLog.update({
            where: { id: log.id },
            data: {
              providerResponse: {
                ...attemptMeta,
                error: 'User has no email or user not found',
              },
            },
          });
          return { ok: false };
        }

        try {
          const htmlContent = this.buildEmailContent(notification);
          await this.emailService.sendEmail(notification.title, email, htmlContent);

          await this.prisma.notificationLog.update({
            where: { id: log.id },
            data: {
              status: NotificationLogStatus.SENT,
              providerResponse: attemptMeta,
            },
          });

          return { ok: true };
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          await this.prisma.notificationLog.update({
            where: { id: log.id },
            data: {
              status: NotificationLogStatus.FAILED,
              providerResponse: {
                ...attemptMeta,
                error: message || 'Unknown error',
              },
            },
          });
          return { ok: false };
        }
      }),
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;

    return {
      success: true,
      notificationId,
      attempted: failedEmailLogs.length,
      sent,
      failed,
    };
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
}
