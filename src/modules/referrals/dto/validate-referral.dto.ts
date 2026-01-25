import { IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateReferralDto {
  @ApiProperty({
    description: 'Phone number to validate referral for',
    example: '+201234567890',
  })
  @IsNotEmpty()
  @Matches(/^\+?\d{9,15}$/, {
    message: 'Phone number must be a valid format',
  })
  phone: string;
}

export class ValidateReferralResponseDto {
  @ApiProperty({
    description: 'Whether a valid referral exists for this phone',
    example: true,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Name of the referrer if valid',
    example: 'John Smith',
    required: false,
  })
  referrerName?: string;

  @ApiProperty({
    description: 'Message providing additional information',
    example: 'Referral found for this phone number.',
  })
  message: string;
}
