import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsOptional()
  @Matches(/^\d{4,6}$/)
  otp!: string;

  @IsString()
  @IsNotEmpty()
  firebaseIdToken!: string;
}
