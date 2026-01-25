// src/modules/residents/residents.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ResidentService } from './residents.service';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Mock the bcrypt hash function
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword123'),
}));

// Mock the Prisma client methods used in your service
const mockPrismaService = {
  $transaction: jest.fn(),
  user: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userRole: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  resident: {
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  residentUnit: {
    deleteMany: jest.fn(),
  },
  booking: {
    deleteMany: jest.fn(),
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
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create user with roles in transaction', async () => {
      const createDto = {
        nameEN: 'John Doe',
        phone: '+971501234567',
        password: 'testpassword',
        roles: ['role1', 'role2'],
        signupSource: 'dashboard',
      };

      const mockUser = {
        id: 'u1',
        ...createDto,
        passwordHash: 'hashedPassword123',
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        roles: [],
        resident: null,
        owner: null,
        tenant: null,
        admin: null,
        residentUnits: [],
        leasesAsOwner: [],
        leasesAsTenant: [],
        invoices: [],
      });

      const result = await service.createUser(createDto, {
        permissions: ['user.create.direct'],
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith('testpassword', 12);
      expect(mockPrismaService.userRole.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', roleId: 'role1' },
          { userId: 'u1', roleId: 'role2' },
        ],
      });
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user by setting status to DISABLED', async () => {
      const userId = 'user-to-deactivate';

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        userStatus: 'ACTIVE',
      });

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        userStatus: 'DISABLED',
        updatedAt: new Date(),
      });

      await service.deactivateUser(userId);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { userStatus: 'DISABLED', updatedAt: expect.any(Date) },
        include: expect.any(Object),
      });
    });
  });

  describe('deleteResident', () => {
    it('should delete resident with cascading cleanup', async () => {
      const residentId = 'resident-id';
      const userId = 'user-id';

      const mockResident = {
        id: residentId,
        userId,
        user: { id: userId },
      };

      mockPrismaService.resident.findUnique.mockResolvedValue(mockResident);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      await service.deleteResident(residentId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.residentUnit.deleteMany).toHaveBeenCalledWith({
        where: { residentId: userId },
      });
      expect(mockPrismaService.booking.deleteMany).toHaveBeenCalledWith({
        where: { residentId: residentId },
      });
      expect(mockPrismaService.resident.delete).toHaveBeenCalledWith({
        where: { id: residentId },
      });
    });
  });
});
