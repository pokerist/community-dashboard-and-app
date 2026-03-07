import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignComplaintDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignedToId!: string;
}
