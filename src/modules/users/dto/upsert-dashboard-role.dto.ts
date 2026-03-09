import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertDashboardRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moduleKeys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personaKeys?: string[];

  @IsOptional()
  statusPermissions?: Record<string, string[]>;
}
