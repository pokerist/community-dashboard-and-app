import { IsDateString, IsNotEmpty } from 'class-validator';
import { SendNotificationDto } from './send-notification.dto';

export class ScheduleNotificationDto extends SendNotificationDto {
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string = '';
}
