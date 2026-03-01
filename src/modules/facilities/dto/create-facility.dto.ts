import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FacilityType, BillingCycle } from '@prisma/client';

class CreateSlotConfigDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsInt()
  @Min(1)
  slotDurationMinutes!: number;

  @IsOptional()
  @IsInt()
  slotCapacity?: number;
}

class CreateSlotExceptionDto {
  @IsString()
  date!: string; // ISO string

  @IsBoolean()
  @IsOptional()
  isClosed?: boolean;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  slotDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  slotCapacity?: number;
}

export class CreateFacilityDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(FacilityType)
  @IsOptional()
  type?: FacilityType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  capacity?: number;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: BillingCycle;

  @IsBoolean()
  @IsOptional()
  isBookable?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresPrepayment?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  reminderMinutesBefore?: number;

  @IsOptional()
  @IsInt()
  maxReservationsPerDay?: number;

  @IsOptional()
  @IsInt()
  cooldownMinutes?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSlotConfigDto)
  @IsOptional()
  slotConfig?: CreateSlotConfigDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSlotExceptionDto)
  @IsOptional()
  slotExceptions?: CreateSlotExceptionDto[];
}
