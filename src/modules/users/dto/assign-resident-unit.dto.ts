import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsUUID } from 'class-validator';

export class AssignResidentUnitDto {
  @ApiProperty()
  @IsUUID('4')
  unitId!: string;

  @ApiProperty({ enum: ['OWNER', 'TENANT', 'FAMILY'] })
  @IsIn(['OWNER', 'TENANT', 'FAMILY'])
  role!: 'OWNER' | 'TENANT' | 'FAMILY';
}
