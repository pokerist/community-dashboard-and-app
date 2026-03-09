import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SetRoleStatusPermissionsDto {
  @ApiProperty({ type: [String], example: ['complaint.create', 'complaint.view'] })
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}
