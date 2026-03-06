import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompoundStaffStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ListCompoundStaffDto {
  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ example: 'commercial-entity-uuid' })
  @IsOptional()
  @IsUUID()
  commercialEntityId?: string;

  @ApiPropertyOptional({ example: 'security' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ enum: CompoundStaffStatus, example: CompoundStaffStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompoundStaffStatus)
  status?: CompoundStaffStatus;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  contractExpiringSoon?: boolean;

  @ApiPropertyOptional({ example: 30, default: 30 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  contractExpiringSoonDays?: number;
}
