import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpsertHelpCenterEntryDto {
  @ApiProperty({ example: 'Security Gate' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ example: '+201000000000' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ example: '24/7' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  availability?: string;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
