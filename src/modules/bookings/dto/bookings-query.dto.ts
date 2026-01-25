import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '../../../common/dto/base-query.dto';

export class BookingsQueryDto extends BaseQueryDto {
  @ApiPropertyOptional({
    enum: BookingStatus,
    example: BookingStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    example: 'facility-123',
  })
  @IsOptional()
  @IsString()
  facilityId?: string;

  @ApiPropertyOptional({
    example: 'user-123',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    example: 'unit-123',
  })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({
    example: '2023-01-01',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    example: '2023-01-31',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
