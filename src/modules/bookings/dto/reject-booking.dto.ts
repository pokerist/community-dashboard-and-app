import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
