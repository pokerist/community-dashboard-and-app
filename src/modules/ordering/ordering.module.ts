import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { OrderService } from './order.service';
import { OrdersController } from './orders.controller';
import { RestaurantService } from './restaurant.service';
import { RestaurantsController } from './restaurants.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RestaurantsController, OrdersController],
  providers: [RestaurantService, OrderService],
  exports: [RestaurantService, OrderService],
})
export class OrderingModule {}

