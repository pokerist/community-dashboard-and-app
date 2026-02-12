import { IsDateString, IsNotEmpty, IsUUID, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsUUID('4', { message: 'Facility ID must be a valid UUID.' })
  @IsNotEmpty()
  facilityId!: string;

  @IsUUID('4', { message: 'Unit ID must be a valid UUID.' })
  @IsNotEmpty()
  unitId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:MM (24h) format',
  })
  @IsNotEmpty()
  startTime!: string; // "18:00"

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:MM (24h) format',
  })
  @IsNotEmpty()
  endTime!: string;
}

