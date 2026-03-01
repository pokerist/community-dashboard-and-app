import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpsertDiscoverPlaceDto {
  @ApiProperty({ example: 'Gourmet Market' })
  @IsString()
  @MaxLength(140)
  name!: string;

  @ApiPropertyOptional({ example: 'Supermarket' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'New Cairo, Cairo' })
  @IsOptional()
  @IsString()
  @MaxLength(220)
  address?: string;

  @ApiPropertyOptional({ example: 'https://maps.google.com/?q=...' })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  mapLink?: string;

  @ApiPropertyOptional({ example: '+201122334455' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'Daily 10:00 - 22:00' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  workingHours?: string;

  @ApiPropertyOptional({ example: 'uuid-file-id' })
  @IsOptional()
  @IsUUID()
  imageFileId?: string;

  @ApiPropertyOptional({ example: '8 mins away' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  distanceHint?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
