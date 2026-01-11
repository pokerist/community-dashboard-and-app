import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Priority, IncidentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export class IncidentsQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    enum: IncidentStatus,
    example: IncidentStatus.OPEN,
  })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({
    enum: Priority,
    example: Priority.HIGH,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    example: '2023-01-01',
  })
  @IsOptional()
  @IsString()
  reportedAtFrom?: string;

  @ApiPropertyOptional({
    example: '2023-01-31',
  })
  @IsOptional()
  @IsString()
  reportedAtTo?: string;

  @ApiPropertyOptional({
    example: 'unit-123',
  })
  @IsOptional()
  @IsString()
  unitId?: string;
}
