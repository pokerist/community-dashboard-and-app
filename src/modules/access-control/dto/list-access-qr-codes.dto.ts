import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class ListAccessQrCodesDto {
  @ApiPropertyOptional({ example: 'unit-uuid-here' })
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, includes non-active statuses as well.',
  })
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  includeInactive?: boolean;
}

