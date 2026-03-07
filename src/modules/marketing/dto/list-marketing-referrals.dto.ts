import { ReferralStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ListMarketingReferralsDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class MarketingReferralListItemDto {
  id!: string;
  friendFullName!: string;
  friendMobile!: string;
  message!: string | null;
  status!: ReferralStatus;
  createdAt!: Date;
  referrer!: {
    id: string;
    name: string;
    phone: string | null;
  };
  convertedUser!: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
}

export class MarketingReferralListResponseDto {
  data!: MarketingReferralListItemDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
