import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, Max, Min } from 'class-validator';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';
import { ViolationActionStatus } from '@prisma/client';

export class ListAppealRequestsQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ enum: ViolationActionStatus })
  @IsOptional()
  @IsEnum(ViolationActionStatus)
  status?: ViolationActionStatus;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
