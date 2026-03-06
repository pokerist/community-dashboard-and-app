import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateBlueCollarAccessRequestDto {
  @ApiProperty({ example: 'worker-uuid' })
  @IsUUID()
  workerId!: string;

  @ApiProperty({ example: '2026-03-10T08:00:00.000Z' })
  @IsDateString()
  requestedValidFrom!: string;

  @ApiProperty({ example: '2026-03-10T17:00:00.000Z' })
  @IsDateString()
  requestedValidTo!: string;

  @ApiPropertyOptional({ type: [String], example: ['GATE_A', 'GATE_C'] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  gates?: string[];

  @ApiPropertyOptional({ example: 'file-ref-worker-id-front' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idDocumentRef?: string;

  @ApiPropertyOptional({ example: 'Night maintenance shift' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
