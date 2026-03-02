import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

class FireHelpLocationDto {
  @ApiPropertyOptional()
  @IsNumber()
  lat!: number;

  @ApiPropertyOptional()
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  capturedAt?: string;
}

export class FireEvacuationNeedHelpDto {
  @ApiPropertyOptional({ enum: ['GPS', 'NO_LOCATION'], default: 'NO_LOCATION' })
  @IsIn(['GPS', 'NO_LOCATION'])
  @IsOptional()
  source?: 'GPS' | 'NO_LOCATION';

  @ApiPropertyOptional({ type: FireHelpLocationDto })
  @IsObject()
  @IsOptional()
  location?: FireHelpLocationDto;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
