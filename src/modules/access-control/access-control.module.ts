import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { HikCentralQrService } from './hikcentral/hikcentral-qr.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccessControlController],
  providers: [AccessControlService, HikCentralQrService],
  exports: [AccessControlService],
})
export class AccessControlModule {}

