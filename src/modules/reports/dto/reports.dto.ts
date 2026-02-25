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
}

export class CreateReportScheduleDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

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
}

export class ListReportSchedulesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ToggleReportScheduleDto {
  @IsBoolean()
  isEnabled!: boolean;
}
