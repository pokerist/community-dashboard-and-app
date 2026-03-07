import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { RestaurantService } from './restaurant.service';

describe('RestaurantService', () => {
  let service: RestaurantService;

  const prismaMock = {
    restaurant: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RestaurantService>(RestaurantService);
    jest.clearAllMocks();
  });

  it('rejects delete when active orders exist', async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue({ id: 'restaurant-1' });
    prismaMock.order.count.mockResolvedValue(2);

    await expect(service.deleteRestaurant('restaurant-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deletes restaurant when no active orders exist', async () => {
    prismaMock.restaurant.findUnique.mockResolvedValue({ id: 'restaurant-1' });
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.restaurant.delete.mockResolvedValue({ id: 'restaurant-1' });

    await expect(service.deleteRestaurant('restaurant-1')).resolves.toEqual({ success: true });
  });
});

