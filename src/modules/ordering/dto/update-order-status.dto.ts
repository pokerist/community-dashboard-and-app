import { IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ValidateIf((value: UpdateOrderStatusDto) => value.status === OrderStatus.CANCELLED)
  @IsString()
  cancelReason?: string;
}

export class CancelOrderDto {
  @IsString()
  cancelReason!: string;
}

