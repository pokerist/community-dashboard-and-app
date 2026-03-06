import { FamilyRelationType } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PreRegisterFamilyMemberDto {
  @IsUUID()
  ownerUserId!: string;

  @IsUUID()
  unitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @IsEnum(FamilyRelationType)
  relationship!: FamilyRelationType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalIdOrPassport?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

