import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMemberPhotoDto {
  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsString()
  photoFileId!: string | null;
}

export class UpdateMemberNationalIdDto {
  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsString()
  nationalIdFileId!: string | null;
}
