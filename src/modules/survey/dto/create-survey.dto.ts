import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { SurveyFieldType, SurveyTarget } from '@prisma/client';

class SurveyQuestionOptionsDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  choices!: string[];
}

export class SurveyTargetMetaDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  communityIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  unitIds?: string[];
}

export class CreateSurveyQuestionDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsEnum(SurveyFieldType)
  type!: SurveyFieldType;

  @ValidateIf((value: CreateSurveyQuestionDto) => value.type === SurveyFieldType.MULTIPLE_CHOICE)
  @IsDefined()
  @ValidateNested()
  @Type(() => SurveyQuestionOptionsDto)
  options?: SurveyQuestionOptionsDto;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class UpdateSurveyQuestionDto extends CreateSurveyQuestionDto {
  @IsOptional()
  @IsUUID('4')
  id?: string;
}

export class CreateSurveyDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SurveyTarget)
  targetType?: SurveyTarget;

  @IsOptional()
  @ValidateNested()
  @Type(() => SurveyTargetMetaDto)
  targetMeta?: SurveyTargetMetaDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSurveyQuestionDto)
  questions!: CreateSurveyQuestionDto[];
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SurveyTarget)
  targetType?: SurveyTarget;

  @IsOptional()
  @ValidateNested()
  @Type(() => SurveyTargetMetaDto)
  targetMeta?: SurveyTargetMetaDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSurveyQuestionDto)
  questions?: UpdateSurveyQuestionDto[];
}
