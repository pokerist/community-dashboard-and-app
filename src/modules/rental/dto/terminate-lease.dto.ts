import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TerminateLeaseDto {
  @ApiProperty({ example: 'Breach of lease terms' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

