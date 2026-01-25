import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsArray, IsString, IsUUID } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsEnum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED'])
  userStatus?: string;

  // Roles are standardized to string array of role IDs
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsUUID()
  profilePhotoId?: string;
}
