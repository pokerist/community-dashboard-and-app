import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationCreatedEvent } from '../../events/contracts/notification-created.event';
import { NotificationStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationDeliveryListener {
  private readonly logger = new Logger(NotificationDeliveryListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('notification.created', { async: false })
  async handleNotificationCreated(event: NotificationCreatedEvent) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: event.notificationId },
      select: { id: true, channels: true, status: true },
    });

    if (!notification) return;

    this.logger.log(
      `[DELIVERY] Notification ${notification.id} | channels=${notification.channels.join(',')}`,
    );

    if (notification.status !== NotificationStatus.SENT) {
      this.logger.warn(
        `Skipping delivery for notification ${notification.id} with status ${notification.status}`,
      );
      return;
    }

    await this.notificationsService.deliverPendingChannels(
      notification.id,
      notification.channels,
    );
  }
}
