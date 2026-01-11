import { IsOptional, IsEnum, IsString } from 'class-validator';
import { UnitType, UnitStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export class UnitQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ enum: UnitType, example: UnitType.APARTMENT })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({ enum: UnitStatus, example: UnitStatus.OCCUPIED })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ example: 'Block A' })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiPropertyOptional({ example: 'Sunrise Residences' })
  @IsOptional()
  @IsString()
  projectName?: string;
}
