import { Type } from 'class-transformer';
import { ReportFormat, ReportType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsBoolean,
  IsEmail,
  IsUUID,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class GenerateReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class ListReportsHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateReportScheduleDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;

  @IsString()
  @MaxLength(50)
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cronExpr?: string;

  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  recipientEmails?: string[];
}

export class ListReportSchedulesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsEnum(ReportType)
  reportType?: ReportType;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ToggleReportScheduleDto {
  @IsBoolean()
  isEnabled!: boolean;
}

export class UpdateReportScheduleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY'])
  frequency?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  recipientEmails?: string[];
}
