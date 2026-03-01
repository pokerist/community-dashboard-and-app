import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { NotificationDeliveryListener } from './notification-delivery.listener';
import { NotificationScheduler } from './notifications.scheduler';
import { SmsProviderService } from './providers/sms-provider.service';
import { PushProviderService } from './providers/push-provider.service';
import { ExpoPushProviderService } from './providers/expo-push-provider.service';
import { PushDispatchRouterService } from './providers/push-dispatch-router.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
@Module({
  imports: [PrismaModule, SystemSettingsModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    SmsProviderService,
    PushProviderService,
    ExpoPushProviderService,
    PushDispatchRouterService,
    NotificationDeliveryListener,
    NotificationScheduler,
  ],
  exports: [
    NotificationsService,
    EmailService,
    SmsProviderService,
    PushProviderService,
    ExpoPushProviderService,
    PushDispatchRouterService,
  ],
})
export class NotificationsModule {}
