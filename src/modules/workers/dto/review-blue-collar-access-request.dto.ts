import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewBlueCollarAccessRequestDto {
  @ApiProperty({ example: true, description: 'true = approve, false = reject' })
  @IsBoolean()
  approve!: boolean;

  @ApiProperty({ required: false, example: 'Missing required ID document', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
