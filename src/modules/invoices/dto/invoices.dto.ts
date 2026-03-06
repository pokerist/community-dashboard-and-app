import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' })
  @IsUUID('4')
  unitId!: string;

  @ApiPropertyOptional({ example: 'a01a01a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4' })
  @IsOptional()
  @IsUUID('4')
  residentId?: string;

  @ApiProperty({ enum: InvoiceType, example: InvoiceType.RENT })
  @IsEnum(InvoiceType)
  type!: InvoiceType;

  @ApiProperty({ example: 18000.0 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ example: 'Manual adjustment for April period.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkAsPaidDto {
  @ApiPropertyOptional({ example: '2026-03-06T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paidDate?: string;
}

export class CancelInvoiceDto {
  @ApiProperty({ example: 'Invoice issued by mistake.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class SimulateInvoicePaymentDto {
  @ApiProperty({ example: 'Card', description: 'Demo payment method label' })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: string;

  @ApiPropertyOptional({ example: '4242' })
  @IsString()
  @IsOptional()
  cardLast4?: string;

  @ApiPropertyOptional({ example: 'SIM-TRX-123456' })
  @IsString()
  @IsOptional()
  transactionRef?: string;

  @ApiPropertyOptional({ example: 'Paid via demo simulation screen' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class BulkOverdueResultDto {
  @ApiProperty({ example: 12 })
  @IsNumber()
  updatedCount!: number;
}

export class ToggleInvoiceCategoryActiveDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}
