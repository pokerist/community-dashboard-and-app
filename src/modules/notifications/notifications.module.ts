import { Module, forwardRef } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmailService } from './email.service';
import { NotificationDeliveryListener } from './notification-delivery.listener';
import { NotificationScheduler } from './notifications.scheduler';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailService,
    NotificationDeliveryListener,
    NotificationScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
