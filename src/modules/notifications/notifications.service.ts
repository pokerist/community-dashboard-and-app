import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationCreatedEvent } from '../../events/contracts/notification-created.event';
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
  ) {}

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
            select: { residentId: true },
          });
          recipients.push(...residentUnits.map((r) => r.residentId));
        }
        break;
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
            : NotificationLogStatus.SENT,
      })),
    );

    await this.prisma.notificationLog.createMany({ data: logs });
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const userUnits = await this.prisma.residentUnit.findMany({
      where: { residentId: userId },
      select: { unitId: true },
    });

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
}
