import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; // Import this
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
  @IsNumber()
  @IsNotEmpty()
  monthlyRent: number;

  @ApiPropertyOptional({ example: 2500.0 })
  @IsNumber()
  @IsOptional()
  securityDeposit?: number;

  @ApiProperty({
    example: 'file-uuid-here',
    description: 'The ID of the uploaded contract file',
  })
  @IsUUID()
  @IsNotEmpty()
  contractFileId: string;

  // Tenant information for complete lease creation
  @ApiProperty({
    example: 'tenant@example.com',
    description: 'The email of the tenant',
  })
  @IsEmail()
  @IsNotEmpty()
  tenantEmail: string;

  @ApiProperty({
    example: '123456789',
    description: 'The national ID of the tenant',
  })
  @IsString()
  @IsNotEmpty()
  tenantNationalId: string;

  @ApiProperty({ example: 'John Doe', description: 'The name of the tenant' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiProperty({
    example: '+201234567890',
    description: 'The phone number of the tenant',
  })
  @IsString()
  @IsNotEmpty()
  tenantPhone: string;

  @ApiProperty({
    example: 'file-uuid-here',
    description: 'The ID of the uploaded national ID photo',
  })
  @IsUUID()
  @IsNotEmpty()
  nationalIdPhotoId: string;
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
  @IsNumber()
  @IsOptional()
  monthlyRent?: number;

  @ApiPropertyOptional({ enum: LeaseStatus, example: 'TERMINATED' })
  @IsEnum(LeaseStatus)
  @IsOptional()
  status?: LeaseStatus;
}
