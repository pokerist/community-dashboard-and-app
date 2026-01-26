import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  // Run every minute to dispatch due notifications
  @Cron('* * * * *')
  async handleScheduledNotifications() {
    this.logger.log('Checking for scheduled notifications...');
    await this.notificationsService.dispatchScheduled();
  }
}
