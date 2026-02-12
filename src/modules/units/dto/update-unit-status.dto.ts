import { IsNotEmpty, IsEnum } from 'class-validator';
import { UnitStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUnitStatusDto {
  @ApiProperty({ example: 'OCCUPIED', enum: UnitStatus })
  @IsNotEmpty()
  @IsEnum(UnitStatus)
  status!: UnitStatus;
}
