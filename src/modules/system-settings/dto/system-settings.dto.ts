import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
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
