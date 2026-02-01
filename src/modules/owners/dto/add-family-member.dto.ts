import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsDate,
  IsEnum,
  IsUUID,
} from 'class-validator';

export enum RelationshipType {
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  SPOUSE = 'SPOUSE',
}

export class AddFamilyMemberDto {
  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  relationship: RelationshipType;

  @ApiProperty({ description: 'Family member name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Email (optional)' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ description: 'National ID number' })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiProperty({ description: 'Personal photo file ID' })
  @IsUUID()
  personalPhotoId: string;

  @ApiPropertyOptional({ description: 'National ID file ID' })
  @IsUUID()
  @IsOptional()
  nationalIdFileId?: string;

  // Child-specific fields
  @ApiPropertyOptional({ description: 'Birth date (for children only)' })
  @IsDate()
  @IsOptional()
  birthDate?: Date;

  @ApiPropertyOptional({ description: 'Birth certificate file ID (for children only)' })
  @IsUUID()
  @IsOptional()
  birthCertificateId?: string;

  // Spouse-specific fields
  @ApiPropertyOptional({ description: 'Marriage certificate file ID (for spouse only)' })
  @IsUUID()
  @IsOptional()
  marriageCertificateId?: string;
}
