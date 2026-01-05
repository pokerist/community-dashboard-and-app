// src/modules/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ResidentService } from './residents.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt'; // Import bcrypt for mocking

// Mock the bcrypt hash function
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
}));

// Mock the Prisma client methods used in your service
const mockPrismaService = {
  user: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('ResidentService', () => {
  let service: ResidentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResidentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ResidentService>(ResidentService);
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Verification 1: Create User ---
  it('should call prisma.user.create and hash the password', async () => {
    const createDto = {
      name: 'John Doe',
      phone: '+966501234567',
      role: 'RESIDENT',
      password: 'testpassword',
    } as any;

    mockPrismaService.user.create.mockResolvedValue({
      id: 'u1',
      ...createDto,
      passwordHash: 'hashedPassword123',
    });

    await service.createUser(createDto);

    // Verify bcrypt was called
    expect(bcrypt.hash).toHaveBeenCalledWith('testpassword', 10);

    // Verify Prisma was called with the hashed password
    expect(mockPrismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: createDto.phone,
        passwordHash: 'hashedPassword123',
        userStatus: 'ACTIVE',
        signupSource: 'dashboard',
      }),
      include: expect.any(Object),
    });

    // --- Verification 2: Deactivate User ---
    it('should call prisma.user.update to set status to INACTIVE', async () => {
      const userId = 'user-to-deactivate';
      mockPrismaService.user.update.mockResolvedValue({
        userStatus: 'DISABLED',
      });

      await service.deactivateUser(userId);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { userStatus: 'DISABLED', updatedAt: expect.any(Date) },
      });
    });
  });
});
