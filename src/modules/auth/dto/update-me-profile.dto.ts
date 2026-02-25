import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMeProfileDto {
  @ApiPropertyOptional({ example: 'Ahmed Hassan Mohamed' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameEN?: string;

  @ApiPropertyOptional({ example: 'أحمد حسن محمد' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAR?: string;
}

