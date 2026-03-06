import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class ReorderClustersDto {
  @ApiProperty({
    isArray: true,
    type: String,
    example: ['cluster-id-1', 'cluster-id-2', 'cluster-id-3'],
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

