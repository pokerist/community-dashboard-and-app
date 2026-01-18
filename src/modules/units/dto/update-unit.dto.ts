import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateUnitDto } from './create-unit.dto';
import { UnitType, UnitStatus } from '@prisma/client';

export class UpdateUnitDto extends PartialType(CreateUnitDto) {
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;
}
