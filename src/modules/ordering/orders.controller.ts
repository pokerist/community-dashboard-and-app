import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ListOrdersDto } from './dto/list-orders.dto';
import { CancelOrderDto, UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderService } from './order.service';

type AuthRequest = {
  user: {
    id: string;
  };
};

@ApiTags('Ordering - Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly orderService: OrderService) {}

  @Get('stats')
  getOrderStats() {
    return this.orderService.getOrderStats();
  }

  @Get()
  listOrders(@Query() query: ListOrdersDto) {
    return this.orderService.listOrders(query);
  }

  @Get(':id')
  getOrderDetail(@Param('id') id: string) {
    return this.orderService.getOrderDetail(id);
  }

  @Patch(':id/status')
  updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateOrderStatus(id, dto);
  }

  @Post(':id/cancel')
  cancelOrder(@Param('id') id: string, @Body() dto: CancelOrderDto, @Request() req: AuthRequest) {
    return this.orderService.cancelOrder(id, dto.cancelReason, req.user.id);
  }
}

