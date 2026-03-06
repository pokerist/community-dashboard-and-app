import { UserStatusEnum } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateBrokerDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  agencyName?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}

export class UpdateBrokerDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  agencyName?: string | null;

  @IsOptional()
  @IsString()
  licenseNumber?: string | null;

  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: UserStatusEnum;
}

