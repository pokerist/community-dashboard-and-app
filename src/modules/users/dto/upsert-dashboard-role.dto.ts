import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpsertDashboardRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}
