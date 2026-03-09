import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GateAccessMode, UnitCategory, UnitStatus, UnitType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;

  @ApiPropertyOptional({ example: 'cluster-uuid' })
  @IsOptional()
  @IsUUID()
  clusterId?: string;

  @ApiPropertyOptional({ example: 'phase-uuid' })
  @IsOptional()
  @IsUUID()
  phaseId?: string;

  @ApiPropertyOptional({ example: 'Block A' })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({ example: 'A-504' })
  @IsNotEmpty()
  @IsString()
  unitNumber!: string;

  @ApiPropertyOptional({ example: UnitCategory.RESIDENTIAL, enum: UnitCategory })
  @IsOptional()
  @IsEnum(UnitCategory)
  category?: UnitCategory;

  @ApiProperty({ example: UnitType.APARTMENT, enum: UnitType })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiPropertyOptional({ example: UnitStatus.OFF_PLAN, enum: UnitStatus })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDelivered?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  floors?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({ example: 120.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeSqm?: number;

  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    enum: GateAccessMode,
    example: GateAccessMode.ALL_GATES,
  })
  @IsOptional()
  @IsEnum(GateAccessMode)
  gateAccessMode?: GateAccessMode;

  @ApiPropertyOptional({
    isArray: true,
    type: String,
    example: ['gate-uuid-1', 'gate-uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  allowedGateIds?: string[];
}

