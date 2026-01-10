import { IsEnum, IsOptional, IsString, IsNotEmpty, IsArray } from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIncidentDto {
  @IsNotEmpty()
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  residentName?: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsEnum(Priority)
  priority: Priority;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];
}
