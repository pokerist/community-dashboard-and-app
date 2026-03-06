import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PreRegisterOwnerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nameEN!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nationalId!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

