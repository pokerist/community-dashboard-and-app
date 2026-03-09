import {
  ArrayMaxSize,
  IsArray,
  IsString,
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
  ValidateIf,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { EligibilityType, ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import { CreateServiceFieldDto } from './create-service-field.dto';
import { CreateMicroServiceDto } from './create-service.dto';

export class UpdateServiceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;

  @IsEnum(ServiceCategory)
  @IsOptional()
  category?: ServiceCategory;

  @IsEnum(EligibilityType)
  @IsOptional()
  unitEligibility?: EligibilityType;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  processingTime?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  slaHours?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedRoleId?: string | null;

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  startingPrice?: number | null;

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'iconName must be a valid kebab-case icon key',
  })
  iconName?: string | null;

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
