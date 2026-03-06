import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApprovePermitDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
