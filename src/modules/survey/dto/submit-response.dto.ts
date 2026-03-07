import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SubmitSurveyAnswerDto {
  @IsUUID('4')
  questionId!: string;

  @IsOptional()
  @IsString()
  valueText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  valueNumber?: number;

  @IsOptional()
  @IsString()
  valueChoice?: string;
}

export class SubmitResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitSurveyAnswerDto)
  answers!: SubmitSurveyAnswerDto[];
}
