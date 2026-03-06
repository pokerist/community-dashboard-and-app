import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class AddHolidayDto {
  @ApiProperty({ example: '2026-04-10' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'Eid Al-Fitr' })
  @IsString()
  @IsNotEmpty()
  label!: string;
}
