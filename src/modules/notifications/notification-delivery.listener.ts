import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from './email.service';
import { NotificationCreatedEvent } from '../../events/contracts/notification-created.event';
import {
  Channel,
  NotificationStatus,
  NotificationLogStatus,
} from '@prisma/client';

@Injectable()
export class NotificationDeliveryListener {
  private readonly logger = new Logger(NotificationDeliveryListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    console.log('🔥 NotificationDeliveryListener initialized');
  }

  @OnEvent('notification.created', { async: false })
  async handleNotificationCreated(event: NotificationCreatedEvent) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: event.notificationId },
      include: { logs: true },
    });

    this.logger.log(
      `[DELIVERY] Notification ${notification?.id} | channels=${notification?.channels.join(',')}`,
    );

    if (!notification) return;

    if (notification.status !== NotificationStatus.SENT) {
      this.logger.warn(
        `Skipping delivery for notification ${notification.id} with status ${notification.status}`,
      );
      return;
    }

    for (const channel of notification.channels) {
      if (channel === Channel.EMAIL) {
        await this.deliverEmail(notification);
      }
    }
  }

  private async deliverEmail(notification: any): Promise<void> {
    // Get recipients with email addresses from the event recipients
    const userIds = this.extractUserIdsFromLogs(
      notification.logs,
      Channel.EMAIL,
    );
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        email: { not: null },
      },
      select: { id: true, email: true },
    });

    this.logger.log(`[EMAIL] Logs count=${notification.logs.length}`);

    this.logger.log(
      `[EMAIL] Pending EMAIL logs=${
        notification.logs.filter(
          (l) =>
            l.channel === Channel.EMAIL &&
            l.status === NotificationLogStatus.PENDING,
        ).length
      }`,
    );

    this.logger.log(`[EMAIL] User IDs=${JSON.stringify(userIds)}`);

    this.logger.log(`[EMAIL] Users with email=${users.length}`);

    const emailPromises = users.map(async (user) => {
      try {
        const htmlContent = this.buildEmailContent(notification);
        await this.emailService.sendEmail(
          notification.title,
          user.email!,
          htmlContent,
        );

        // Update log status
        await this.prisma.notificationLog.updateMany({
          where: {
            notificationId: notification.id,
            channel: Channel.EMAIL,
            recipient: user.id,
          },
          data: {
            status: NotificationLogStatus.SENT,
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send email to ${user.email}`, error as any);

        // Update log with failure
        await this.prisma.notificationLog.updateMany({
          where: {
            notificationId: notification.id,
            channel: Channel.EMAIL,
            recipient: user.id,
          },
          data: {
            status: NotificationLogStatus.FAILED,
            providerResponse: { error: message || 'Unknown error' },
          },
        });
      }
    });

    await Promise.all(emailPromises);
  }

  private extractUserIdsFromLogs(logs: any[], channel: Channel): string[] {
    return logs
      .filter(
        (log) =>
          log.channel === channel &&
          log.status === NotificationLogStatus.PENDING,
      )
      .map((log) => log.recipient);
  }

  private buildEmailContent(notification: any): string {
    const messageEn = notification.messageEn.replace(/\n/g, '<br>');
    const messageAr = notification.messageAr
      ? `<div dir="rtl">${notification.messageAr.replace(/\n/g, '<br>')}</div>`
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
