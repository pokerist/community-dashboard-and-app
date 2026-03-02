import { IsOptional, IsString, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsOptional()
  @Matches(/^\d{6}$/)
  otp!: string;

  @IsOptional()
  @IsString()
  firebaseIdToken!: string;
}
