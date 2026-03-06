import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCommercialEntityDto {
  @ApiProperty({ example: 'Starbucks' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ required: false, example: 'Coffee shop tenant' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 'community-uuid' })
  @IsUUID()
  communityId!: string;

  @ApiProperty({ example: 'unit-uuid' })
  @IsUUID()
  unitId!: string;

  @ApiProperty({ example: 'owner-user-uuid' })
  @IsUUID()
  ownerUserId!: string;
}
