import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BlueCollarWeekDay,
  CompoundStaffPermission,
  CompoundStaffStatus,
  GateDirection,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
  MaxLength,
} from 'class-validator';

export class CompoundStaffScheduleInputDto {
  @ApiProperty({ enum: BlueCollarWeekDay, example: BlueCollarWeekDay.SUNDAY })
  @IsEnum(BlueCollarWeekDay)
  dayOfWeek!: BlueCollarWeekDay;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @ApiPropertyOptional({ example: '16:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime?: string;

  @ApiPropertyOptional({ example: 'Morning shift' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CompoundStaffGateAccessInputDto {
  @ApiProperty({ example: 'gate-uuid' })
  @IsUUID()
  gateId!: string;

  @ApiPropertyOptional({
    enum: GateDirection,
    isArray: true,
    example: [GateDirection.ENTRY, GateDirection.EXIT],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(GateDirection, { each: true })
  directions?: GateDirection[];
}

export class CreateCompoundStaffDto {
  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;

  @ApiPropertyOptional({ example: 'commercial-entity-uuid' })
  @IsOptional()
  @IsUUID()
  commercialEntityId?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ example: 'Mahmoud Salah' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: '01020000003' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ example: '29801011234567' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  nationalId!: string;

  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsUUID()
  photoFileId?: string;

  @ApiProperty({ example: 'Security' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  profession!: string;

  @ApiPropertyOptional({ example: 'Gate Security Officer' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @ApiPropertyOptional({
    example: { shifts: ['Sun-Thu 08:00-16:00'], timezone: 'Africa/Cairo' },
  })
  @IsOptional()
  @IsObject()
  workSchedule?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-03-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractFrom?: string;

  @ApiPropertyOptional({ example: '2027-03-10T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  contractTo?: string;

  @ApiPropertyOptional({ enum: CompoundStaffStatus, example: CompoundStaffStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CompoundStaffStatus)
  status?: CompoundStaffStatus;

  @ApiPropertyOptional({
    enum: CompoundStaffPermission,
    isArray: true,
    example: [CompoundStaffPermission.ENTRY_EXIT, CompoundStaffPermission.ATTENDANCE],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(CompoundStaffPermission, { each: true })
  permissions?: CompoundStaffPermission[];

  @ApiPropertyOptional({ type: [CompoundStaffScheduleInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((item: CompoundStaffScheduleInputDto) => item.dayOfWeek)
  @ValidateNested({ each: true })
  @Type(() => CompoundStaffScheduleInputDto)
  schedules?: CompoundStaffScheduleInputDto[];

  @ApiPropertyOptional({ type: [CompoundStaffGateAccessInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayUnique((item: CompoundStaffGateAccessInputDto) => item.gateId)
  @ValidateNested({ each: true })
  @Type(() => CompoundStaffGateAccessInputDto)
  gateAccesses?: CompoundStaffGateAccessInputDto[];
}
