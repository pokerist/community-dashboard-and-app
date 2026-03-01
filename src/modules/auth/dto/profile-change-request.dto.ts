import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProfileChangeRequestDto {
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

  @ApiPropertyOptional({ example: 'ahmed.owner@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ example: '+201100000000' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(24)
  phone?: string;
}

export class ReviewProfileChangeRequestDto {
  @ApiPropertyOptional({ example: 'Please provide valid phone format' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
