import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardOccupancyQueryDto {
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
}
