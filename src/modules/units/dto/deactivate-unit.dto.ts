import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeactivateUnitDto {
  @ApiPropertyOptional({ example: 'Unit archived by admin request' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

