import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListBlueCollarHolidaysDto {
  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;

  @ApiProperty({ required: false, example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
