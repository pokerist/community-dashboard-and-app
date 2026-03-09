import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionOverrideItem {
  @ApiProperty({ example: 'complaint.create' })
  @IsString()
  permissionKey!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  grant!: boolean;
}

export class SetUserOverridesDto {
  @ApiProperty({ type: [PermissionOverrideItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionOverrideItem)
  overrides!: PermissionOverrideItem[];
}
