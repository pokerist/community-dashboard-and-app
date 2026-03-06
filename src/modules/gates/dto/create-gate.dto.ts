import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityStatus, GateRole } from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateGateDto {
  @ApiProperty({ example: 'Gate 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'GATE_1' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    enum: GateRole,
    isArray: true,
    example: [GateRole.VISITOR, GateRole.DELIVERY, GateRole.RIDESHARE],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsEnum(GateRole, { each: true })
  allowedRoles!: GateRole[];

  @ApiPropertyOptional({ enum: EntityStatus, example: EntityStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;

  @ApiPropertyOptional({ example: 2, description: 'Expected ETA in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  etaMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isVisitorRequestRequired?: boolean;
}
