import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ScreenSurface, UnitStatus } from '@prisma/client';

export class ScreenVisibilityRuleItemDto {
  @IsString()
  @IsNotEmpty()
  personaKey!: string;

  @IsString()
  @IsNotEmpty()
  screenKey!: string;

  @IsEnum(ScreenSurface)
  surface!: ScreenSurface;

  @IsEnum(UnitStatus)
  unitStatus!: UnitStatus;

  @IsBoolean()
  visible!: boolean;
}

export class ReplaceScreenVisibilityRulesDto {
  @IsOptional()
  @IsEnum(ScreenSurface)
  surface?: ScreenSurface;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenVisibilityRuleItemDto)
  rules!: ScreenVisibilityRuleItemDto[];
}
