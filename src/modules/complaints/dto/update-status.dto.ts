import { IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ComplaintStatus } from '@prisma/client';

export class UpdateComplaintStatusDto {
  @ApiProperty({
    example: ComplaintStatus.RESOLVED,
    enum: ComplaintStatus,
    description: 'The new status for the complaint.',
  })
  @IsEnum(ComplaintStatus)
  @IsNotEmpty()
  status!: ComplaintStatus;

  @ApiProperty({
    example: 'Resolution steps documented here.',
    description: 'Required notes if status is RESOLVED or CLOSED.',
    required: false,
  })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
