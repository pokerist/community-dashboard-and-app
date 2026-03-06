import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsPositive } from 'class-validator';

export class CreateRequestInvoiceDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  dueDate!: string;
}
