// src/modules/invoices/dto/unit-fees.dto.ts
import { IsUUID, IsNotEmpty, IsDateString, IsNumber, Min, IsString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateUnitFeeDto {
  @ApiProperty({ example: 'd290f1ee-6c54-4b01-90e6-d701748f0851', description: 'The UUID of the Unit this fee is for.' })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({ example: 'Electricity', description: 'The type of fee (e.g., Water, AC Service, etc.).' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 150.75, description: 'The amount charged for this specific fee.' })
  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ example: '2025-11-01T00:00:00.000Z', description: 'The start month of the billing period.' })
  @IsDateString()
  @IsNotEmpty()
  billingMonth: Date;
}

export class UpdateUnitFeeDto extends PartialType(CreateUnitFeeDto) {}