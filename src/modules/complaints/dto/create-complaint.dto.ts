import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateComplaintDto {
  @ApiProperty({ description: 'Unit ID', format: 'uuid' })
  @IsUUID()
  unitId!: string;

  @ApiPropertyOptional({ description: 'Complaint category ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Short complaint title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Complaint description' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
