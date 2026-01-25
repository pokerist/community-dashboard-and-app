import { IsString, IsOptional, IsBoolean, IsDateString, IsUUID } from 'class-validator';
import { DelegateType } from '@prisma/client';

export class CreateDelegateDto {
  @IsString()
  userId: string;

  @IsString()
  unitId: string;

  @IsString()
  type: DelegateType;

  @IsUUID()
  idFileId: string; // Required for delegate national ID

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  canViewFinancials?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveBilling?: boolean;

  @IsOptional()
  @IsBoolean()
  canBookFacilities?: boolean;

  @IsOptional()
  @IsBoolean()
  canGenerateQR?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageWorkers?: boolean;
}
