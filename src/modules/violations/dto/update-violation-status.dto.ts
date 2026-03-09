import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViolationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateViolationStatusDto {
  @ApiProperty({ enum: ViolationStatus })
  @IsEnum(ViolationStatus)
  status!: ViolationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
