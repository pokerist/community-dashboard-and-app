// src/modules/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  nameEN!: string;

  @IsOptional()
  nameAR?: string;
}
