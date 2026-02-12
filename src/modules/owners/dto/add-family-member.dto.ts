import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';

export enum RelationshipType {
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  SPOUSE = 'SPOUSE',
}

export class AddFamilyMemberDto {
  // ------------------------
  // Common fields (all members)
  // ------------------------
  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  relationship!: RelationshipType;

  @ApiProperty({ description: 'Full name of family member' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Email (optional)' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'Phone number' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: 'Personal photo file ID (required for all)' })
  @IsUUID()
  personalPhotoId!: string;

  // ------------------------
  // National ID (Parent & Child >=16)
  // ------------------------
  @ApiPropertyOptional({
    description: 'National ID number (required for Parent or Child >=16)',
  })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({
    description:
      'National ID file ID (required for Parent or Child >=16, optional in DTO, enforced in code)',
  })
  @IsUUID()
  @IsOptional()
  nationalIdFileId?: string;

  // ------------------------
  // Child-specific fields
  // ------------------------
  @ApiPropertyOptional({
    description: 'Birth date of child (required for CHILD)',
  })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({
    description:
      'Birth certificate file ID (required for CHILD under 16, optional in DTO, enforced in code)',
  })
  @IsUUID()
  @IsOptional()
  birthCertificateFileId?: string;

  // ------------------------
  // Spouse-specific fields
  // ------------------------
  @ApiPropertyOptional({
    description:
      'Marriage certificate file ID (required for SPOUSE, optional in DTO, enforced in code)',
  })
  @IsUUID()
  @IsOptional()
  marriageCertificateFileId?: string;
}
