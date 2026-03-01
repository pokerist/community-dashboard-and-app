import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyLoginTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @IsString()
  @Length(4, 8)
  otp!: string;
}
