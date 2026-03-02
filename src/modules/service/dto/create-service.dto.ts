// src/service/dto/create-service.dto.ts

import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  IsDecimal,
  Matches,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ServiceCategory, EligibilityType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string; // e.g., "Furniture Permit", "IPTV Installation"

  @IsEnum(ServiceCategory)
  @IsNotEmpty()
  category!: ServiceCategory; // e.g., MAINTENANCE, ADMIN

  @IsEnum(EligibilityType)
  @IsOptional()
  unitEligibility?: EligibilityType; // ALL, DELIVERED_ONLY, NON_DELIVERED_ONLY

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number) // Important for query/body parameters that should be numbers
  processingTime?: number; // Estimated time in hours/days

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean; // Toggles visibility in the Community App

  @IsDecimal({ decimal_digits: '0,2' })
  @IsOptional()
  @Type(() => String) // Decimal in Prisma/DB is often string in DTO
  startingPrice?: string; // The mandatory starting price

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'iconName must be a valid kebab-case icon key',
  })
  iconName?: string;

  @IsString()
  @IsOptional()
  @IsIn(['auto', 'blue', 'orange', 'purple', 'green', 'pink', 'teal'])
  iconTone?: 'auto' | 'blue' | 'orange' | 'purple' | 'green' | 'pink' | 'teal';
}
