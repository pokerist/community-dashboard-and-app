import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateRestaurantDto, UpdateRestaurantDto } from './dto/create-restaurant.dto';
import { ListRestaurantsDto } from './dto/list-restaurants.dto';
import { ReorderMenuItemsDto } from './dto/reorder-menu-items.dto';
import {
  RestaurantDetailDto,
  RestaurantDetailStatsDto,
  RestaurantListItemDto,
  RestaurantMenuGroupDto,
  RestaurantMenuItemDto,
} from './dto/restaurant-response.dto';

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

  private toNumber(value: Prisma.Decimal | number | null): number {
    if (value === null) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    return value.toNumber();
  }

  private normalizeCategory(category?: string): string | null | undefined {
    if (category === undefined) {
      return undefined;
    }
    const trimmed = category.trim();
    if (!trimmed || trimmed.toLowerCase() === 'uncategorized') {
      return null;
    }
    return trimmed;
  }

  private mapMenuItem(row: {
    id: string;
    restaurantId: string;
    name: string;
    description: string | null;
    price: Prisma.Decimal;
    photoFileId: string | null;
    category: string | null;
    isAvailable: boolean;
    displayOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): RestaurantMenuItemDto {
    return {
      id: row.id,
      restaurantId: row.restaurantId,
      name: row.name,
      description: row.description,
      price: this.toNumber(row.price),
      photoFileId: row.photoFileId,
      category: row.category,
      isAvailable: row.isAvailable,
      displayOrder: row.displayOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async ensureRestaurantExists(restaurantId: string): Promise<void> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
  }

  async listRestaurants(filters: ListRestaurantsDto): Promise<RestaurantListItemDto[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const where: Prisma.RestaurantWhereInput = {};
    const includeInactive = filters.includeInactive ?? false;
    if (!includeInactive) {
      where.isActive = true;
    }
    if (filters.status === 'ACTIVE') {
      where.isActive = true;
    } else if (filters.status === 'INACTIVE') {
      where.isActive = false;
    }
    if (filters.search?.trim()) {
      where.name = {
        contains: filters.search.trim(),
        mode: Prisma.QueryMode.insensitive,
      };
    }
    if (filters.category?.trim()) {
      where.category = {
        equals: filters.category.trim(),
        mode: Prisma.QueryMode.insensitive,
      };
    }

    const restaurants = await this.prisma.restaurant.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        logoFileId: true,
        isActive: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            menuItems: true,
            orders: {
              where: {
                createdAt: { gte: todayStart },
              },
            },
          },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    const revenueRows = await this.prisma.order.groupBy({
      by: ['restaurantId'],
      where: {
        restaurantId: { in: restaurants.map((restaurant) => restaurant.id) },
        status: OrderStatus.DELIVERED,
      },
      _sum: {
        totalAmount: true,
      },
    });
    const revenueByRestaurant = new Map(
      revenueRows.map((row) => [row.restaurantId, this.toNumber(row._sum.totalAmount)]),
    );

    return restaurants.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      logoFileId: row.logoFileId,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      menuItemCount: row._count.menuItems,
      todayOrderCount: row._count.orders,
      totalRevenue: revenueByRestaurant.get(row.id) ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async getRestaurantDetail(id: string): Promise<RestaurantDetailDto> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        menuItems: {
          orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, monthRevenue] = await Promise.all([
      this.prisma.order.count({
        where: {
          restaurantId: id,
        },
      }),
      this.prisma.order.count({
        where: {
          restaurantId: id,
          status: OrderStatus.PENDING,
        },
      }),
      this.prisma.order.aggregate({
        where: {
          restaurantId: id,
          status: OrderStatus.DELIVERED,
          deliveredAt: { gte: monthStart },
        },
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const stats: RestaurantDetailStatsDto = {
      totalOrders,
      pendingOrders,
      revenueThisMonth: this.toNumber(monthRevenue._sum.totalAmount),
    };

    const grouped = restaurant.menuItems.reduce<Map<string, RestaurantMenuItemDto[]>>(
      (acc, item) => {
        const category = item.category ?? 'Uncategorized';
        const list = acc.get(category) ?? [];
        list.push(this.mapMenuItem(item));
        acc.set(category, list);
        return acc;
      },
      new Map<string, RestaurantMenuItemDto[]>(),
    );

    const menu: RestaurantMenuGroupDto[] = [...grouped.entries()].map(([category, items]) => ({
      category,
      items,
    }));

    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      category: restaurant.category,
      logoFileId: restaurant.logoFileId,
      isActive: restaurant.isActive,
      displayOrder: restaurant.displayOrder,
      createdAt: restaurant.createdAt.toISOString(),
      updatedAt: restaurant.updatedAt.toISOString(),
      menu,
      orderStats: stats,
    };
  }

  async createRestaurant(dto: CreateRestaurantDto): Promise<RestaurantDetailDto> {
    const created = await this.prisma.restaurant.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || null,
        logoFileId: dto.logoFileId ?? null,
      },
      select: { id: true },
    });
    return this.getRestaurantDetail(created.id);
  }

  async updateRestaurant(id: string, dto: UpdateRestaurantDto): Promise<RestaurantDetailDto> {
    await this.ensureRestaurantExists(id);

    await this.prisma.restaurant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() || null } : {}),
        ...(dto.logoFileId !== undefined ? { logoFileId: dto.logoFileId || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    return this.getRestaurantDetail(id);
  }

  async toggleRestaurant(id: string): Promise<RestaurantDetailDto> {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    await this.prisma.restaurant.update({
      where: { id },
      data: { isActive: !restaurant.isActive },
    });

    return this.getRestaurantDetail(id);
  }

  async deleteRestaurant(id: string): Promise<{ success: true }> {
    await this.ensureRestaurantExists(id);

    const activeOrders = await this.prisma.order.count({
      where: {
        restaurantId: id,
        status: {
          in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING],
        },
      },
    });
    if (activeOrders > 0) {
      throw new BadRequestException('Cannot delete restaurant with active orders');
    }

    await this.prisma.restaurant.delete({ where: { id } });
    return { success: true };
  }

  async addMenuItem(restaurantId: string, dto: CreateMenuItemDto): Promise<RestaurantMenuItemDto> {
    await this.ensureRestaurantExists(restaurantId);

    const created = await this.prisma.menuItem.create({
      data: {
        restaurantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: new Prisma.Decimal(dto.price.toFixed(2)),
        photoFileId: dto.photoFileId ?? null,
        category: dto.category?.trim() || null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    return this.mapMenuItem(created);
  }

  async updateMenuItem(id: string, dto: UpdateMenuItemDto): Promise<RestaurantMenuItemDto> {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price.toFixed(2)) } : {}),
        ...(dto.photoFileId !== undefined ? { photoFileId: dto.photoFileId || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
      },
    });

    return this.mapMenuItem(updated);
  }

  async toggleMenuItem(id: string): Promise<RestaurantMenuItemDto> {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
      select: {
        id: true,
        isAvailable: true,
      },
    });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !menuItem.isAvailable },
    });
    return this.mapMenuItem(updated);
  }

  async deleteMenuItem(id: string): Promise<{ success: true }> {
    const menuItem = await this.prisma.menuItem.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!menuItem) {
      throw new NotFoundException('Menu item not found');
    }

    await this.prisma.menuItem.delete({ where: { id } });
    return { success: true };
  }

  async reorderMenuItems(
    restaurantId: string,
    dto: ReorderMenuItemsDto,
  ): Promise<RestaurantMenuItemDto[]> {
    await this.ensureRestaurantExists(restaurantId);
    if (!dto.orderedIds.length) {
      throw new BadRequestException('orderedIds is required');
    }

    const category = this.normalizeCategory(dto.category);
    const items = await this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        ...(category === undefined ? {} : { category }),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const existingIds = new Set(items.map((item) => item.id));
    for (const orderedId of dto.orderedIds) {
      if (!existingIds.has(orderedId)) {
        throw new BadRequestException(`Menu item ${orderedId} is not in selected category`);
      }
    }

    const orderedSet = new Set(dto.orderedIds);
    const ordered = [
      ...dto.orderedIds,
      ...items.filter((item) => !orderedSet.has(item.id)).map((item) => item.id),
    ];

    await this.prisma.$transaction(
      ordered.map((id, index) =>
        this.prisma.menuItem.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    const refreshed = await this.prisma.menuItem.findMany({
      where: {
        restaurantId,
        ...(category === undefined ? {} : { category }),
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return refreshed.map((item) => this.mapMenuItem(item));
  }
}
