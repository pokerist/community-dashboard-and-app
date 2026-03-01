import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TriggerFireEvacuationDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  titleEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  messageEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2200)
  messageAr?: string;
}
