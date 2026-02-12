// src/modules/auth/dto/login.dto.ts
import {
  IsEmail,
  Matches,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?\d{9,15}$/)
  phone?: string;

  @IsNotEmpty()
  password!: string;
}
