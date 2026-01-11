import { Module } from '@nestjs/common';
import { NotificationListener } from './listeners/notification.listener';
import { PendingRegistrationApprovedListener } from './listeners/pending-registration-approved.listener';
import { NotificationsModule } from '../modules/notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [NotificationListener, PendingRegistrationApprovedListener],
})
export class EventsModule {}
