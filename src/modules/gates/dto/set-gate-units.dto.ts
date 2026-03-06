import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetGateUnitsDto {
  @ApiProperty({
    type: [String],
    example: ['unit-uuid-1', 'unit-uuid-2'],
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  unitIds!: string[];
}

