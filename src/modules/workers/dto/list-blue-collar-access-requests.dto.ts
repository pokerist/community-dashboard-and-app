import { ApiPropertyOptional } from '@nestjs/swagger';
import { BlueCollarRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class ListBlueCollarAccessRequestsDto {
  @ApiPropertyOptional({ example: 'unit-uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ enum: BlueCollarRequestStatus, example: BlueCollarRequestStatus.PENDING })
  @IsOptional()
  @IsEnum(BlueCollarRequestStatus)
  status?: BlueCollarRequestStatus;
}
