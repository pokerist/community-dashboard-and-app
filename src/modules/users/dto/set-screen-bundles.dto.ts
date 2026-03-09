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
import { ScreenSurface } from '@prisma/client';

export class ScreenBundleItemDto {
  @IsString()
  @IsNotEmpty()
  permissionKey!: string;

  @IsOptional()
  @IsString()
  actionKey?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class ScreenBundleDto {
  @IsString()
  @IsNotEmpty()
  screenKey!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenBundleItemDto)
  items!: ScreenBundleItemDto[];
}

export class ReplaceScreenBundlesDto {
  @IsOptional()
  @IsEnum(ScreenSurface)
  surface?: ScreenSurface;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenBundleDto)
  bundles!: ScreenBundleDto[];
}

export class RoleScreenOverrideItemDto {
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @IsString()
  @IsNotEmpty()
  screenKey!: string;

  @IsString()
  @IsNotEmpty()
  permissionKey!: string;

  @IsBoolean()
  grant!: boolean;
}

export class ReplaceRoleScreenOverridesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleScreenOverrideItemDto)
  overrides!: RoleScreenOverrideItemDto[];
}
