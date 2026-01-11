import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Priority, ComplaintStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export class DashboardComplaintsQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by project name',
    example: 'Alkarma Gates',
  })
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiPropertyOptional({
    description: 'Filter by block',
    example: 'Block A',
  })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiPropertyOptional({
    description: 'Filter by unit ID',
    example: 'unit-123',
  })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({
    enum: ComplaintStatus,
    example: ComplaintStatus.NEW,
  })
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;

  @ApiPropertyOptional({
    enum: Priority,
    example: Priority.HIGH,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    description: 'Date from (YYYY-MM-DD)',
    example: '2023-01-01',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Date to (YYYY-MM-DD)',
    example: '2023-01-31',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
