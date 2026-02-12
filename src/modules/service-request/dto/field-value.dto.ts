// src/service-request/dto/field-value.dto.ts

import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FieldValueDto {
  @IsUUID('4', { message: 'Field ID must be a valid UUID.' })
  fieldId!: string; // The ID of the ServiceField this value relates to

  // Only one of these should be populated based on the field type
  @IsString()
  @IsOptional()
  valueText?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  valueNumber?: number;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  valueBool?: boolean;

  @IsDateString()
  @IsOptional()
  valueDate?: Date;

  // Note: For file uploads, you would pass the fileId here instead of valueText
  @IsUUID('4', { message: 'File Attachment ID must be a valid UUID.' })
  @IsOptional()
  fileAttachmentId?: string;
}
