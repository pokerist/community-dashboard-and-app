import { IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  facilityId: string;

  @IsDateString()
  date: string;

  @IsString()
  startTime: string; // "18:00"

  @IsString()
  endTime: string;

  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  residentId?: string;

  @IsString()
  unitId?: string;
}
