import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateOwnerWithUnitDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  nationalId: string;

  @IsString()
  @IsNotEmpty()
  nationalIdPhotoId: string; // Mandatory national ID photo

  @IsString()
  @IsNotEmpty()
  unitId: string;
}
