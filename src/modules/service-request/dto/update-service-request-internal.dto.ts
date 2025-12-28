// src/service-request/dto/update-service-request-internal.dto.ts

import { IsUUID, IsOptional, IsEnum } from 'class-validator';
import { ServiceRequestStatus } from '@prisma/client';

// Define the fields that the Staff/Admin are allowed to update
export class UpdateServiceRequestInternalDto {
  @IsEnum(ServiceRequestStatus)
  @IsOptional()
  status?: ServiceRequestStatus; // e.g., "NEW", "IN_PROGRESS", "RESOLVED"

  @IsUUID('4', { message: 'Assigned To ID must be a valid UUID.' })
  @IsOptional()
  assignedToId?: string; // ID of the manager/operator handling the request
}
