import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateResidentVehicleDto {
  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'Corolla 2024' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  model?: string;

  @ApiPropertyOptional({ example: 'ق و 1234' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  plateNumber?: string;

  @ApiPropertyOptional({ example: 'White' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ example: 'Parking B2 - Slot 14' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

