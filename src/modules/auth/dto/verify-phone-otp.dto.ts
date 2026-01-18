import { IsNotEmpty, Matches } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsNotEmpty()
  @Matches(/^\d{4,6}$/)
  otp: string;
}
