import { AuthorizedFeeMode, FamilyRelationType, HomeStaffType, HouseholdRequestStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApprovalDateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class ListPendingOwnersQueryDto extends ApprovalDateRangeQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'ALL'])
  status?: 'PENDING' | 'PROCESSING' | 'ALL';

  @IsOptional()
  @IsIn(['SELF', 'PRE_REG'])
  registrationType?: 'SELF' | 'PRE_REG';

  @IsOptional()
  @IsString()
  search?: string;
}

export class ListPendingFamilyMembersQueryDto extends ApprovalDateRangeQueryDto {
  @IsOptional()
  @IsEnum(HouseholdRequestStatus)
  status?: HouseholdRequestStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsEnum(FamilyRelationType)
  relationship?: FamilyRelationType;
}

export class ListPendingDelegatesQueryDto extends ApprovalDateRangeQueryDto {
  @IsOptional()
  @IsEnum(HouseholdRequestStatus)
  status?: HouseholdRequestStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsEnum(AuthorizedFeeMode)
  feeMode?: AuthorizedFeeMode;
}

export class ListPendingHomeStaffQueryDto extends ApprovalDateRangeQueryDto {
  @IsOptional()
  @IsEnum(HouseholdRequestStatus)
  status?: HouseholdRequestStatus;

  @IsOptional()
  @IsEnum(HomeStaffType)
  staffType?: HomeStaffType;

  @IsOptional()
  @IsString()
  search?: string;
}
