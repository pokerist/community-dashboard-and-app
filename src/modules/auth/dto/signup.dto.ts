import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, IsOptional, ValidateIf } from 'class-validator';

export class SignupDto {
  @IsNotEmpty()
  @IsString()
  name: string;
  
  // Assuming international format
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+?\d{9,15}$/, { message: 'Phone number format is invalid.' })
  phone: string; 

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsString()
  nationalId: string;

}