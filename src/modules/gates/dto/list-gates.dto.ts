import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';

export class ListGatesDto {
  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  includeInactive?: boolean;
}
