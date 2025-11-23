// src/modules/invoices/dto/invoices.dto.ts
import { IsUUID, IsNotEmpty, IsDateString, IsNumber, Min, IsOptional, IsEnum, IsString } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @IsUUID()
  @IsNotEmpty()
  unitId: string; // The unit the bill is tied to

  @IsUUID()
  @IsOptional() // Matches your schema residentId: String?
  residentId?: string; 

  @IsString()
  @IsNotEmpty()
  type: string; // e.g., "Monthly Rent", "Service Fee", "Violation Fine"

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number; // The financial amount

  @IsDateString()
  @IsNotEmpty()
  dueDate: Date;

  @IsString()
  @IsOptional() // Will be auto-generated in service, but allowed for manual creation
  invoiceNumber?: string;
  
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {
  @IsDateString()
  @IsOptional()
  paidDate?: Date;
}

// DTO for the payment action payload (can be empty, but good practice to define)
export class MarkAsPaidDto {
  // Can include fields like paymentMethod, transactionRef, paidByUserId, etc.
}