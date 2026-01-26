import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsDate,
  IsEnum,
  IsUUID,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RelationshipType {
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  SPOUSE = 'SPOUSE',
}

// Base data for all relationships
export class FamilyMemberDataDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiProperty()
  @IsUUID()
  personalPhotoId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  nationalIdFileId?: string;
}

// Child-specific data
export class ChildDataDto extends FamilyMemberDataDto {
  @ApiProperty()
  @IsDate()
  birthDate: Date;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  birthCertificateId?: string;
}

// Spouse-specific data
export class SpouseDataDto extends FamilyMemberDataDto {
  @ApiProperty()
  @IsUUID()
  marriageCertificateId: string;
}

// Parent-specific data
export class ParentDataDto extends FamilyMemberDataDto {
  // No additional required fields for parents
}

export class AddFamilyMemberDto {
  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  relationship: RelationshipType;

  @ApiProperty({ description: 'Relationship-specific data' })
  @ValidateNested()
  @Type(() => FamilyMemberDataDto, {
    discriminator: {
      property: 'relationship',
      subTypes: [
        { value: ChildDataDto, name: 'CHILD' },
        { value: SpouseDataDto, name: 'SPOUSE' },
        { value: ParentDataDto, name: 'PARENT' },
      ],
    },
  })
  data: ChildDataDto | SpouseDataDto | ParentDataDto;
}
