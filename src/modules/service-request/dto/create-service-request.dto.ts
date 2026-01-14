// src/service-request/dto/create-service-request.dto.ts

import {
  IsUUID,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Priority } from '@prisma/client';
import { FieldValueDto } from './field-value.dto';
import { Type } from 'class-transformer';

export class CreateServiceRequestDto {
  @IsUUID('4', { message: 'Service ID must be a valid UUID.' })
  @IsNotEmpty()
  serviceId: string;

  @IsUUID('4', { message: 'Unit ID must be a valid UUID.' })
  @IsOptional()
  unitId?: string;

  @IsString()
  @IsNotEmpty({
    message: 'Description is required for the mandatory details box.',
  })
  description: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsArray()
  @IsUUID('4', {
    each: true,
    message: 'Each attachment ID must be a valid UUID.',
  })
  @IsOptional()
  attachmentIds?: string[]; // New: Array of IDs from pre-uploaded files

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldValueDto) // Ensure NestJS validates the nested array
  @IsOptional()
  fieldValues?: FieldValueDto[]; // New: Array of dynamic field inputs
}
