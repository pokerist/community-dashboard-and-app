import { Channel, NotificationType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateNotificationTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  @IsNotEmpty()
  titleEn!: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsString()
  @IsNotEmpty()
  messageEn!: string;

  @IsOptional()
  @IsString()
  messageAr?: string;

  @IsArray()
  @IsEnum(Channel, { each: true })
  channels!: Channel[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateNotificationTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  titleAr?: string;

  @IsOptional()
  @IsString()
  messageEn?: string;

  @IsOptional()
  @IsString()
  messageAr?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(Channel, { each: true })
  channels?: Channel[];
}

export class ToggleNotificationTemplateDto {
  @IsBoolean()
  isActive!: boolean;
}

export class NotificationTemplateResponseDto {
  id!: string;
  name!: string;
  type!: NotificationType;
  titleEn!: string;
  titleAr!: string | null;
  messageEn!: string;
  messageAr!: string | null;
  channels!: Channel[];
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
