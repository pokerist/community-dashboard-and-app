import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PermitCategory, PermitStatus } from '@prisma/client';

export class ListPermitRequestsQueryDto {
  @IsOptional()
  @IsUUID()
  permitTypeId?: string;

  @IsOptional()
  @IsEnum(PermitStatus)
  status?: PermitStatus;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @IsOptional()
  @IsEnum(PermitCategory)
  category?: PermitCategory;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeInactive?: boolean;
}
