import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateActivationDraftDto {
  @ApiPropertyOptional({
    description: 'Uploaded national ID or passport file id',
    example: 'd6a5a8dd-8dbb-4f06-8d6f-65c8f4f0c1cf',
  })
  @IsOptional()
  @IsUUID()
  nationalIdFileId?: string;

  @ApiPropertyOptional({
    description: 'Uploaded profile photo file id',
    example: 'a5d2d2ce-4b35-4dca-9488-2e7b9f8c6fb9',
  })
  @IsOptional()
  @IsUUID()
  profilePhotoId?: string;
}

