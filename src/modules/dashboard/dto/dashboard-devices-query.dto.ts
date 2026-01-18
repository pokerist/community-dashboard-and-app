import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeviceType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardDevicesQueryDto {
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
    enum: DeviceType,
    example: DeviceType.CAMERA,
  })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;
}
