import { ApiProperty } from '@nestjs/swagger';
import { GateRole } from '@prisma/client';
import { ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';

export class UpdateGateRolesDto {
  @ApiProperty({
    enum: GateRole,
    isArray: true,
    example: [GateRole.VISITOR, GateRole.DELIVERY],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsEnum(GateRole, { each: true })
  roles!: GateRole[];
}

