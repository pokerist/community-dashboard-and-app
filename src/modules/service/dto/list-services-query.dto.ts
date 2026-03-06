import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ServiceCategory } from '@prisma/client';

export class ListServicesQueryDto {
  @IsOptional()
  @IsEnum(ServiceCategory)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  category?: ServiceCategory;

  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  status?: 'active' | 'inactive' | 'all';

  @IsOptional()
  @IsString()
  search?: string;
}

