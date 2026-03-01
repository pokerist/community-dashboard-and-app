import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FireEvacuationController } from './fire-evacuation.controller';
import { FireEvacuationService } from './fire-evacuation.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [FireEvacuationController],
  providers: [FireEvacuationService],
  exports: [FireEvacuationService],
})
export class FireEvacuationModule {}
