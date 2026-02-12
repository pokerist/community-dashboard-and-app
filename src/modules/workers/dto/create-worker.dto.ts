import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWorkerDto {
  @ApiProperty({ example: 'unit-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @ApiProperty({ example: 'contractor-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  contractorId!: string;

  @ApiProperty({ example: 'Ahmed Ali' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: '29801011234567', description: 'National ID number' })
  @IsString()
  @IsNotEmpty()
  nationalId!: string;

  @ApiPropertyOptional({ example: '+201234567890' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    example: 'file-uuid-or-provider-id',
    description:
      'Optional photo reference. Currently stored on AccessProfile.photoId.',
  })
  @IsString()
  @IsOptional()
  photoId?: string;

  @ApiPropertyOptional({ example: 'Electrician' })
  @IsString()
  @IsOptional()
  jobType?: string;
}

