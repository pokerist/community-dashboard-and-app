import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
} from 'class-validator';

export class GenerateWorkerQrDto {
  @ApiPropertyOptional({ example: '2026-02-03T09:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  validFrom?: Date;

  @ApiPropertyOptional({ example: '2026-02-03T17:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  validTo?: Date;

  @ApiPropertyOptional({
    isArray: true,
    example: ['GATE_A', 'GATE_B'],
    description: 'Optional list of gates where QR is valid.',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @IsOptional()
  gates?: string[];

  @ApiPropertyOptional({ example: 'Shift access' })
  @IsString()
  @IsOptional()
  notes?: string;
}

