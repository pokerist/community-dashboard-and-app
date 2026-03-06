import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PermitFieldValueInputDto {
  @IsUUID('4')
  fieldId!: string;

  @IsDefined()
  value!: string | number | boolean;
}

export class CreatePermitRequestDto {
  @IsUUID('4')
  permitTypeId!: string;

  @IsUUID('4')
  unitId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermitFieldValueInputDto)
  fieldValues!: PermitFieldValueInputDto[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes?: string;
}
