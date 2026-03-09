// src/service/dto/create-service.dto.ts

import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  IsNumber,
  IsPositive,
  Matches,
  MaxLength,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ServiceCategory, EligibilityType } from '@prisma/client';
import { Type } from 'class-transformer';
import { CreateServiceFieldDto } from './create-service-field.dto';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string; // e.g., "Furniture Permit", "IPTV Installation"

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;

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

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  slaHours?: number;

  @IsUUID()
  @IsOptional()
  assignedRoleId?: string;

  @IsBoolean()
  @IsOptional()
  status?: boolean; // Toggles visibility in the Community App

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  startingPrice?: number;

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

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateServiceFieldDto)
  @IsOptional()
  fields?: CreateServiceFieldDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateMicroServiceDto)
  @IsOptional()
  microServices?: CreateMicroServiceDto[];
}

export class CreateMicroServiceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;
