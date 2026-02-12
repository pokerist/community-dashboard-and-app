import { Matches } from 'class-validator';

export class SendPhoneOtpDto {
  @Matches(/^\+?\d{9,15}$/)
  phone!: string;
}
