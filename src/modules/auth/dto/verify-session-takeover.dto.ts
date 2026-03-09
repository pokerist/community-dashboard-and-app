import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifySessionTakeoverDto {
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @IsString()
  @Length(4, 8)
  otp!: string;
}
