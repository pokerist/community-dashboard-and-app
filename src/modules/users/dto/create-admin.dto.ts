import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateAdminDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED'])
  status?: string;
}
