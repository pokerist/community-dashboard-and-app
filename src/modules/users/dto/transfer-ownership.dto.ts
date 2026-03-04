import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OwnerPaymentMode, OwnershipTransferMode } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TransferInstallmentDto {
  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  referenceFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  referencePageIndex?: number;
}

class NewPlanDto {
  @ApiProperty({ enum: OwnerPaymentMode })
  @IsEnum(OwnerPaymentMode)
  paymentMode!: OwnerPaymentMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  contractFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  contractSignedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [TransferInstallmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferInstallmentDto)
  installments?: TransferInstallmentDto[];
}

export class TransferOwnershipDto {
  @ApiProperty()
  @IsUUID('4')
  fromUserId!: string;

  @ApiProperty()
  @IsUUID('4')
  toUserId!: string;

  @ApiProperty({ enum: OwnershipTransferMode })
  @IsEnum(OwnershipTransferMode)
  mode!: OwnershipTransferMode;

  @ApiPropertyOptional({ type: NewPlanDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NewPlanDto)
  newPlan?: NewPlanDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

