import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectPermitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
