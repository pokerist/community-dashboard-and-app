import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

