import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateResidentVehicleDto {
  @ApiProperty({ example: 'Toyota', description: 'Vehicle make/type label' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  vehicleType!: string;

  @ApiProperty({ example: 'Corolla 2024', description: 'Vehicle model details' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  model!: string;

  @ApiProperty({ example: 'ق و 1234', description: 'Vehicle plate number' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  plateNumber!: string;

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

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

