import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUUID,
} from 'class-validator';
import { DelegateType } from '@prisma/client';

export class CreateDelegateByContactDto {
  @IsUUID()
  unitId!: string;

  @IsEnum(DelegateType)
  type!: DelegateType;

  @IsUUID()
  idFileId!: string;

  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsPhoneNumber()
  phone!: string;

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

