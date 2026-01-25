import { Module } from '@nestjs/common';
import { DelegatesService } from './delegates.service';
import { DelegatesController } from './delegates.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [DelegatesController],
  providers: [DelegatesService],
  exports: [DelegatesService],
})
export class DelegatesModule {}
