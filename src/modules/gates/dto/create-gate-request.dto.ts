import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { CreateGateDto } from './create-gate.dto';

export class CreateGateRequestDto extends CreateGateDto {
  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;
}
