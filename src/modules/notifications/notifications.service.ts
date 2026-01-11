import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { Audience, Channel, NotificationType, NotificationLogStatus } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async sendNotification(dto: SendNotificationDto, senderId?: string): Promise<string> {
    const { type, title, messageEn, messageAr, channels, targetAudience, audienceMeta, scheduledAt } = dto;

    // Resolve recipients based on audience
    const recipients = await this.resolveRecipients(targetAudience, audienceMeta);

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        type,
        title,
        messageEn,
        messageAr,
        channels,
        targetAudience,
        audienceMeta,
        scheduledAt,
        sentAt: scheduledAt ? null : new Date(),
        senderId,
      },
    });

    // If scheduled, don't send immediately
    if (scheduledAt && scheduledAt > new Date()) {
      this.logger.log(`Notification ${notification.id} scheduled for ${scheduledAt}`);
      return notification.id;
    }

    // Dispatch to channels
    await this.dispatchNotification(notification.id, recipients, channels);

    return notification.id;
  }

  private async resolveRecipients(audience: Audience, audienceMeta?: any): Promise<string[]> {
    const recipients: string[] = [];

    switch (audience) {
      case Audience.ALL:
        const allUsers = await this.prisma.user.findMany({
          where: { userStatus: 'ACTIVE' },
          select: { id: true },
        });
        recipients.push(...allUsers.map(u => u.id));
        break;

      case Audience.SPECIFIC_RESIDENCES:
        if (audienceMeta?.userIds && Array.isArray(audienceMeta.userIds)) {
          recipients.push(...audienceMeta.userIds);
        }
        break;

      case Audience.SPECIFIC_UNITS:
        if (audienceMeta?.unitIds && Array.isArray(audienceMeta.unitIds)) {
          const residentUnits = await this.prisma.residentUnit.findMany({
            where: { unitId: { in: audienceMeta.unitIds } },
            select: { residentId: true },
          });
          recipients.push(...residentUnits.map(ru => ru.residentId));
        }
        break;

      case Audience.SPECIFIC_BLOCKS:
        if (audienceMeta?.blocks && Array.isArray(audienceMeta.blocks)) {
          const unitsInBlocks = await this.prisma.unit.findMany({
            where: { block: { in: audienceMeta.blocks } },
            select: { id: true },
          });
          const unitIds = unitsInBlocks.map(u => u.id);
          const residentUnits = await this.prisma.residentUnit.findMany({
            where: { unitId: { in: unitIds } },
            select: { residentId: true },
          });
          recipients.push(...residentUnits.map(ru => ru.residentId));
        }
        break;

      default:
        this.logger.warn(`Unknown audience type: ${audience}`);
    }

    // Remove duplicates
    return [...new Set(recipients)];
  }

  private async dispatchNotification(
    notificationId: string,
    recipientIds: string[],
    channels: Channel[],
  ): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error(`Notification ${notificationId} not found`);
    }

    // Get user details for recipients
    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true, phone: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    // Process each recipient and channel combination
    const logPromises: Promise<any>[] = [];

    for (const recipientId of recipientIds) {
      const user = userMap.get(recipientId);
      if (!user) continue;

      for (const channel of channels) {
        logPromises.push(this.sendToChannel(notification, user, channel));
      }
    }

    await Promise.allSettled(logPromises);

    // Update notification stats
    const logs = await this.prisma.notificationLog.findMany({
      where: { notificationId },
    });

    const deliveredCount = logs.filter(l => l.status === NotificationLogStatus.DELIVERED).length;
    const readCount = logs.filter(l => l.status === NotificationLogStatus.READ).length;

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { deliveredCount, readCount },
    });
  }

  private async sendToChannel(
    notification: any,
    user: any,
    channel: Channel,
  ): Promise<void> {
    let status: NotificationLogStatus = NotificationLogStatus.SENT;
    let providerResponse: any = null;
    let recipient = user.id; // default to user ID for in-app

    try {
      switch (channel) {
        case Channel.IN_APP:
          // In-app notifications are stored in the notification system
          // No external sending needed
          status = NotificationLogStatus.DELIVERED;
          break;

        case Channel.EMAIL:
          recipient = user.email || '';
          if (!user.email) {
            status = NotificationLogStatus.FAILED;
            providerResponse = { error: 'No email address available' };
          } else {
            // TODO: Implement email sending via provider
            await this.sendEmail(user.email, notification.title, notification.messageEn, notification.messageAr);
            status = NotificationLogStatus.SENT;
          }
          break;

        case Channel.SMS:
          recipient = user.phone || '';
          if (!user.phone) {
            status = NotificationLogStatus.FAILED;
            providerResponse = { error: 'No phone number available' };
          } else {
            // TODO: Implement SMS sending via provider
            await this.sendSMS(user.phone, notification.messageEn);
            status = NotificationLogStatus.SENT;
          }
          break;

        case Channel.PUSH:
          // TODO: Implement push notification sending
          status = NotificationLogStatus.SENT;
          break;

        default:
          status = NotificationLogStatus.FAILED;
          providerResponse = { error: `Unsupported channel: ${channel}` };
      }
    } catch (error) {
      status = NotificationLogStatus.FAILED;
      providerResponse = { error: error.message };
      this.logger.error(`Failed to send ${channel} notification to ${recipient}`, error);
    }

    // Create log entry
    await this.prisma.notificationLog.create({
      data: {
        notificationId: notification.id,
        channel,
        recipient,
        status,
        providerResponse,
      },
    });
  }

  private async sendEmail(to: string, subject: string, messageEn: string, messageAr?: string): Promise<void> {
    // TODO: Implement actual email sending with Nodemailer or similar
    this.logger.log(`Sending email to ${to}: ${subject}`);
    // Simulate async email sending
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendSMS(to: string, message: string): Promise<void> {
    // TODO: Implement actual SMS sending
    this.logger.log(`Sending SMS to ${to}: ${message}`);
    // Simulate async SMS sending
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    // Get user units for filtering unit-based notifications
    const userUnits = await this.prisma.residentUnit.findMany({
      where: { residentId: userId },
      select: { unitId: true },
    });
    const userUnitIds = userUnits.map(ru => ru.unitId);

    // Get notifications targeted at this user
    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: [
          { targetAudience: Audience.ALL },
          {
            targetAudience: Audience.SPECIFIC_RESIDENCES,
            audienceMeta: { path: ['userIds'], array_contains: userId },
          },
          ...userUnitIds.map(unitId => ({
            targetAudience: Audience.SPECIFIC_UNITS,
            audienceMeta: { path: ['unitIds'], array_contains: unitId },
          })),
          // For block-based notifications, get blocks from user's units
          {
            targetAudience: Audience.SPECIFIC_BLOCKS,
            // This would need more complex logic to check user's blocks
          },
        ],
      },
      include: {
        logs: {
          where: {
            recipient: userId,
            channel: Channel.IN_APP,
          },
        },
        sender: {
          select: { id: true, nameEN: true, nameAR: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const total = await this.prisma.notification.count({
      where: {
        OR: [
          { targetAudience: Audience.ALL },
          {
            targetAudience: Audience.SPECIFIC_RESIDENCES,
            audienceMeta: { path: ['userIds'], array_contains: userId },
          },
          ...userUnitIds.map(unitId => ({
            targetAudience: Audience.SPECIFIC_UNITS,
            audienceMeta: { path: ['unitIds'], array_contains: unitId },
          })),
        ],
      },
    });

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const log = await this.prisma.notificationLog.findFirst({
      where: {
        notificationId,
        recipient: userId,
        channel: Channel.IN_APP,
      },
    });

    if (log) {
      await this.prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationLogStatus.READ },
      });

      // Update notification read count
      await this.prisma.$executeRaw`
        UPDATE "Notification"
        SET "readCount" = "readCount" + 1
        WHERE id = ${notificationId}
      `;
    }
  }
}
