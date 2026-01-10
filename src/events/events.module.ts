import { Module } from '@nestjs/common';
import { NotificationListener } from './listeners/notification.listener';
import { PendingRegistrationApprovedListener } from './listeners/pending-registration-approved.listener';

@Module({
  providers: [NotificationListener, PendingRegistrationApprovedListener],
})
export class EventsModule {}