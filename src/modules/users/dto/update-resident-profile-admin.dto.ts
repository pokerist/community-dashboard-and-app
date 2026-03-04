import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatusEnum } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateResidentProfileAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameEN?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAR?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  profilePhotoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  nationalIdFileId?: string;

  @ApiPropertyOptional({ enum: UserStatusEnum })
  @IsOptional()
  @IsEnum(UserStatusEnum)
  userStatus?: UserStatusEnum;
}

