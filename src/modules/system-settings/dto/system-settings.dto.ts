import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dateFormat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  defaultLanguage?: string;
}

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  emailFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  smsSender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  pushTopic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  emailTemplate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  smsTemplate?: string;

  @IsOptional()
  @IsBoolean()
  enableEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  enableSms?: boolean;

  @IsOptional()
  @IsBoolean()
  enablePush?: boolean;

  @IsOptional()
  @IsBoolean()
  enableInApp?: boolean;
}

export class UpdateSecuritySettingsDto {
  @IsOptional()
  @IsBoolean()
  enforce2fa?: boolean;

  @IsOptional()
  @IsBoolean()
  autoLogoutEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  sessionTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  rateLimitEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  rateLimitPerMinute?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(6)
  @Max(128)
  minPasswordLength?: number;
}

export class UpdateBackupSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoBackups?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  backupTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;
}

export class UpdateCrmSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  authToken?: string;

  @IsOptional()
  @IsBoolean()
  autoSyncResidents?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSyncPayments?: boolean;

  @IsOptional()
  @IsBoolean()
  autoSyncServiceRequests?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  syncIntervalMinutes?: number;
}

export class UpdateBrandSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  appDisplayName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  logoFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supportPhone?: string;
}

export class UpdateOnboardingSlideDto {
  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;
}

export class UpdateOnboardingSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOnboardingSlideDto)
  slides?: UpdateOnboardingSlideDto[];
}

export class UpdateOfferBannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  id?: string;

  @IsString()
  @MaxLength(140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  imageFileId?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  linkUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;
}

export class UpdateOffersSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOfferBannerDto)
  banners?: UpdateOfferBannerDto[];
}

export class MobileFeatureFlagsDto {
  @IsOptional()
  @IsBoolean()
  canUseServices?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseBookings?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseComplaints?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseQr?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewFinance?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageHousehold?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseDiscover?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseHelpCenter?: boolean;

  @IsOptional()
  @IsBoolean()
  canUseUtilities?: boolean;
}

export class UpdateMobileAccessSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  owner?: MobileFeatureFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  tenant?: MobileFeatureFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  family?: MobileFeatureFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  authorized?: MobileFeatureFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  contractor?: MobileFeatureFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  preDeliveryOwner?: MobileFeatureFlagsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MobileFeatureFlagsDto)
  resident?: MobileFeatureFlagsDto;
}

export class TestCrmConnectionDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  authToken?: string;
}

export class CreateSystemSettingsBackupDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

export class RestoreSystemSettingsBackupDto {
  @IsString()
  backupId!: string;
}

export class ListSystemSettingsBackupsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ImportSystemSettingsSnapshotDto {
  @IsObject()
  snapshot!: Record<string, unknown>;
}
