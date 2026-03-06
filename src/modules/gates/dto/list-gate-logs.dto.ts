import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { QRType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export enum GateLogStatusFilter {
  ACTIVE = 'ACTIVE',
  INSIDE = 'INSIDE',
  EXITED = 'EXITED',
}

export class ListGateLogsDto {
  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ example: 'gate-uuid' })
  @IsOptional()
  @IsUUID()
  gateId?: string;

  @ApiPropertyOptional({ example: '2026-03-05T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-06T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: QRType, example: QRType.VISITOR })
  @IsOptional()
  @IsEnum(QRType)
  qrType?: QRType;

  @ApiPropertyOptional({ enum: GateLogStatusFilter, example: GateLogStatusFilter.INSIDE })
  @IsOptional()
  @IsEnum(GateLogStatusFilter)
  status?: GateLogStatusFilter;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
