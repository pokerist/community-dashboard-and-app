import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkQrUsedDto {
  @IsOptional()
  @IsDateString()
  scannedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  gateName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

