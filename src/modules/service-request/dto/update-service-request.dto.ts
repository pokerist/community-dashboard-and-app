// src/service-request/dto/update-service-request.dto.ts

import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceRequestDto } from './create-service-request.dto';
import { IsUUID, IsOptional, IsString } from 'class-validator';

// Use a simple string for status for now, as it's not an enum in the schema
// But for robustness, consider creating a ServiceRequestStatus enum later.
export class UpdateServiceRequestDto extends PartialType(
  CreateServiceRequestDto,
) {
  @IsString()
  @IsOptional()
  status?: string; // e.g., "NEW", "IN_PROGRESS", "RESOLVED"

  @IsUUID('4', { message: 'Assigned To ID must be a valid UUID.' })
  @IsOptional()
  assignedToId?: string; // ID of the manager/operator handling the request
}
