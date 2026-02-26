import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelServiceRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

