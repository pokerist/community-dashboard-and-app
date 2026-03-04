import {
  IsString,
  IsEnum,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  IsDecimal,
  Matches,
  MaxLength,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { EligibilityType, ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';

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

  @IsBoolean()
  @IsOptional()
  status?: boolean;

  @IsDecimal({ decimal_digits: '0,2' })
  @IsOptional()
  @Type(() => String)
  startingPrice?: string;

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
}
