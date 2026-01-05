import { IsOptional, IsEnum, IsString } from 'class-validator';
import { UnitType, UnitStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UnitQueryDto {
  @ApiProperty({ example: 'APARTMENT', enum: UnitType, required: false })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiProperty({ example: 'OCCUPIED', enum: UnitStatus, required: false })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiProperty({ example: 'Block A', required: false })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({ example: 'Sunrise Residences', required: false })
  @IsOptional()
  @IsString()
  projectName?: string;
}
