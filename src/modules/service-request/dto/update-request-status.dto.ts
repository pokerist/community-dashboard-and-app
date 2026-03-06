import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ServiceRequestStatus } from '@prisma/client';

export class UpdateRequestStatusDto {
  @IsEnum(ServiceRequestStatus)
  status!: ServiceRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

