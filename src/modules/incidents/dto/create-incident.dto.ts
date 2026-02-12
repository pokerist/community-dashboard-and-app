import {
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIncidentDto {
  @IsNotEmpty()
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  residentName?: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsEnum(Priority)
  @IsNotEmpty()
  priority!: Priority;

  @IsOptional()
  @IsUUID('4', { message: 'Unit ID must be a valid UUID.' })
  unitId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each attachment ID must be a valid UUID.' })
  attachmentIds?: string[];
}
