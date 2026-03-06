import { ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListInvoicesDto {
  @ApiPropertyOptional({ example: '9ab2036e-5a84-4a7a-9abf-dd52372120c7' })
  @IsOptional()
  @IsUUID('4')
  unitId?: string;

  @ApiPropertyOptional({ example: 'cf74e92f-5cf7-4f85-a8a0-53d6cd730f28' })
  @IsOptional()
  @IsUUID('4')
  residentId?: string;

  @ApiPropertyOptional({ enum: InvoiceType, example: InvoiceType.RENT })
  @IsOptional()
  @IsEnum(InvoiceType)
  type?: InvoiceType;

  @ApiPropertyOptional({ enum: InvoiceStatus, example: InvoiceStatus.PENDING })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: '91ebdbbf-ec11-4a93-9533-7493f09572eb' })
  @IsOptional()
  @IsUUID('4')
  communityId?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;

  @ApiPropertyOptional({ example: 'INV-0012 / A-101 / Ahmed' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, default: 25, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class InvoiceStatsQueryDto {
  @ApiPropertyOptional({ example: '91ebdbbf-ec11-4a93-9533-7493f09572eb' })
  @IsOptional()
  @IsUUID('4')
  communityId?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T23:59:59.999Z' })
  @IsOptional()
  @IsDateString()
  dueTo?: string;
}
