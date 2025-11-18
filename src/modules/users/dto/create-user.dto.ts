import { IsEmail, IsNotEmpty, IsString, IsOptional, Matches, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?\d{9,15}$/, { message: 'Phone number format is invalid.' })
  phone: string; 

  @IsEmail()
  @IsOptional()
  email?: string;

  // Initial role assignment (e.g., ADMIN, RESIDENT, CONTRACTOR)
  @IsNotEmpty()
  @IsEnum(Role) 
  role: Role; 

  @IsOptional()
  @IsString()
  nationalId?: string;

  // Password is required if this is a direct user creation, not via signup
  @IsOptional()
  @IsString()
  password?: string; 
}