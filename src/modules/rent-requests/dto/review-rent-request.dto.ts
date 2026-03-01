import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RentRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewRentRequestDto {
  @ApiProperty({
    enum: [
      RentRequestStatus.APPROVED,
      RentRequestStatus.REJECTED,
      RentRequestStatus.CANCELLED,
    ],
  })
  @IsEnum(RentRequestStatus)
  status!: RentRequestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
