import { Module } from '@nestjs/common';
import { ClubhouseService } from './clubhouse.service';
import { ClubhouseController } from './clubhouse.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [ClubhouseController],
  providers: [ClubhouseService],
  exports: [ClubhouseService],
})
export class ClubhouseModule {}
