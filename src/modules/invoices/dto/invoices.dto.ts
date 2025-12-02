// src/modules/invoices/dto/invoices.dto.ts
import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsString,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

export class CreateInvoiceDto {
  @ApiProperty({
    example: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    description: 'The UUID of the unit receiving the bill.',
  })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({
    example: 'a01a01a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4',
    description: 'The UUID of the resident responsible for the bill.',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  residentId?: string;

  @ApiProperty({
    example: 'Monthly Rent',
    description: 'The type of invoice (e.g., Rent, Service Fee, Fine).',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    example: 18000.0,
    description: 'The total amount of the invoice.',
  })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    example: 'INV-00001',
    description:
      'The unique, sequential invoice number (optional for manual create).',
    required: false,
  })
  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @ApiProperty({
    example: '2025-12-01T00:00:00.000Z',
    description: 'The date the invoice is due.',
  })
  @IsDateString()
  @IsNotEmpty()
  dueDate: Date;

  @ApiProperty({
    example: 'vio-12345-67890-abcde',
    description: 'The ID of the Violation that triggered this invoice.',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  violationId?: string;

  @ApiProperty({
    example: InvoiceStatus.PENDING,
    enum: InvoiceStatus,
    description: 'The status of the invoice.',
    required: false,
  })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  @ApiProperty({
    example: '2025-11-20T10:30:00.000Z',
    description: 'The date the invoice was paid.',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  paidDate?: Date;
}

// DTO for the payment action (often used to capture payment details)
export class MarkAsPaidDto {
  @ApiProperty({ example: 'Bank Transfer', required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiProperty({ example: 'TRX123456', required: false })
  @IsString()
  @IsOptional()
  transactionRef?: string;
}
