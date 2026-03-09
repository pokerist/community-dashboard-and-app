import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderPhasesDto {
  @ApiProperty({
    isArray: true,
    type: String,
    example: ['phase-id-1', 'phase-id-2', 'phase-id-3'],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}
