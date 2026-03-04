import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
}
