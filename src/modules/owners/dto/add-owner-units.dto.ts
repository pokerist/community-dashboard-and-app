import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { CreateOwnerUnitAssignmentDto } from './create-owner-with-unit.dto';

export class AddOwnerUnitsDto {
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => CreateOwnerUnitAssignmentDto)
  units!: CreateOwnerUnitAssignmentDto[];
}
