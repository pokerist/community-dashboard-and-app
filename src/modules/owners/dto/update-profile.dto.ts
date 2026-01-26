import {
  IsString,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
  IsNotEmpty,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nameEN?: string;

  @IsOptional()
  @IsString()
  nameAR?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsString()
  profilePhotoId?: string;

  @IsOptional()
  @IsString()
  nationalIdPhotoId?: string;
}

export class UpdateFamilyProfileDto extends UpdateProfileDto {
  @IsOptional()
  @IsString()
  relationship?: string; // e.g., "spouse", "child", "parent"
}
