import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Priority } from '@prisma/client';

export class UpdateComplaintDto {
  @ApiProperty({ required: false, format: 'uuid' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false, enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;
}
