import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Prisma } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/modules/auth/guards/permissions.guard';
import { OrderService } from '../../src/modules/ordering/order.service';
import { OrdersController } from '../../src/modules/ordering/orders.controller';
import { RestaurantService } from '../../src/modules/ordering/restaurant.service';
import { RestaurantsController } from '../../src/modules/ordering/restaurants.controller';

type RestaurantState = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  logoFileId: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type MenuItemState = {
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
};

type OrderState = {
  id: string;
  orderNumber: string;
  userId: string;
  unitId: string | null;
  restaurantId: string;
  status: OrderStatus;
  totalAmount: Prisma.Decimal;
  notes: string | null;
  confirmedAt: Date | null;
  preparedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderItemState = {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  notes: string | null;
};

const clone = <T,>(value: T): T => {
  if (value instanceof Prisma.Decimal) {
    return new Prisma.Decimal(value.toString()) as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => clone(entry)) as T;
  }
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = clone(entry);
    }
    return output as T;
  }
  return value;
};

describe('Ordering (e2e)', () => {
  let app: INestApplication;
  let orderService: OrderService;

  let restaurantSeq = 0;
  let menuSeq = 0;
  let orderSeq = 0;
  let orderItemSeq = 0;
  let orderCounter = BigInt(0);

  const restaurants: RestaurantState[] = [];
  const menuItems: MenuItemState[] = [];
  const orders: OrderState[] = [];
  const orderItems: OrderItemState[] = [];

  const nextId = (prefix: string, value: number): string =>
    `${prefix}-${value.toString().padStart(4, '0')}`;

  const users = new Map<string, { id: string; nameEN: string; nameAR: string | null; phone: string | null; email: string }>([
    ['resident-1', { id: 'resident-1', nameEN: 'Resident One', nameAR: null, phone: '01000000001', email: 'resident.one@test.com' }],
    ['admin-1', { id: 'admin-1', nameEN: 'Admin', nameAR: null, phone: null, email: 'admin@test.com' }],
  ]);

  const units = new Map<string, { id: string; unitNumber: string; block: string | null }>([
    ['unit-1', { id: 'unit-1', unitNumber: 'A-101', block: 'A' }],
  ]);

  const applyOrderWhere = (where: Record<string, unknown> | undefined): OrderState[] => {
    if (!where) return orders.slice();
    return orders.filter((row) => {
      if (where.restaurantId && row.restaurantId !== where.restaurantId) return false;
      if (where.userId && row.userId !== where.userId) return false;
      if (where.unitId !== undefined && row.unitId !== where.unitId) return false;
      if (where.status && row.status !== where.status) return false;

      const statusFilter = where.status as { in?: OrderStatus[] } | undefined;
      if (statusFilter?.in && !statusFilter.in.includes(row.status)) return false;

      const createdAtFilter = where.createdAt as { gte?: Date; lte?: Date; lt?: Date } | undefined;
      if (createdAtFilter?.gte && row.createdAt < createdAtFilter.gte) return false;
      if (createdAtFilter?.lte && row.createdAt > createdAtFilter.lte) return false;
      if (createdAtFilter?.lt && row.createdAt >= createdAtFilter.lt) return false;

      const deliveredAtFilter = where.deliveredAt as { gte?: Date; lt?: Date } | undefined;
      if (deliveredAtFilter?.gte && (!row.deliveredAt || row.deliveredAt < deliveredAtFilter.gte))
        return false;
      if (deliveredAtFilter?.lt && (!row.deliveredAt || row.deliveredAt >= deliveredAtFilter.lt))
        return false;

      const cancelledAtFilter = where.cancelledAt as { gte?: Date; lt?: Date } | undefined;
      if (cancelledAtFilter?.gte && (!row.cancelledAt || row.cancelledAt < cancelledAtFilter.gte))
        return false;
      if (cancelledAtFilter?.lt && (!row.cancelledAt || row.cancelledAt >= cancelledAtFilter.lt))
        return false;

      return true;
    });
  };

  const prismaMock = {
    restaurant: {
      findUnique: jest.fn(async ({ where, select, include }: { where: { id: string }; select?: Record<string, boolean>; include?: Record<string, unknown> }) => {
        const row = restaurants.find((restaurant) => restaurant.id === where.id);
        if (!row) return null;
        if (select) {
          const selected: Record<string, unknown> = {};
          for (const key of Object.keys(select)) {
            selected[key] = (row as Record<string, unknown>)[key];
          }
          return selected;
        }
        if (include?.menuItems) {
          return {
            ...clone(row),
            menuItems: menuItems.filter((item) => item.restaurantId === row.id).sort((a, b) => a.displayOrder - b.displayOrder),
          };
        }
        return clone(row);
      }),
      findMany: jest.fn(async ({ where, select }: { where?: Record<string, unknown>; select?: Record<string, unknown> }) => {
        let filtered = restaurants.slice();
        if (where?.id && typeof where.id === 'object' && Array.isArray((where.id as { in?: string[] }).in)) {
          const ids = (where.id as { in: string[] }).in;
          filtered = filtered.filter((restaurant) => ids.includes(restaurant.id));
        }
        if (where?.isActive !== undefined) {
          filtered = filtered.filter((restaurant) => restaurant.isActive === where.isActive);
        }
        if (select?.name) {
          return filtered.map((row) => ({ id: row.id, name: row.name }));
        }
        if (select?._count) {
          return filtered.map((row) => ({
            ...clone(row),
            _count: {
              menuItems: menuItems.filter((item) => item.restaurantId === row.id).length,
              orders: orders.filter((order) => order.restaurantId === row.id).length,
            },
          }));
        }
        return filtered.map((row) => clone(row));
      }),
      create: jest.fn(async ({ data, select }: { data: Record<string, unknown>; select?: { id?: boolean } }) => {
        restaurantSeq += 1;
        const now = new Date();
        const row: RestaurantState = {
          id: nextId('restaurant', restaurantSeq),
          name: String(data.name),
          description: (data.description as string | null | undefined) ?? null,
          category: (data.category as string | null | undefined) ?? null,
          logoFileId: (data.logoFileId as string | null | undefined) ?? null,
          isActive: (data.isActive as boolean | undefined) ?? true,
          displayOrder: (data.displayOrder as number | undefined) ?? 0,
          createdAt: now,
          updatedAt: now,
        };
        restaurants.push(row);
        if (select?.id) return { id: row.id };
        return clone(row);
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = restaurants.find((restaurant) => restaurant.id === where.id);
        if (!row) throw new Error('Restaurant not found');
        if (data.name !== undefined) row.name = String(data.name);
        if (data.description !== undefined) row.description = (data.description as string | null) ?? null;
        if (data.category !== undefined) row.category = (data.category as string | null) ?? null;
        if (data.logoFileId !== undefined) row.logoFileId = (data.logoFileId as string | null) ?? null;
        if (data.isActive !== undefined) row.isActive = Boolean(data.isActive);
        if (data.displayOrder !== undefined) row.displayOrder = Number(data.displayOrder);
        row.updatedAt = new Date();
        return clone(row);
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = restaurants.findIndex((row) => row.id === where.id);
        if (idx < 0) throw new Error('Restaurant not found');
        const [removed] = restaurants.splice(idx, 1);
        return clone(removed);
      }),
    },
    menuItem: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const row = menuItems.find((item) => item.id === where.id);
        return row ? clone(row) : null;
      }),
      findMany: jest.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        let filtered = menuItems.slice();
        if (where?.id && typeof where.id === 'object' && Array.isArray((where.id as { in?: string[] }).in)) {
          const ids = (where.id as { in: string[] }).in;
          filtered = filtered.filter((row) => ids.includes(row.id));
        }
        if (where?.restaurantId) {
          filtered = filtered.filter((row) => row.restaurantId === where.restaurantId);
        }
        if (where?.category !== undefined) {
          filtered = filtered.filter((row) => row.category === where.category);
        }
        return filtered.map((row) => clone(row));
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        menuSeq += 1;
        const now = new Date();
        const row: MenuItemState = {
          id: nextId('menu', menuSeq),
          restaurantId: String(data.restaurantId),
          name: String(data.name),
          description: (data.description as string | null | undefined) ?? null,
          price: new Prisma.Decimal(data.price as Prisma.Decimal),
          photoFileId: (data.photoFileId as string | null | undefined) ?? null,
          category: (data.category as string | null | undefined) ?? null,
          isAvailable: (data.isAvailable as boolean | undefined) ?? true,
          displayOrder: (data.displayOrder as number | undefined) ?? 0,
          createdAt: now,
          updatedAt: now,
        };
        menuItems.push(row);
        return clone(row);
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = menuItems.find((item) => item.id === where.id);
        if (!row) throw new Error('Menu item not found');
        if (data.name !== undefined) row.name = String(data.name);
        if (data.description !== undefined) row.description = (data.description as string | null) ?? null;
        if (data.price !== undefined) row.price = new Prisma.Decimal(data.price as Prisma.Decimal);
        if (data.photoFileId !== undefined) row.photoFileId = (data.photoFileId as string | null) ?? null;
        if (data.category !== undefined) row.category = (data.category as string | null) ?? null;
        if (data.displayOrder !== undefined) row.displayOrder = Number(data.displayOrder);
        if (data.isAvailable !== undefined) row.isAvailable = Boolean(data.isAvailable);
        row.updatedAt = new Date();
        return clone(row);
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const idx = menuItems.findIndex((item) => item.id === where.id);
        if (idx < 0) throw new Error('Menu item not found');
        const [removed] = menuItems.splice(idx, 1);
        return clone(removed);
      }),
    },
    order: {
      findUnique: jest.fn(async ({ where, select, include }: { where: { id: string }; select?: Record<string, boolean>; include?: Record<string, unknown> }) => {
        const row = orders.find((order) => order.id === where.id);
        if (!row) return null;
        if (select?.id || select?.status || select?.notes) {
          return {
            ...(select?.id ? { id: row.id } : {}),
            ...(select?.status ? { status: row.status } : {}),
            ...(select?.notes ? { notes: row.notes } : {}),
          };
        }
        if (include) {
          const restaurant = restaurants.find((entry) => entry.id === row.restaurantId);
          const user = users.get(row.userId);
          const unit = row.unitId ? units.get(row.unitId) ?? null : null;
          const items = orderItems
            .filter((item) => item.orderId === row.id)
            .map((item) => ({
              ...clone(item),
              menuItem: (() => {
                const menu = menuItems.find((entry) => entry.id === item.menuItemId);
                return {
                  id: menu?.id ?? item.menuItemId,
                  name: menu?.name ?? item.menuItemId,
                };
              })(),
            }));
          return {
            ...clone(row),
            restaurant: {
              id: restaurant?.id ?? row.restaurantId,
              name: restaurant?.name ?? row.restaurantId,
              category: restaurant?.category ?? null,
            },
            user: user ?? {
              id: row.userId,
              nameEN: row.userId,
              nameAR: null,
              phone: null,
              email: `${row.userId}@example.com`,
            },
            unit,
            items,
          };
        }
        return clone(row);
      }),
      findMany: jest.fn(async ({ where, skip, take }: { where?: Record<string, unknown>; skip?: number; take?: number }) => {
        const filtered = applyOrderWhere(where).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const sliced = filtered.slice(skip ?? 0, (skip ?? 0) + (take ?? filtered.length));
        return sliced.map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          totalAmount: row.totalAmount,
          status: row.status,
          createdAt: row.createdAt,
          restaurant: { name: restaurants.find((entry) => entry.id === row.restaurantId)?.name ?? row.restaurantId },
          user: users.get(row.userId) ?? { id: row.userId, nameEN: row.userId, nameAR: null, email: `${row.userId}@example.com`, phone: null },
          unit: row.unitId ? { unitNumber: units.get(row.unitId)?.unitNumber ?? row.unitId } : null,
          _count: { items: orderItems.filter((item) => item.orderId === row.id).length },
        }));
      }),
      count: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => applyOrderWhere(where).length),
      aggregate: jest.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        const filtered = applyOrderWhere(where);
        const sum = filtered.reduce((acc, row) => acc.add(row.totalAmount), new Prisma.Decimal(0));
        return { _sum: { totalAmount: sum } };
      }),
      groupBy: jest.fn(async ({ by, where }: { by: string[]; where?: Record<string, unknown> }) => {
        const filtered = applyOrderWhere(where);
        if (by.length === 1 && by[0] === 'status') {
          const map = new Map<OrderStatus, number>();
          for (const row of filtered) map.set(row.status, (map.get(row.status) ?? 0) + 1);
          return [...map.entries()].map(([status, count]) => ({ status, _count: { _all: count } }));
        }
        if (by.length === 1 && by[0] === 'restaurantId') {
          const grouped = new Map<string, { count: number; sum: Prisma.Decimal }>();
          for (const row of filtered) {
            const current = grouped.get(row.restaurantId) ?? { count: 0, sum: new Prisma.Decimal(0) };
            current.count += 1;
            current.sum = current.sum.add(row.totalAmount);
            grouped.set(row.restaurantId, current);
          }
          return [...grouped.entries()].map(([restaurantId, value]) => ({
            restaurantId,
            _count: { _all: value.count },
            _sum: { totalAmount: value.sum },
          }));
        }
        return [];
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = orders.find((entry) => entry.id === where.id);
        if (!row) throw new Error('Order not found');
        if (data.status !== undefined) row.status = data.status as OrderStatus;
        if (data.confirmedAt !== undefined) row.confirmedAt = (data.confirmedAt as Date | null) ?? null;
        if (data.preparedAt !== undefined) row.preparedAt = (data.preparedAt as Date | null) ?? null;
        if (data.deliveredAt !== undefined) row.deliveredAt = (data.deliveredAt as Date | null) ?? null;
        if (data.cancelledAt !== undefined) row.cancelledAt = (data.cancelledAt as Date | null) ?? null;
        if (data.cancelReason !== undefined) row.cancelReason = (data.cancelReason as string | null) ?? null;
        if (data.notes !== undefined) row.notes = (data.notes as string | null) ?? null;
        row.updatedAt = new Date();
        return clone(row);
      }),
    },
    orderSequence: {
      upsert: jest.fn(async () => ({ name: 'ORDER', counter: orderCounter })),
      update: jest.fn(async () => {
        orderCounter += BigInt(1);
        return { counter: orderCounter };
      }),
    },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return arg({
          orderSequence: prismaMock.orderSequence,
          order: {
            create: async ({ data, select }: { data: Record<string, unknown>; select?: { id?: boolean } }) => {
              orderSeq += 1;
              const now = new Date();
              const orderId = nextId('order', orderSeq);
              const row: OrderState = {
                id: orderId,
                orderNumber: String(data.orderNumber),
                userId: String(data.userId),
                unitId: (data.unitId as string | null | undefined) ?? null,
                restaurantId: String(data.restaurantId),
                status: data.status as OrderStatus,
                totalAmount: new Prisma.Decimal(data.totalAmount as Prisma.Decimal),
                notes: (data.notes as string | null | undefined) ?? null,
                confirmedAt: null,
                preparedAt: null,
                deliveredAt: null,
                cancelledAt: null,
                cancelReason: null,
                createdAt: now,
                updatedAt: now,
              };
              orders.push(row);

              const nested = (data.items as { create?: Array<Record<string, unknown>> } | undefined)?.create ?? [];
              for (const item of nested) {
                orderItemSeq += 1;
                orderItems.push({
                  id: nextId('order-item', orderItemSeq),
                  orderId,
                  menuItemId: String(item.menuItemId),
                  quantity: Number(item.quantity),
                  unitPrice: new Prisma.Decimal(item.unitPrice as Prisma.Decimal),
                  subtotal: new Prisma.Decimal(item.subtotal as Prisma.Decimal),
                  notes: (item.notes as string | null | undefined) ?? null,
                });
              }

              if (select?.id) return { id: orderId };
              return clone(row);
            },
          },
        });
      }

      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg;
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RestaurantsController, OrdersController],
      providers: [
        RestaurantService,
        OrderService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'admin-1' };
          return true;
        },
      })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    orderService = moduleFixture.get<OrderService>(OrderService);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('runs menu CRUD and order lifecycle', async () => {
    const restaurant = await request(app.getHttpServer())
      .post('/restaurants')
      .send({
        name: 'Palm Bites',
        description: 'Fast bites',
        category: 'Egyptian',
      })
      .expect(201)
      .then((response) => response.body as { id: string });

    const menuA = await request(app.getHttpServer())
      .post(`/restaurants/${restaurant.id}/menu`)
      .send({
        name: 'Koshari Bowl',
        price: 85,
        category: 'Mains',
      })
      .expect(201)
      .then((response) => response.body as { id: string });

    const menuB = await request(app.getHttpServer())
      .post(`/restaurants/${restaurant.id}/menu`)
      .send({
        name: 'Chicken Wrap',
        price: 70,
        category: 'Mains',
      })
      .expect(201)
      .then((response) => response.body as { id: string });

    await request(app.getHttpServer())
      .patch(`/menu-items/${menuB.id}`)
      .send({
        description: 'Updated description',
        price: 72,
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/restaurants/${restaurant.id}/menu/reorder`)
      .send({
        category: 'Mains',
        orderedIds: [menuB.id, menuA.id],
      })
      .expect(200);

    const createdOrder = await orderService.createOrder({
      userId: 'resident-1',
      restaurantId: restaurant.id,
      unitId: 'unit-1',
      items: [
        { menuItemId: menuA.id, quantity: 2 },
        { menuItemId: menuB.id, quantity: 1 },
      ],
    });

    expect(createdOrder.orderNumber).toBe('ORD-000001');

    await request(app.getHttpServer())
      .patch(`/orders/${createdOrder.id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('CONFIRMED');
      });

    await request(app.getHttpServer())
      .patch(`/orders/${createdOrder.id}/status`)
      .send({ status: 'PREPARING' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/orders/${createdOrder.id}/status`)
      .send({ status: 'DELIVERED' })
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('DELIVERED');
      });

    const cancelOrder = await orderService.createOrder({
      userId: 'resident-1',
      restaurantId: restaurant.id,
      unitId: 'unit-1',
      items: [{ menuItemId: menuA.id, quantity: 1 }],
    });

    await request(app.getHttpServer())
      .post(`/orders/${cancelOrder.id}/cancel`)
      .send({ cancelReason: 'Customer requested cancellation' })
      .expect(201)
      .then((response) => {
        expect(response.body.status).toBe('CANCELLED');
      });

    await request(app.getHttpServer())
      .get('/orders')
      .expect(200)
      .then((response) => {
        expect(response.body.total).toBeGreaterThanOrEqual(2);
      });

    await request(app.getHttpServer())
      .delete(`/menu-items/${menuB.id}`)
      .expect(200);
  });
});
