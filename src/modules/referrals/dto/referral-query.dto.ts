import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';
import { ReferralStatus } from '@prisma/client';

export class ReferralQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by referral status',
    enum: ReferralStatus,
    example: ReferralStatus.NEW,
  })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @ApiPropertyOptional({
    description: 'Filter by referrer user ID',
    example: 'uuid-string',
  })
  @IsOptional()
  @IsString()
  referrerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by date range - start date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by date range - end date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
