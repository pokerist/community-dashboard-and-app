import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReferralDto {
  @ApiProperty({
    description: 'Full name of the friend being referred',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  friendFullName!: string;

  @ApiProperty({
    description: 'Mobile phone number of the friend',
    example: '+201234567890',
  })
  @IsNotEmpty()
  @Matches(/^\+?\d{9,15}$/, {
    message: 'Phone number must be a valid format',
  })
  friendMobile!: string;

  @ApiPropertyOptional({
    description: 'Optional message to include with the referral',
    example: 'Hey, check out this amazing community!',
  })
  @IsOptional()
  @IsString()
  message?: string;
}
