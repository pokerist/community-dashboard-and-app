import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelBookingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
