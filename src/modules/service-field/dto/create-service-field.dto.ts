// src/service-field/dto/create-service-field.dto.ts

import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { ServiceFieldType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateServiceFieldDto {
  @IsUUID('4', { message: 'Service ID must be a valid UUID.' })
  @IsNotEmpty()
  serviceId: string; // The service this field belongs to (e.g., Furniture Permit)

  @IsString()
  @IsNotEmpty()
  label: string; // The user-facing label (e.g., "Direction (In/Out)")

  @IsEnum(ServiceFieldType)
  @IsNotEmpty()
  type: ServiceFieldType; // The input type (e.g., TEXT, MEMBER_SELECTOR)

  @IsString()
  @IsOptional()
  placeholder?: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean = false;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  order?: number = 0; // For ordering fields on the form

  // You might add a 'options: string[]' field here if the type is a SELECT/RADIO
}
