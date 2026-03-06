import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommercialEntityMemberRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CommercialMemberPermissionsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_work_orders?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_attendance?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_service_requests?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  can_tickets?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_photo_upload?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  can_task_reminders?: boolean;
}

export class AddCommercialMemberDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: CommercialEntityMemberRole, example: CommercialEntityMemberRole.STAFF })
  @IsEnum(CommercialEntityMemberRole)
  role!: CommercialEntityMemberRole;

  @ApiPropertyOptional({ type: CommercialMemberPermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommercialMemberPermissionsDto)
  permissions?: CommercialMemberPermissionsDto;
}
