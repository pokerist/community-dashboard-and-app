import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectReferralDto {
  @ApiPropertyOptional({
    description: 'Reason for rejection (optional)',
    example: 'Invalid phone number',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
