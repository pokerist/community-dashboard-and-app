import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectWorkerAccessDto {
  @ApiProperty({ example: 'National ID verification failed.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
