import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ServiceFieldType } from '@prisma/client';

export class CreateServiceFieldDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsEnum(ServiceFieldType)
  type!: ServiceFieldType;

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}

