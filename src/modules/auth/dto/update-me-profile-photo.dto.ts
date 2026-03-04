import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateMeProfilePhotoDto {
  @ApiProperty({ example: '0c6f2ce0-2f9c-4b86-a7c7-6d263de52f30' })
  @IsUUID('4', { message: 'profilePhotoId must be a valid UUID.' })
  @IsNotEmpty()
  profilePhotoId!: string;
}
