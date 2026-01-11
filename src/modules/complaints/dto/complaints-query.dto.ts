import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplaintStatus, Priority } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export class ComplaintsQueryDto extends BaseQueryDto {
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
    example: 'unit-123',
  })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({
    example: 'user-123',
  })
  @IsOptional()
  @IsString()
  reporterId?: string;

  @ApiPropertyOptional({
    example: 'user-456',
  })
  @IsOptional()
  @IsString()
  assignedToId?: string;

  @ApiPropertyOptional({
    example: '2023-01-01',
  })
  @IsOptional()
  @IsString()
  createdAtFrom?: string;

  @ApiPropertyOptional({
    example: '2023-01-31',
  })
  @IsOptional()
  @IsString()
  createdAtTo?: string;
}
