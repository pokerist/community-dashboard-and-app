import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectRentRequestDto {
  @ApiProperty({ example: 'Invalid tenant documents' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

