import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteActivationDto {
  @ApiProperty({
    description: 'Uploaded national ID or passport file id',
    example: 'd6a5a8dd-8dbb-4f06-8d6f-65c8f4f0c1cf',
  })
  @IsUUID()
  nationalIdFileId!: string;

  @ApiProperty({
    description: 'Uploaded profile photo file id',
    example: 'a5d2d2ce-4b35-4dca-9488-2e7b9f8c6fb9',
  })
  @IsUUID()
  profilePhotoId!: string;

  @ApiProperty({
    description: 'New password to be used after first login',
    minLength: 8,
    maxLength: 72,
    example: 'StrongPass123!',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;

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

