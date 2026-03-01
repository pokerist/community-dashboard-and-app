import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AuthorizedFeeMode,
  FamilyRelationType,
  HomeStaffType,
  HouseholdRequestStatus,
  NationalityType,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFamilyRequestDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ enum: FamilyRelationType })
  @IsEnum(FamilyRelationType)
  relationship!: FamilyRelationType;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ enum: NationalityType, default: NationalityType.EGYPTIAN })
  @IsEnum(NationalityType)
  @IsOptional()
  nationality?: NationalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalIdOrPassport?: string;

  @ApiProperty()
  @IsUUID()
  personalPhotoFileId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  nationalIdFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  passportFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  birthCertificateFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  marriageCertificateFileId?: string;

  @ApiPropertyOptional({ example: '<18' })
  @IsOptional()
  @IsString()
  childAgeBracket?: string;
}

export class CreateAuthorizedRequestDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiProperty({ enum: NationalityType, default: NationalityType.EGYPTIAN })
  @IsEnum(NationalityType)
  @IsOptional()
  nationality?: NationalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalIdOrPassport?: string;

  @ApiProperty({ description: 'National ID or passport file reference' })
  @IsUUID()
  idOrPassportFileId!: string;

  @ApiProperty({ description: 'Power of attorney / authorization document file' })
  @IsUUID()
  powerOfAttorneyFileId!: string;

  @ApiProperty()
  @IsUUID()
  personalPhotoFileId!: string;

  @ApiProperty()
  @IsDateString()
  validFrom!: string;

  @ApiProperty()
  @IsDateString()
  validTo!: string;

  @ApiPropertyOptional({ enum: AuthorizedFeeMode, default: AuthorizedFeeMode.NO_FEE })
  @IsOptional()
  @IsEnum(AuthorizedFeeMode)
  feeMode?: AuthorizedFeeMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @ApiPropertyOptional({
    example: {
      qrDelivery: true,
      qrWorkers: false,
      qrDriver: true,
      qrVisitor: true,
      requests: true,
      services: true,
      utilityPayment: false,
      complaints: true,
      bookings: false,
      violations: false,
    },
  })
  @IsOptional()
  @IsObject()
  delegatePermissions?: Record<string, unknown>;
}

export class CreateHomeStaffDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ enum: NationalityType, default: NationalityType.EGYPTIAN })
  @IsEnum(NationalityType)
  @IsOptional()
  nationality?: NationalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalIdOrPassport?: string;

  @ApiProperty({ description: 'National ID or passport file reference' })
  @IsUUID()
  idOrPassportFileId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  personalPhotoFileId?: string;

  @ApiPropertyOptional({ enum: HomeStaffType, default: HomeStaffType.OTHER })
  @IsOptional()
  @IsEnum(HomeStaffType)
  staffType?: HomeStaffType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  employmentDuration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  liveIn?: boolean;

  @ApiProperty()
  @IsDateString()
  accessFrom!: string;

  @ApiProperty()
  @IsDateString()
  accessTo!: string;
}

export class ReviewHouseholdRequestDto {
  @ApiProperty({ enum: [HouseholdRequestStatus.APPROVED, HouseholdRequestStatus.REJECTED] })
  @IsEnum(HouseholdRequestStatus)
  status!: HouseholdRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
