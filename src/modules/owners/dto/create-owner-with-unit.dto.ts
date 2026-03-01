import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OwnerPaymentMode } from '@prisma/client';

export class CreateOwnerInstallmentDto {
  @IsDateString()
  dueDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsUUID()
  referenceFileId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  referencePageIndex?: number;
}

export class CreateOwnerUnitAssignmentDto {
  @IsUUID()
  unitId!: string;

  @IsOptional()
  @IsUUID()
  contractFileId?: string;

  @IsOptional()
  @IsDateString()
  contractSignedAt?: string;

  @IsEnum(OwnerPaymentMode)
  paymentMode!: OwnerPaymentMode;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(240)
  @ValidateNested({ each: true })
  @Type(() => CreateOwnerInstallmentDto)
  installments?: CreateOwnerInstallmentDto[];
}

export class CreateOwnerWithUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nameEN?: string;

  @IsOptional()
  @IsString()
  nameAR?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsString()
  @IsNotEmpty()
  nationalIdPhotoId!: string;

  // Backward compatibility with old single-unit flow.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unitId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => CreateOwnerUnitAssignmentDto)
  units?: CreateOwnerUnitAssignmentDto[];
}

