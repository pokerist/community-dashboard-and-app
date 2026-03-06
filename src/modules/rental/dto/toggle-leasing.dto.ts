import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ToggleLeasingDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ example: 'Annual maintenance blackout' })
  @IsOptional()
  @IsString()
  reason?: string;
}

