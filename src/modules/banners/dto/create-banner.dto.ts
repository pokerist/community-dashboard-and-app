import { Audience, BannerStatus, Priority, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  IsInt,
} from 'class-validator';

export class CreateBannerDto {
  @IsString()
  @MaxLength(200)
  titleEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleAr?: string;

  @IsOptional()
  @IsUUID()
  imageFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ctaUrl?: string;

  @IsEnum(Audience)
  targetAudience!: Audience;

  @IsOptional()
  @IsObject()
  audienceMeta?: Prisma.InputJsonValue;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;

  @IsOptional()
  @IsEnum(Priority)
  displayPriority?: Priority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  views?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  clicks?: number;
}

