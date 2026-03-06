import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  HomeStaffType,
  HouseholdRequestStatus,
  LeaseStatus,
  UserStatusEnum,
} from '@prisma/client';

export class BaseUsersPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ListOwnersQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: UserStatusEnum;

  @IsOptional()
  @IsUUID()
  communityId?: string;
}

export class ListFamilyMembersQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: UserStatusEnum;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class ListTenantsQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: UserStatusEnum;

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsOptional()
  @IsEnum(LeaseStatus)
  leaseStatus?: LeaseStatus;
}

export class ListHomeStaffQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(HomeStaffType)
  staffType?: HomeStaffType;

  @IsOptional()
  @IsEnum(HouseholdRequestStatus)
  status?: HouseholdRequestStatus;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class ListDelegatesQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(HouseholdRequestStatus)
  status?: HouseholdRequestStatus;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

export class ListBrokersQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: UserStatusEnum;
}

export class ListSystemUsersQueryDto extends BaseUsersPaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatusEnum)
  status?: UserStatusEnum;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

