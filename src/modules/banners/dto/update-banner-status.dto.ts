import { BannerStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateBannerStatusDto {
  @IsEnum(BannerStatus)
  status!: BannerStatus;
}

