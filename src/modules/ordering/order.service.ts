import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import {
  CreateOrderInputDto,
  OrderDetailDto,
  OrderListItemDto,
  OrderListResponseDto,
  OrderStatsDto,
} from './dto/order-response.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus | null> = {
  [OrderStatus.PENDING]: OrderStatus.CONFIRMED,
  [OrderStatus.CONFIRMED]: OrderStatus.PREPARING,
  [OrderStatus.PREPARING]: OrderStatus.DELIVERED,
  [OrderStatus.DELIVERED]: null,
  [OrderStatus.CANCELLED]: null,
};

type OrderDetailRow = Prisma.OrderGetPayload<{
  include: {
    restaurant: {
      select: {
        id: true;
        name: true;
        category: true;
      };
    };
    user: {
      select: {
        id: true;
        nameEN: true;
        nameAR: true;
        phone: true;
        email: true;
      };
    };
    unit: {
      select: {
        id: true;
        unitNumber: true;
        block: true;
      };
    };
    items: {
      include: {
        menuItem: {
          select: {
            id: true;
            name: true;
          };
        };
      };
      orderBy: {
        id: 'asc';
      };
    };
  };
}>;

@Injectable()
export class OrderService {
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

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private resolveUserName(user: {
    id: string;
    nameEN: string | null;
    nameAR: string | null;
    email: string | null;
  }): string {
    return user.nameEN || user.nameAR || user.email || user.id;
  }

  private mapOrderDetail(row: OrderDetailRow): OrderDetailDto {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      totalAmount: this.toNumber(row.totalAmount),
      notes: row.notes,
      confirmedAt: this.toIso(row.confirmedAt),
      preparedAt: this.toIso(row.preparedAt),
      deliveredAt: this.toIso(row.deliveredAt),
      cancelledAt: this.toIso(row.cancelledAt),
      cancelReason: row.cancelReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      restaurant: {
        id: row.restaurant.id,
        name: row.restaurant.name,
        category: row.restaurant.category,
      },
      user: {
        id: row.user.id,
        name: this.resolveUserName(row.user),
        phone: row.user.phone,
      },
      unit: row.unit
        ? {
            id: row.unit.id,
            unitNumber: row.unit.unitNumber,
            block: row.unit.block,
          }
        : null,
      items: row.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
        quantity: item.quantity,
        unitPrice: this.toNumber(item.unitPrice),
        subtotal: this.toNumber(item.subtotal),
        notes: item.notes,
      })),
    };
  }

  private async getOrderRowOrThrow(orderId: string): Promise<OrderDetailRow> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        user: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            phone: true,
            email: true,
          },
        },
        unit: {
          select: {
            id: true,
            unitNumber: true,
            block: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            id: 'asc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    await tx.orderSequence.upsert({
      where: { name: 'ORDER' },
      create: { name: 'ORDER', counter: BigInt(0) },
      update: {},
    });

    const updated = await tx.orderSequence.update({
      where: { name: 'ORDER' },
      data: {
        counter: {
          increment: BigInt(1),
        },
      },
      select: {
        counter: true,
      },
    });

    return `ORD-${updated.counter.toString().padStart(6, '0')}`;
  }

  private buildListWhere(filters: ListOrdersDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (filters.restaurantId) {
      where.restaurantId = filters.restaurantId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.unitId) {
      where.unitId = filters.unitId;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) {
        dateFilter.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        {
          orderNumber: {
            contains: term,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          user: {
            OR: [
              {
                nameEN: {
                  contains: term,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                nameAR: {
                  contains: term,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                email: {
                  contains: term,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
        },
      ];
    }

    return where;
  }

  async getOrderStats(): Promise<OrderStatsDto> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, activeOrders, deliveredToday, cancelledToday, revenueTodayRow, revenueMonthRow, byStatusRaw, byRestaurantRaw] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.count({
          where: { status: OrderStatus.PENDING },
        }),
        this.prisma.order.count({
          where: {
            status: {
              in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
            },
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.DELIVERED,
            deliveredAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
        }),
        this.prisma.order.count({
          where: {
            status: OrderStatus.CANCELLED,
            cancelledAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
        }),
        this.prisma.order.aggregate({
          where: {
            status: OrderStatus.DELIVERED,
            deliveredAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.aggregate({
          where: {
            status: OrderStatus.DELIVERED,
            deliveredAt: {
              gte: monthStart,
            },
          },
          _sum: { totalAmount: true },
        }),
        this.prisma.order.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.order.groupBy({
          by: ['restaurantId'],
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
      ]);

    const byStatus = Object.values(OrderStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<OrderStatus, number>,
    );
    for (const row of byStatusRaw) {
      byStatus[row.status] = row._count._all;
    }

    const restaurantIds = byRestaurantRaw.map((row) => row.restaurantId);
    const restaurants = await this.prisma.restaurant.findMany({
      where: { id: { in: restaurantIds } },
      select: {
        id: true,
        name: true,
      },
    });
    const restaurantNameById = new Map(restaurants.map((row) => [row.id, row.name]));

    return {
      totalOrders,
      pendingOrders,
      activeOrders,
      deliveredToday,
      cancelledToday,
      revenueToday: this.toNumber(revenueTodayRow._sum.totalAmount),
      revenueThisMonth: this.toNumber(revenueMonthRow._sum.totalAmount),
      byStatus,
      byRestaurant: byRestaurantRaw.map((row) => ({
        restaurantId: row.restaurantId,
        name: restaurantNameById.get(row.restaurantId) ?? row.restaurantId,
        count: row._count._all,
        revenue: this.toNumber(row._sum.totalAmount),
      })),
    };
  }

  async listOrders(filters: ListOrdersDto): Promise<OrderListResponseDto> {
    const safePage = Number.isFinite(filters.page) && Number(filters.page) > 0 ? Number(filters.page) : 1;
    const limit = 25;

    const where = this.buildListWhere(filters);
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          restaurant: {
            select: {
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              nameEN: true,
              nameAR: true,
              email: true,
            },
          },
          unit: {
            select: {
              unitNumber: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (safePage - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    const data: OrderListItemDto[] = rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      restaurantName: row.restaurant.name,
      userName: row.user.nameEN || row.user.nameAR || row.user.email || row.user.id,
      unitNumber: row.unit?.unitNumber ?? null,
      itemCount: row._count.items,
      totalAmount: this.toNumber(row.totalAmount),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));

    return {
      data,
      total,
      page: safePage,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getOrderDetail(orderId: string): Promise<OrderDetailDto> {
    const order = await this.getOrderRowOrThrow(orderId);
    return this.mapOrderDetail(order);
  }

  async updateOrderStatus(orderId: string, dto: UpdateOrderStatusDto): Promise<OrderDetailDto> {
    const current = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('Order not found');
    }

    if (dto.status === OrderStatus.CANCELLED) {
      if (!dto.cancelReason?.trim()) {
        throw new BadRequestException('cancelReason is required when status is CANCELLED');
      }
      return this.cancelOrder(orderId, dto.cancelReason, null);
    }

    const expected = ORDER_STATUS_TRANSITIONS[current.status];
    if (expected !== dto.status) {
      throw new BadRequestException('Invalid status transition');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: dto.status,
        ...(dto.status === OrderStatus.CONFIRMED ? { confirmedAt: new Date() } : {}),
        ...(dto.status === OrderStatus.PREPARING ? { preparedAt: new Date() } : {}),
        ...(dto.status === OrderStatus.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
    });

    return this.getOrderDetail(orderId);
  }

  async cancelOrder(orderId: string, reason: string, adminId: string | null): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, notes: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const cleanedReason = reason.trim();
    if (!cleanedReason) {
      throw new BadRequestException('cancelReason is required');
    }

    const actorNote = adminId ? `Cancelled by ${adminId}` : null;
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: cleanedReason,
        cancelledAt: new Date(),
        ...(actorNote
          ? {
              notes: order.notes
                ? `${order.notes}\n${actorNote}`
                : actorNote,
            }
          : {}),
      },
    });

    return this.getOrderDetail(orderId);
  }

  async createOrder(input: CreateOrderInputDto): Promise<OrderDetailDto> {
    if (!input.items.length) {
      throw new BadRequestException('At least one item is required');
    }

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { id: true, isActive: true },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    if (!restaurant.isActive) {
      throw new BadRequestException('Restaurant is inactive');
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: input.items.map((item) => item.menuItemId) },
        restaurantId: input.restaurantId,
      },
      select: {
        id: true,
        isAvailable: true,
        price: true,
      },
    });
    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));
    if (menuItems.length !== input.items.length) {
      throw new BadRequestException('One or more menu items are invalid');
    }

    const toCreateItems = input.items.map((item) => {
      const menuItem = menuItemById.get(item.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(`Invalid menu item: ${item.menuItemId}`);
      }
      if (!menuItem.isAvailable) {
        throw new BadRequestException(`Menu item unavailable: ${item.menuItemId}`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException('Item quantity must be greater than 0');
      }

      const unitPrice = new Prisma.Decimal(menuItem.price);
      const quantity = new Prisma.Decimal(item.quantity);
      const subtotal = unitPrice.mul(quantity);
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
        notes: item.notes?.trim() || null,
      };
    });

    const totalAmount = toCreateItems.reduce(
      (acc, item) => acc.add(item.subtotal),
      new Prisma.Decimal(0),
    );

    const createdOrderId = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: input.userId,
          unitId: input.unitId ?? null,
          restaurantId: input.restaurantId,
          status: OrderStatus.PENDING,
          notes: input.notes?.trim() || null,
          totalAmount,
          items: {
            create: toCreateItems,
          },
        },
        select: { id: true },
      });
      return created.id;
    });

    return this.getOrderDetail(createdOrderId);
  }
}

