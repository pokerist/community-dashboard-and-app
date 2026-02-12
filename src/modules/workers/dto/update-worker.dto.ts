import { ApiPropertyOptional } from '@nestjs/swagger';
import { EntityStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateWorkerDto {
  @ApiPropertyOptional({ example: 'Ahmed Ali' })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ example: '29801011234567' })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({ example: '+201234567890' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'file-uuid-or-provider-id' })
  @IsString()
  @IsOptional()
  photoId?: string;

  @ApiPropertyOptional({ example: 'Electrician' })
  @IsString()
  @IsOptional()
  jobType?: string;

  @ApiPropertyOptional({ enum: EntityStatus, example: EntityStatus.ACTIVE })
  @IsEnum(EntityStatus)
  @IsOptional()
  status?: EntityStatus;
}

