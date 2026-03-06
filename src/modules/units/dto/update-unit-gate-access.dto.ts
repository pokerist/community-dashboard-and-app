import { ApiProperty } from '@nestjs/swagger';
import { GateAccessMode } from '@prisma/client';
import { IsArray, IsEnum, IsUUID } from 'class-validator';

export class UpdateUnitGateAccessDto {
  @ApiProperty({
    enum: GateAccessMode,
    example: GateAccessMode.SELECTED_GATES,
  })
  @IsEnum(GateAccessMode)
  mode!: GateAccessMode;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ['gate-uuid-1', 'gate-uuid-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  allowedGateIds!: string[];
}

