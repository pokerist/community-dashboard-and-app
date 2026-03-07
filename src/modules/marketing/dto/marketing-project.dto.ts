import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMarketingProjectDto {
  @IsString()
  @MinLength(2)
  nameEn!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsString()
  @MinLength(2)
  descriptionEn!: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsString()
  @MinLength(5)
  mobileNumber!: string;
}

export class UpdateMarketingProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  mobileNumber?: string;
}

export class MarketingProjectResponseDto {
  id!: string;
  nameEn!: string;
  nameAr!: string | null;
  descriptionEn!: string;
  descriptionAr!: string | null;
  mobileNumber!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
