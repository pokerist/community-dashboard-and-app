import {
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { DelegateType } from '@prisma/client';

export class CreateDelegateDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  unitId!: string;

  @IsEnum(DelegateType)
  type!: DelegateType;

  @IsUUID()
  idFileId!: string; // Required for delegate national ID

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
