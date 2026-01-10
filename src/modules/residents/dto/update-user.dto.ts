import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsArray } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsEnum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED'])
  userStatus?: string;

  // Override roles to accept both string IDs and objects with role property
  @IsOptional()
  @IsArray()
  roles?: any[];
}
