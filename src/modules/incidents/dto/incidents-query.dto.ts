import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Priority, IncidentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class IncidentsQueryDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  dateRange?: string; // e.g., "2023-01-01,2023-01-31"

  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}
