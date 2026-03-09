import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ScreenSurface } from '@prisma/client';

export class UpsertScreenDefinitionDto {
  @IsString()
  key!: string;

  @IsString()
  title!: string;

  @IsString()
  section!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  moduleKey?: string;

  @IsOptional()
  @IsEnum(ScreenSurface)
  surface?: ScreenSurface;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateScreenDefinitionDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  moduleKey?: string;

  @IsOptional()
  @IsEnum(ScreenSurface)
  surface?: ScreenSurface;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
