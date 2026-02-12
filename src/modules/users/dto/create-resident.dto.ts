import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateResidentDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  nationalId?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
