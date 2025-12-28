// src/modules/violations/dto/violations.dto.ts
import { IsUUID, IsNotEmpty, IsString, IsNumber, Min, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ViolationStatus } from '@prisma/client';

export class CreateViolationDto {
  @ApiProperty({ example: 'd290f1ee-6c54-4b01-90e6-d701748f0851', description: 'The unit associated with the violation.' })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({ example: 'a01a01a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', description: 'The resident committing the violation (optional).', required: false })
  @IsUUID()
  @IsOptional()
  residentId?: string;

  @ApiProperty({ example: 'Noise Complaint', description: 'Category of the violation.' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'Excessive noise after 10 PM on balcony.', description: 'Details of the incident.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 500.00, description: 'The fine amount in currency units.' })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  fineAmount: number;

  @ApiProperty({ example: '2025-12-10T00:00:00.000Z', description: 'Date the fine must be paid by (Admin specified).' })
  @IsDateString()
  @IsNotEmpty()
  dueDate: Date; // <--- FLEXIBILITY: Admin sets this manually

  @ApiProperty({ example: 'ADMIN_UUID', description: 'ID of the staff member issuing this.', required: false })
  @IsString()
  @IsOptional()
  issuedById?: string;
}

export class UpdateViolationDto extends PartialType(CreateViolationDto) {
  @ApiProperty({ enum: ViolationStatus, description: 'Update status (e.g., APPEALED, CANCELLED).' })
  @IsEnum(ViolationStatus)
  @IsOptional()
  status?: ViolationStatus;

  @ApiProperty({ example: 'Under Review', description: 'Notes on the appeal status.', required: false })
  @IsString()
  @IsOptional()
  appealStatus?: string;
}