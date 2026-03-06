import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { DashboardPeriod } from './dashboard-stats-response.dto';

export class DashboardPeriodQueryDto {
  @ApiPropertyOptional({
    enum: DashboardPeriod,
    default: DashboardPeriod.MONTHLY,
    example: DashboardPeriod.MONTHLY,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod;
}

