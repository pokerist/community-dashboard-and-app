import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreatePendingRegistrationDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @Matches(/^\+?\d{9,15}$/, { message: 'Phone number format is invalid.' })
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsNotEmpty()
  @IsString()
  nationalId: string; // PIC

  @IsNotEmpty()
  @IsString()
  personalPhotoId: string; // uploaded file ID

  @IsOptional()
  @IsString()
  password?: string; // optional if user will set later
}
