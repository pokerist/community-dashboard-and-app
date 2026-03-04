import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class SosLocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @IsOptional()
  @IsString()
  capturedAt?: string;
}

export class CreateSosAlertDto {
  @IsOptional()
  @IsUUID('4', { message: 'unitId must be a valid UUID.' })
  unitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(700)
  note?: string;

  @IsOptional()
  @IsUUID('4', { message: 'voiceAttachmentId must be a valid UUID.' })
  voiceAttachmentId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SosLocationDto)
  location?: SosLocationDto;
}
