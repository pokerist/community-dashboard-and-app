import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { UnitCategory, UnitStatus, UnitType } from '@prisma/client';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export type UnitDisplayStatus =
  | 'OFF_PLAN'
  | 'UNDER_CONSTRUCTION'
  | 'DELIVERED';

const DISPLAY_STATUS_VALUES: UnitDisplayStatus[] = [
  'OFF_PLAN',
  'UNDER_CONSTRUCTION',
  'DELIVERED',
];

export class UnitQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({ enum: UnitType, example: UnitType.APARTMENT })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({ enum: UnitStatus, example: UnitStatus.OFF_PLAN })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ enum: UnitCategory, example: UnitCategory.RESIDENTIAL })
  @IsOptional()
  @IsEnum(UnitCategory)
  category?: UnitCategory;

  @ApiPropertyOptional({ example: 'Block A' })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ example: 'cluster-uuid' })
  @IsOptional()
  @IsUUID()
  clusterId?: string;

  @ApiPropertyOptional({ example: 'phase-uuid' })
  @IsOptional()
  @IsUUID()
  phaseId?: string;

  @ApiPropertyOptional({ enum: DISPLAY_STATUS_VALUES, example: 'DELIVERED' })
  @IsOptional()
  @IsEnum(DISPLAY_STATUS_VALUES)
  displayStatus?: UnitDisplayStatus;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
