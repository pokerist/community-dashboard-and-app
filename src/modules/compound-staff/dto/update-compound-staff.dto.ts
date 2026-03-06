import { ApiPropertyOptional } from '@nestjs/swagger';
import { CompoundStaffStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsObject,
  IsArray,
  IsString,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import {
  CompoundStaffGateAccessInputDto,
  CompoundStaffScheduleInputDto,
} from './create-compound-staff.dto';

export class UpdateCompoundStaffDto {
  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ example: 'commercial-entity-uuid' })
  @IsOptional()
  @IsUUID()
  commercialEntityId?: string | null;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({ example: 'Mahmoud Salah' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fullName?: string;

  @ApiPropertyOptional({ example: '01020000003' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: '29801011234567' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nationalId?: string;

  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsUUID()
  photoFileId?: string | null;

  @ApiPropertyOptional({ example: 'Security Officer' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  profession?: string;

  @ApiPropertyOptional({ example: 'Gate Security Officer' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string | null;

  @ApiPropertyOptional({
    example: { shifts: ['Sun-Thu 08:00-16:00'], timezone: 'Africa/Cairo' },
  })
  @IsOptional()
  @IsObject()
  workSchedule?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: '2026-03-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractFrom?: string | null;

  @ApiPropertyOptional({ example: '2027-03-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractTo?: string | null;

  @ApiPropertyOptional({ enum: CompoundStaffStatus, example: CompoundStaffStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompoundStaffStatus)
  status?: CompoundStaffStatus;

  @ApiPropertyOptional({ type: [CompoundStaffScheduleInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((item: CompoundStaffScheduleInputDto) => item.dayOfWeek)
  @ValidateNested({ each: true })
  @Type(() => CompoundStaffScheduleInputDto)
  schedules?: CompoundStaffScheduleInputDto[] | null;

  @ApiPropertyOptional({ type: [CompoundStaffGateAccessInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((item: CompoundStaffGateAccessInputDto) => item.gateId)
  @ValidateNested({ each: true })
  @Type(() => CompoundStaffGateAccessInputDto)
  gateAccesses?: CompoundStaffGateAccessInputDto[] | null;
}
