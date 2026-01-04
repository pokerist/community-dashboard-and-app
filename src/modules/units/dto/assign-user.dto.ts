import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignUserDto {
  @ApiProperty({ example: 'user-uuid-1234' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ example: 'OWNER', enum: ['OWNER', 'TENANT', 'FAMILY'] })
  @IsNotEmpty()
  @IsEnum(['OWNER', 'TENANT', 'FAMILY'])
  role: 'OWNER' | 'TENANT' | 'FAMILY';
}
