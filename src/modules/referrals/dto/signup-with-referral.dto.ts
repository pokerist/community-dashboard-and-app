import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupWithReferralDto {
  @ApiProperty({
    description: 'Phone number for the new user account',
    example: '+201234567890',
  })
  @IsNotEmpty()
  @Matches(/^\+?\d{9,15}$/, {
    message: 'Phone number must be a valid format',
  })
  phone!: string;

  @ApiProperty({
    description: 'Full name of the new user',
    example: 'Jane Doe',
  })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Password for the new user account',
    example: 'securePassword123',
    minLength: 6,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
