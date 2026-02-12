import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsArray,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
// Using your final, correct Enum names
import { ComplaintStatus, Priority } from '@prisma/client';

export class CreateComplaintDto {
  @ApiProperty({
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    description:
      'The UUID of the user submitting the complaint. In production this is derived from the JWT; clients should omit it.',
  })
  @IsUUID()
  @IsOptional()
  reporterId?: string;

  @ApiProperty({
    example: 'a01a01a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4',
    description: 'The UUID of the unit the complaint is about (optional).',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ApiProperty({
    example: 'Loud music past 11 PM.',
    description: 'Detailed description of the issue.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: 'Noise',
    description: 'The category of the complaint.',
  })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({
    example: Priority.MEDIUM,
    enum: Priority, // Consistent Priority enum
    description: 'The urgency of the complaint.',
    required: false,
  })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiProperty({
    example: ['file-uuid-1', 'file-uuid-2'],
    description: 'Array of uploaded file IDs for complaint attachments.',
    required: false,
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  attachmentIds?: string[];
}

export class UpdateComplaintDto extends PartialType(CreateComplaintDto) {
  @ApiProperty({
    example: ComplaintStatus.IN_PROGRESS,
    enum: ComplaintStatus, // Consistent ComplaintStatus enum
    description: 'The current status of the complaint.',
    required: false,
  })
  @IsEnum(ComplaintStatus)
  @IsOptional()
  status?: ComplaintStatus;

  @ApiProperty({
    example: 'f3f3f3f3-g4g4-h5h5-i6i6-j7j7j7j7j7j7',
    description: 'The staff member UUID assigned to resolve the complaint.',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiProperty({
    example: 'Contacted resident and issued a verbal warning.',
    description: 'Notes on the resolution steps taken.',
    required: false,
  })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;
}
