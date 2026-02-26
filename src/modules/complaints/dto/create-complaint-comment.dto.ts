import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateComplaintCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}

