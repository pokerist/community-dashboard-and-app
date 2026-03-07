import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;

  const prismaMock = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    restaurant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    menuItem: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    jest.clearAllMocks();
  });

  it('rejects invalid status transitions', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.PENDING,
    });

    await expect(
      service.updateOrderStatus('order-1', {
        status: OrderStatus.PREPARING,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates orderNumber and calculates subtotal/total in createOrder', async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue({
      id: 'restaurant-1',
      isActive: true,
    });
    prismaMock.menuItem.findMany.mockResolvedValue([
      { id: 'menu-1', isAvailable: true, price: new Prisma.Decimal('85.00') },
      { id: 'menu-2', isAvailable: true, price: new Prisma.Decimal('70.00') },
    ]);

    const txMock = {
      orderSequence: {
        upsert: jest.fn().mockResolvedValue({ name: 'ORDER', counter: BigInt(0) }),
        update: jest.fn().mockResolvedValue({ counter: BigInt(12) }),
      },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order-12' }),
      },
    };
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<string>) => callback(txMock),
    );

    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-12',
      orderNumber: 'ORD-000012',
      status: OrderStatus.PENDING,
      totalAmount: new Prisma.Decimal('240.00'),
      notes: null,
      confirmedAt: null,
      preparedAt: null,
      deliveredAt: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date('2026-03-07T10:00:00.000Z'),
      updatedAt: new Date('2026-03-07T10:00:00.000Z'),
      restaurant: { id: 'restaurant-1', name: 'Palm Bites', category: 'Egyptian' },
      user: {
        id: 'user-1',
        nameEN: 'Resident A',
        nameAR: null,
        phone: null,
        email: 'resident.a@example.com',
      },
      unit: { id: 'unit-1', unitNumber: 'A-101', block: 'A' },
      items: [
        {
          id: 'item-1',
          menuItemId: 'menu-1',
          quantity: 2,
          unitPrice: new Prisma.Decimal('85.00'),
          subtotal: new Prisma.Decimal('170.00'),
          notes: null,
          menuItem: { id: 'menu-1', name: 'Koshari Bowl' },
        },
        {
          id: 'item-2',
          menuItemId: 'menu-2',
          quantity: 1,
          unitPrice: new Prisma.Decimal('70.00'),
          subtotal: new Prisma.Decimal('70.00'),
          notes: null,
          menuItem: { id: 'menu-2', name: 'Chicken Wrap' },
        },
      ],
    });

    await service.createOrder({
      userId: 'user-1',
      restaurantId: 'restaurant-1',
      unitId: 'unit-1',
      items: [
        { menuItemId: 'menu-1', quantity: 2 },
        { menuItemId: 'menu-2', quantity: 1 },
      ],
    });

    const createArgs = txMock.order.create.mock.calls[0][0] as {
      data: {
        orderNumber: string;
        totalAmount: Prisma.Decimal;
        items: {
          create: Array<{
            subtotal: Prisma.Decimal;
          }>;
        };
      };
    };
    expect(createArgs.data.orderNumber).toBe('ORD-000012');
    expect(createArgs.data.items.create[0].subtotal.toString()).toBe('170');
    expect(createArgs.data.items.create[1].subtotal.toString()).toBe('70');
    expect(createArgs.data.totalAmount.toString()).toBe('240');
  });
});

