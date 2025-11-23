import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { LeaseStatus } from '@prisma/client';

export class CreateLeaseDto {
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

  // Tenant is optional initially (e.g. if drafting a lease)
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  tenantNationalId?: string;

  @IsString()
  @IsOptional()
  tenantEmail?: string;

  @IsDate()
  @Type(() => Date) // Automatically transforms JSON date string to Date object
  @IsNotEmpty()
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate: Date;

  @IsNumber()
  @IsNotEmpty()
  monthlyRent: number;

  @IsNumber()
  @IsOptional()
  securityDeposit?: number;

  @IsString()
  @IsOptional()
  contractFileId?: string;
}

export class UpdateLeaseDto {
    // We copy the optional versions of the above + status
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @IsNumber()
  @IsOptional()
  monthlyRent?: number;

  @IsEnum(LeaseStatus)
  @IsOptional()
  status?: LeaseStatus;
}