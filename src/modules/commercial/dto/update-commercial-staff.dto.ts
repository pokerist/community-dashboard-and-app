import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommercialEntityMemberRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { CommercialMemberPermissionsDto } from './add-commercial-staff.dto';

export class UpdateCommercialMemberDto {
  @ApiPropertyOptional({ enum: CommercialEntityMemberRole })
  @IsOptional()
  @IsEnum(CommercialEntityMemberRole)
  role?: CommercialEntityMemberRole;

  @ApiPropertyOptional({ type: CommercialMemberPermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommercialMemberPermissionsDto)
  permissions?: CommercialMemberPermissionsDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
