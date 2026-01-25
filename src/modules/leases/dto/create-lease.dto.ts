import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; // Import this
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { LeaseStatus } from '@prisma/client';

export class CreateLeaseDto {
  @ApiProperty({ example: 'unit-uuid-here', description: 'The ID of the Unit' })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({ example: 'user-owner-uuid', description: 'The ID of the Owner' })
  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

  @ApiPropertyOptional({ example: 'user-tenant-uuid' })
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsString()
  @IsOptional()
  tenantNationalId?: string;

  @ApiPropertyOptional({ example: 'tenant@example.com' })
  @IsString()
  @IsOptional()
  tenantEmail?: string;

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

  @ApiProperty({ example: 5000.00 })
  @IsNumber()
  @IsNotEmpty()
  monthlyRent: number;

  @ApiPropertyOptional({ example: 2500.00 })
  @IsNumber()
  @IsOptional()
  securityDeposit?: number;

  @ApiProperty({ example: 'file-uuid-here', description: 'The ID of the uploaded contract file' })
  @IsUUID()
  @IsNotEmpty()
  contractFileId: string;
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
