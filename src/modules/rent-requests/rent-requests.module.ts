import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentRequestsController } from './rent-requests.controller';
import { RentRequestsService } from './rent-requests.service';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [RentRequestsController],
  providers: [RentRequestsService],
  exports: [RentRequestsService],
})
export class RentRequestsModule {}
