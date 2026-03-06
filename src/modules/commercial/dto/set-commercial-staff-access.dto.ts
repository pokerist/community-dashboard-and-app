import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CommercialMemberPermissionsDto } from './add-commercial-staff.dto';

export class SetCommercialMemberPermissionsDto {
  @ApiProperty({ type: CommercialMemberPermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommercialMemberPermissionsDto)
  permissions!: CommercialMemberPermissionsDto;
}
