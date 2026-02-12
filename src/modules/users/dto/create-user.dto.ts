import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  IsArray,
} from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  nameEN!: string;

  @IsOptional()
  @IsString()
  nameAR?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{9,15}$/, { message: 'Phone number format is invalid.' })
  phone?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsArray()
  roles?: string[]; // Array of role IDs

  @IsOptional()
  @IsString()
  signupSource?: string; // "community" or "dashboard"
}
