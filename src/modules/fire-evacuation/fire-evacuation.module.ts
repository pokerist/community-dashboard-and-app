import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FireEvacuationController } from './fire-evacuation.controller';
import { FireEvacuationService } from './fire-evacuation.service';

@Module({
  imports: [NotificationsModule],
  controllers: [FireEvacuationController],
  providers: [FireEvacuationService],
  exports: [FireEvacuationService],
})
export class FireEvacuationModule {}
