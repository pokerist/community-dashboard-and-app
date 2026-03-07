import { ReferralStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateMarketingReferralStatusDto {
  @IsEnum(ReferralStatus)
  status!: ReferralStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
