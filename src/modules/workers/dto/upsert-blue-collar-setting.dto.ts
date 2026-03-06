import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlueCollarWeekDay } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpsertBlueCollarSettingDto {
  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;

  @ApiPropertyOptional({
    enum: BlueCollarWeekDay,
    isArray: true,
    example: [BlueCollarWeekDay.SUNDAY, BlueCollarWeekDay.MONDAY, BlueCollarWeekDay.TUESDAY],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(BlueCollarWeekDay, { each: true })
  workDays?: BlueCollarWeekDay[];

  @ApiPropertyOptional({ example: '08:00', description: 'HH:mm format (24-hour)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\\d|2[0-3]):([0-5]\\d)$/)
  workStartTime?: string | null;

  @ApiPropertyOptional({ example: '18:00', description: 'HH:mm format (24-hour)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\\d|2[0-3]):([0-5]\\d)$/)
  workEndTime?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['2026-03-23', '2026-04-06'],
    description: 'Holiday dates in YYYY-MM-DD format',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  holidays?: string[];

  @ApiPropertyOptional({ example: 'Workers must carry IDs at all times.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  termsAndConditions?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresAdminApproval?: boolean;
}
