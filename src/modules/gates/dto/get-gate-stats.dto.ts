import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetGateStatsDto {
  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;
}
