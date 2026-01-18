import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsDateString,
} from 'class-validator';
import { Channel, Audience, NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  messageEn: string;

  @IsString()
  @IsOptional()
  messageAr?: string;

  @IsArray()
  @IsEnum(Channel, { each: true })
  channels: Channel[];

  @IsEnum(Audience)
  @IsNotEmpty()
  targetAudience: Audience;

  @IsOptional()
  audienceMeta?: any;

  @IsDateString()
  @IsOptional()
  scheduledAt?: Date;
}
