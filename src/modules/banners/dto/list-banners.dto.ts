import { BannerStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListBannersDto {
  @IsOptional()
  @IsEnum(BannerStatus)
  status?: BannerStatus;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() === 'true' : value,
  )
  @IsBoolean()
  activeOnly?: boolean;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

