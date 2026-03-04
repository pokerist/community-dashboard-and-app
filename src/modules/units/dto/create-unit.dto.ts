import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsEnum,
  Min,
  IsInt,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UnitType } from '@prisma/client';

export class CreateUnitDto {
  @ApiProperty({ example: 'A-504' })
  @IsNotEmpty()
  @IsString()
  unitNumber!: string;

  @ApiProperty({ example: 'Sunrise Residences' })
  @IsNotEmpty()
  @IsString()
  projectName!: string;

  @ApiProperty({ required: false, example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiProperty({ example: 'Block A', required: false })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({ example: 'APARTMENT', enum: UnitType })
  @IsNotEmpty()
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  floors?: number;

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiProperty({ example: 2, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiProperty({ example: 120.5 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  sizeSqm!: number;

  @ApiProperty({ example: 1500000.0, required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;
}
