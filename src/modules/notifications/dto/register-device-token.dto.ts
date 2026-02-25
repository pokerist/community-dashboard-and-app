import { PushPlatform } from '@prisma/client';
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @MaxLength(4096)
  token!: string;

  @IsEnum(PushPlatform)
  platform!: PushPlatform;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

