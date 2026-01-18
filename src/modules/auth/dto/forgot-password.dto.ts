import { IsEmail, Matches, IsNotEmpty, IsOptional } from 'class-validator';

export class ForgotPasswordDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?\d{9,15}$/)
  phone?: string;
}
