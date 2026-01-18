import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ViolationStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export class ViolationsQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    enum: ViolationStatus,
    example: ViolationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(ViolationStatus)
  status?: ViolationStatus;

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
  residentId?: string;

  @ApiPropertyOptional({
    example: 'user-456',
  })
  @IsOptional()
  @IsString()
  issuedById?: string;

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
