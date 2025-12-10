// src/service-request/dto/update-service-request-internal.dto.ts

import { IsUUID, IsOptional, IsString } from 'class-validator';

// Define the fields that the Staff/Admin are allowed to update
export class UpdateServiceRequestInternalDto {
  @IsString()
  @IsOptional()
  status?: string; // e.g., "NEW", "IN_PROGRESS", "RESOLVED"

  @IsUUID('4', { message: 'Assigned To ID must be a valid UUID.' })
  @IsOptional()
  assignedToId?: string; // ID of the manager/operator handling the request

}
