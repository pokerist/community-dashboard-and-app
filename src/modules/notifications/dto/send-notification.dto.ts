import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsString,
  IsDateString,
  IsObject,
} from 'class-validator';
import { Channel, Audience, NotificationType } from '@prisma/client';

export class SendNotificationDto {
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  titleAr?: string;

  @IsString()
  @IsNotEmpty()
  messageEn!: string;

  @IsString()
  @IsOptional()
  messageAr?: string;

  @IsArray()
  @IsEnum(Channel, { each: true })
  channels!: Channel[];

  @IsEnum(Audience)
  @IsNotEmpty()
  targetAudience!: Audience;

  @IsOptional()
  @IsObject()
  audienceMeta?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  communityId?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;
}
