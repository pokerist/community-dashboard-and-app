import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GateDirection } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompoundStaffGateAssignmentDto {
  @ApiProperty({ example: 'gate-uuid' })
  @IsUUID()
  gateId!: string;

  @ApiPropertyOptional({
    enum: GateDirection,
    isArray: true,
    example: [GateDirection.ENTRY, GateDirection.EXIT],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(GateDirection, { each: true })
  directions?: GateDirection[];
}

export class SetCompoundStaffGatesDto {
  @ApiProperty({ type: [CompoundStaffGateAssignmentDto] })
  @IsArray()
  @ArrayUnique((item: CompoundStaffGateAssignmentDto) => item.gateId)
  @ValidateNested({ each: true })
  @Type(() => CompoundStaffGateAssignmentDto)
  gateAccesses!: CompoundStaffGateAssignmentDto[];
}
