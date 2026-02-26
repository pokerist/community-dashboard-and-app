import { Module } from '@nestjs/common';
import { NotificationListener } from './listeners/notification.listener';
import { PendingRegistrationApprovedListener } from './listeners/pending-registration-approved.listener';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [NotificationsModule, PrismaModule],
  providers: [NotificationListener, PendingRegistrationApprovedListener],
})
export class EventsModule {}
