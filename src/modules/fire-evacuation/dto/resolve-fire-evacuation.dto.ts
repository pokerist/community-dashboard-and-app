import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveFireEvacuationDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;
}
