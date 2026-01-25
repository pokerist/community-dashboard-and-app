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
  password: string;

  @IsString()
  @IsOptional()
  nationalId?: string;

  @IsString()
  @IsNotEmpty()
  unitId: string;
}
