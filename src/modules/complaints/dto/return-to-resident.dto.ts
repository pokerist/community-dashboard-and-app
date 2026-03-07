import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReturnToResidentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}
