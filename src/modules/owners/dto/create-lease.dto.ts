import {
  IsString,
  IsDateString,
  IsOptional,
  IsDecimal,
  IsNotEmpty,
  IsUUID,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateLeaseDto {
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @IsOptional()
  @IsString()
  tenantEmail?: string;

  @IsOptional()
  @IsString()
  tenantNationalId?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsNumber()
  monthlyRent!: number;

  @IsOptional()
  @IsNumber()
  securityDeposit?: number;

  @IsOptional()
  @IsString()
  contractFileId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TerminateLeaseDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsDateString()
  terminationDate?: string;
}
