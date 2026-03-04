import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { HikCentralQrService } from './hikcentral/hikcentral-qr.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccessControlScheduler } from './access-control.scheduler';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [AccessControlController],
  providers: [AccessControlService, HikCentralQrService, AccessControlScheduler],
  exports: [AccessControlService, HikCentralQrService],
})
export class AccessControlModule {}
