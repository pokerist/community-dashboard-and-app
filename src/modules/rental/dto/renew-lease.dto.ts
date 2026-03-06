import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';

export class RenewLeaseDto {
  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2027-03-31T23:59:59.999Z' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ example: 12000 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monthlyRent!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

