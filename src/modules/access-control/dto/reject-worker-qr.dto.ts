import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectWorkerQrDto {
  @ApiPropertyOptional({
    example: 'Missing worker ID attachments',
    description: 'Optional rejection reason to send to resident',
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reason?: string;
}

