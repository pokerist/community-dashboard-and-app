import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeaseStatus } from '@prisma/client';

export class CreateLeaseDto {
  @ApiProperty({ example: 'unit-uuid-here', description: 'The ID of the Unit' })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({
    example: 'user-owner-uuid',
    description: 'The ID of the Owner',
  })
  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  endDate: Date;

  @ApiProperty({ example: 5000.0 })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  monthlyRent: number;

  @ApiPropertyOptional({ example: 2500.0 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  securityDeposit?: number;

  @ApiPropertyOptional({
    example: 'file-uuid-here',
    description: 'The ID of the uploaded contract file (if not uploading a file)',
  })
  @IsUUID()
  @IsOptional()
  contractFileId?: string;

  // Tenant information for complete lease creation
  @ApiProperty({
    example: 'tenant@example.com',
    description: 'The email of the tenant',
  })
  @IsEmail()
  @IsNotEmpty()
  tenantEmail: string;

  @ApiPropertyOptional({
    example: '123456789',
    description:
      'The national ID of the tenant (required when creating a new tenant; optional when reusing an existing tenant by email)',
  })
  @IsString()
  @IsOptional()
  tenantNationalId?: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description:
      'The name of the tenant (required when creating a new tenant; optional when reusing an existing tenant by email)',
  })
  @IsString()
  @IsOptional()
  tenantName?: string;

  @ApiPropertyOptional({
    example: '+201234567890',
    description:
      'The phone number of the tenant (required when creating a new tenant; optional when reusing an existing tenant by email)',
  })
  @IsString()
  @IsOptional()
  tenantPhone?: string;

  @ApiPropertyOptional({
    example: 'file-uuid-here',
    description: 'The ID of the uploaded national ID photo (if not uploading a file)',
  })
  @IsUUID()
  @IsOptional()
  nationalIdFileId?: string;
}

export class UpdateLeaseDto {
  @ApiPropertyOptional({ example: 'user-tenant-uuid' })
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ example: '2024-02-01T00:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  monthlyRent?: number;

  @ApiPropertyOptional({ enum: LeaseStatus, example: 'TERMINATED' })
  @IsEnum(LeaseStatus)
  @IsOptional()
  status?: LeaseStatus;
}
