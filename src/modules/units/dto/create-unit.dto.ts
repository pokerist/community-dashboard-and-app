import { IsNotEmpty, IsNumber, IsString, IsOptional, IsPositive, IsIn } from 'class-validator';
import { UnitType } from '@prisma/client'; // Import enums from Prisma
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnitDto {
  @ApiProperty({ example: 'A-504' })
  @IsNotEmpty()
  @IsString()
  unitNumber: string; // e.g., A-504

  @IsNotEmpty()
  @IsString()
  projectName: string;

  @IsNotEmpty()
  @IsString()
  block: string; // e.g., Block A

  @IsNotEmpty()
  @IsString()
  @IsIn(Object.values(UnitType)) // Enforce type safety using Prisma enum
  type: UnitType; // villa, apt, penthouse, duplex

  @IsOptional()
  @IsNumber()
  @IsPositive()
  floors?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  bathrooms?: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  sizeSqm: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number; // Lease/Sale price
}