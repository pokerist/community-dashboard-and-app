import { OrderStatus } from '@prisma/client';
import apiClient from './api-client';

export type RestaurantListItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  logoFileId: string | null;
  isActive: boolean;
  displayOrder: number;
  menuItemCount: number;
  todayOrderCount: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
};

export type RestaurantMenuItem = {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  price: number;
  photoFileId: string | null;
  category: string | null;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RestaurantDetail = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  logoFileId: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  menu: Array<{
    category: string;
    items: RestaurantMenuItem[];
  }>;
  orderStats: {
    totalOrders: number;
    pendingOrders: number;
    revenueThisMonth: number;
  };
};

export type OrderStats = {
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  deliveredToday: number;
  cancelledToday: number;
  revenueToday: number;
  revenueThisMonth: number;
  byStatus: Record<OrderStatus, number>;
  byRestaurant: Array<{
    restaurantId: string;
    name: string;
    count: number;
    revenue: number;
  }>;
};

export type OrderListItem = {
  id: string;
  orderNumber: string;
  restaurantName: string;
  userName: string;
  unitNumber: string | null;
  itemCount: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  notes: string | null;
  confirmedAt: string | null;
  preparedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  restaurant: {
    id: string;
    name: string;
    category: string | null;
  };
  user: {
    id: string;
    name: string;
    phone: string | null;
  };
  unit: {
    id: string;
    unitNumber: string;
    block: string | null;
  } | null;
  items: Array<{
    id: string;
    menuItemId: string;
    menuItemName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes: string | null;
  }>;
};

export type OrderListResponse = {
  data: OrderListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ListOrderFilters = {
  restaurantId?: string;
  status?: OrderStatus;
  unitId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
};

const orderingService = {
  async listRestaurants(params: {
    includeInactive?: boolean;
    search?: string;
    category?: string;
    status?: 'ACTIVE' | 'INACTIVE' | 'ALL';
  } = {}): Promise<RestaurantListItem[]> {
    const response = await apiClient.get<RestaurantListItem[]>('/restaurants', { params });
    return response.data;
  },

  async getRestaurantDetail(id: string): Promise<RestaurantDetail> {
    const response = await apiClient.get<RestaurantDetail>(`/restaurants/${id}`);
    return response.data;
  },

  async createRestaurant(payload: {
    name: string;
    description?: string;
    category?: string;
    logoFileId?: string;
  }): Promise<RestaurantDetail> {
    const response = await apiClient.post<RestaurantDetail>('/restaurants', payload);
    return response.data;
  },

  async updateRestaurant(
    id: string,
    payload: {
      name?: string;
      description?: string;
      category?: string;
      logoFileId?: string;
      displayOrder?: number;
      isActive?: boolean;
    },
  ): Promise<RestaurantDetail> {
    const response = await apiClient.patch<RestaurantDetail>(`/restaurants/${id}`, payload);
    return response.data;
  },

  async toggleRestaurant(id: string): Promise<RestaurantDetail> {
    const response = await apiClient.patch<RestaurantDetail>(`/restaurants/${id}/toggle`);
    return response.data;
  },

  async deleteRestaurant(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/restaurants/${id}`);
    return response.data;
  },

  async addMenuItem(
    restaurantId: string,
    payload: {
      name: string;
      description?: string;
      price: number;
      photoFileId?: string;
      category?: string;
      displayOrder?: number;
    },
  ): Promise<RestaurantMenuItem> {
    const response = await apiClient.post<RestaurantMenuItem>(
      `/restaurants/${restaurantId}/menu`,
      payload,
    );
    return response.data;
  },

  async updateMenuItem(
    id: string,
    payload: {
      name?: string;
      description?: string;
      price?: number;
      photoFileId?: string;
      category?: string;
      displayOrder?: number;
      isAvailable?: boolean;
    },
  ): Promise<RestaurantMenuItem> {
    const response = await apiClient.patch<RestaurantMenuItem>(`/menu-items/${id}`, payload);
    return response.data;
  },

  async toggleMenuItem(id: string): Promise<RestaurantMenuItem> {
    const response = await apiClient.patch<RestaurantMenuItem>(`/menu-items/${id}/toggle`);
    return response.data;
  },

  async deleteMenuItem(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/menu-items/${id}`);
    return response.data;
  },

  async reorderMenuItems(
    restaurantId: string,
    payload: { category?: string; orderedIds: string[] },
  ): Promise<RestaurantMenuItem[]> {
    const response = await apiClient.patch<RestaurantMenuItem[]>(
      `/restaurants/${restaurantId}/menu/reorder`,
      payload,
    );
    return response.data;
  },

  async getOrderStats(): Promise<OrderStats> {
    const response = await apiClient.get<OrderStats>('/orders/stats');
    return response.data;
  },

  async listOrders(filters: ListOrderFilters = {}): Promise<OrderListResponse> {
    const response = await apiClient.get<OrderListResponse>('/orders', { params: filters });
    return response.data;
  },

  async getOrderDetail(id: string): Promise<OrderDetail> {
    const response = await apiClient.get<OrderDetail>(`/orders/${id}`);
    return response.data;
  },

  async updateOrderStatus(
    id: string,
    payload: { status: OrderStatus; cancelReason?: string },
  ): Promise<OrderDetail> {
    const response = await apiClient.patch<OrderDetail>(`/orders/${id}/status`, payload);
    return response.data;
  },

  async cancelOrder(id: string, cancelReason: string): Promise<OrderDetail> {
    const response = await apiClient.post<OrderDetail>(`/orders/${id}/cancel`, {
      cancelReason,
    });
    return response.data;
  },
};

export default orderingService;

