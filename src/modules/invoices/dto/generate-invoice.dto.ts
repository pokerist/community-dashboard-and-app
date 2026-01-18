// src/modules/invoices/dto/generate-invoice.dto.ts
import { IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateUtilityInvoicesDto {
  @ApiProperty({
    example: '2025-11-01T00:00:00.000Z',
    description:
      'The first day of the month for which fees should be invoiced (e.g., use the 1st of the month).',
  })
  @IsDateString()
  @IsNotEmpty()
  billingMonth: string;
}
