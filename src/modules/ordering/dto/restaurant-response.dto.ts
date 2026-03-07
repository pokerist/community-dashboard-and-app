export class RestaurantListItemDto {
  id!: string;
  name!: string;
  description!: string | null;
  category!: string | null;
  logoFileId!: string | null;
  isActive!: boolean;
  displayOrder!: number;
  menuItemCount!: number;
  todayOrderCount!: number;
  totalRevenue!: number;
  createdAt!: string;
  updatedAt!: string;
}

export class RestaurantMenuItemDto {
  id!: string;
  restaurantId!: string;
  name!: string;
  description!: string | null;
  price!: number;
  photoFileId!: string | null;
  category!: string | null;
  isAvailable!: boolean;
  displayOrder!: number;
  createdAt!: string;
  updatedAt!: string;
}

export class RestaurantMenuGroupDto {
  category!: string;
  items!: RestaurantMenuItemDto[];
}

export class RestaurantDetailStatsDto {
  totalOrders!: number;
  pendingOrders!: number;
  revenueThisMonth!: number;
}

export class RestaurantDetailDto {
  id!: string;
  name!: string;
  description!: string | null;
  category!: string | null;
  logoFileId!: string | null;
  isActive!: boolean;
  displayOrder!: number;
  createdAt!: string;
  updatedAt!: string;
  menu!: RestaurantMenuGroupDto[];
  orderStats!: RestaurantDetailStatsDto;
}

