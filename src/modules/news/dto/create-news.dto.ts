import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ example: 'The main pool has been fully renovated and is now open!' })
  @IsString()
  caption!: string;

  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsUUID()
  imageFileId?: string;

  @ApiPropertyOptional({ example: 'community-uuid' })
  @IsOptional()
  @IsUUID()
  communityId?: string;
}
