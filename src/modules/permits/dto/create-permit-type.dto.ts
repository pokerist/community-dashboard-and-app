import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PermitCategory } from '@prisma/client';
import { CreatePermitFieldDto } from './create-permit-field.dto';

export class CreatePermitTypeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(PermitCategory)
  category!: PermitCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreatePermitFieldDto)
  @IsOptional()
  fields?: CreatePermitFieldDto[];
}
