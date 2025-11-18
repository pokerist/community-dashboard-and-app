import { PartialType, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum, IsPositive, IsInt, Min } from 'class-validator';
import { UnitType, UnitStatus } from '@prisma/client';
import { CreateUnitDto } from './create-unit.dto';

export class UpdateUnitDto extends PartialType(CreateUnitDto) {
  @ApiProperty({
    description: 'Project name of the unit',
    example: 'Sunrise Residences',
    required: false,
  })
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiProperty({
    description: 'Block where the unit is located',
    example: 'B',
    required: false,
  })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({
    description: 'Unit number',
    example: '101',
    required: false,
  })
  @IsOptional()
  @IsString()
  unitNumber?: string;

  @ApiProperty({
    description: 'Type of the unit',
    enum: UnitType,
    required: false,
  })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiProperty({
    description: 'Number of floors in the unit (if applicable)',
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  floors?: number;

  @ApiProperty({
    description: 'Number of bedrooms',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiProperty({
    description: 'Number of bathrooms',
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiProperty({
    description: 'Size of the unit in square meters',
    example: 120.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  sizeSqm?: number;

  @ApiProperty({
    description: 'Price of the unit',
    example: 1500000.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiProperty({
    description: 'Current status of the unit',
    enum: UnitStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}