import { ApiProperty } from '@nestjs/swagger';
import { CommunityStructure } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({ example: 'Al Karma Gates' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ required: false, example: 'AKG' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  code?: string;

  @ApiProperty({ required: false, example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    enum: CommunityStructure,
    example: CommunityStructure.CLUSTERS,
  })
  @IsOptional()
  @IsEnum(CommunityStructure)
  structureType?: CommunityStructure;

  @ApiProperty({ required: false, example: 'No pets allowed in common areas.' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  guidelines?: string;
}
