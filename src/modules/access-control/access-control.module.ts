import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { HikCentralQrService } from './hikcentral/hikcentral-qr.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [AccessControlController],
  providers: [AccessControlService, HikCentralQrService],
  exports: [AccessControlService, HikCentralQrService],
})
export class AccessControlModule {}
