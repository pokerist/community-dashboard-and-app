import { OrderStatus } from '@prisma/client';

export class OrderStatsByRestaurantDto {
  restaurantId!: string;
  name!: string;
  count!: number;
  revenue!: number;
}

export class OrderStatsDto {
  totalOrders!: number;
  pendingOrders!: number;
  activeOrders!: number;
  deliveredToday!: number;
  cancelledToday!: number;
  revenueToday!: number;
  revenueThisMonth!: number;
  byStatus!: Record<OrderStatus, number>;
  byRestaurant!: OrderStatsByRestaurantDto[];
}

export class OrderListItemDto {
  id!: string;
  orderNumber!: string;
  restaurantName!: string;
  userName!: string;
  unitNumber!: string | null;
  itemCount!: number;
  totalAmount!: number;
  status!: OrderStatus;
  createdAt!: string;
}

export class OrderListResponseDto {
  data!: OrderListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

export class OrderDetailItemDto {
  id!: string;
  menuItemId!: string;
  menuItemName!: string;
  quantity!: number;
  unitPrice!: number;
  subtotal!: number;
  notes!: string | null;
}

export class OrderDetailDto {
  id!: string;
  orderNumber!: string;
  status!: OrderStatus;
  totalAmount!: number;
  notes!: string | null;
  confirmedAt!: string | null;
  preparedAt!: string | null;
  deliveredAt!: string | null;
  cancelledAt!: string | null;
  cancelReason!: string | null;
  createdAt!: string;
  updatedAt!: string;
  restaurant!: {
    id: string;
    name: string;
    category: string | null;
  };
  user!: {
    id: string;
    name: string;
    phone: string | null;
  };
  unit!: {
    id: string;
    unitNumber: string;
    block: string | null;
  } | null;
  items!: OrderDetailItemDto[];
}

export class CreateOrderItemDto {
  menuItemId!: string;
  quantity!: number;
  notes?: string;
}

export class CreateOrderInputDto {
  userId!: string;
  restaurantId!: string;
  unitId?: string;
  notes?: string;
  items!: CreateOrderItemDto[];
}

