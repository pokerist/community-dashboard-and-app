import { Test, TestingModule } from '@nestjs/testing';
import { LeasesService } from './leases.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeaseStatus } from '@prisma/client';

const mockLease = {
  id: 'lease-123',
  unitId: 'unit-123',
  ownerId: 'owner-123',
  monthlyRent: 5000,
  startDate: new Date(),
  endDate: new Date(),
  status: LeaseStatus.ACTIVE,
};

// --- Mocks for methods *INSIDE* the Transaction (tx) ---
const prismaTxMock = {
  lease: {
    // 1. Mock the transactional creation/update/deletion
    create: jest.fn().mockResolvedValue(mockLease),
    update: jest.fn().mockResolvedValue({ ...mockLease, status: LeaseStatus.TERMINATED }),
    delete: jest.fn().mockResolvedValue(mockLease),
  },
  unit: {
    // 2. Mock the transactional unit status change
    update: jest.fn().mockResolvedValue({ id: 'unit-123', status: 'LEASED' }),
  },
};

// --- Top-Level Prisma Service Mock (this is what NestJS sees) ---
const mockPrismaService = {
  // 1. Crucial Fix: Mock the $transaction function
  // It takes a callback (the async function in your service) and executes it,
  // passing the transactional mock (prismaTxMock) as the 'tx' argument.
  $transaction: jest.fn(callback => callback(prismaTxMock)), 

  // 2. Mock top-level methods (used outside transactions, like findOne/findAll)
  lease: {
    findMany: jest.fn().mockResolvedValue([mockLease]),
    findUnique: jest.fn().mockImplementation((options) => {
        // Mocking the check for existence in update/remove methods
        if (options.where.id === 'lease-123') return mockLease;
        return null; // For NotFoundException tests
    }),
    // We don't need create/update/delete here, as they are now routed through $transaction
  },
};

describe('LeasesService', () => {
  let service: LeasesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeasesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LeasesService>(LeasesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
  it('should create a lease and set unit status to LEASED', async () => {
    const dto = {
      unitId: 'unit-123',
      ownerId: 'owner-123',
      startDate: new Date(),
      endDate: new Date(),
      monthlyRent: 5000,
    };
    
    await service.create(dto);
    
    // 1. Verify the transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    // 2. Verify lease.create was called (using the TX mock)
    expect(prismaTxMock.lease.create).toHaveBeenCalled(); 
    // 3. Verify unit.update was called to set the LEASED status
    expect(prismaTxMock.unit.update).toHaveBeenCalledWith({
      where: { id: dto.unitId },
      data: { status: 'LEASED' },
    });
  });
});

  describe('findAll', () => {
    it('should return an array of leases', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockLease]);
    });
  });

  describe('findOne', () => {
    it('should get a single lease', async () => {
      const result = await service.findOne('lease-123');
      expect(result).toEqual(mockLease);
    });
  });

describe('update', () => {
  it('should update a lease and revert unit status to OCCUPIED if terminated', async () => {
    // 1. Mock the findOne check to return the existing lease
    (prisma.lease.findUnique as jest.Mock).mockResolvedValue(mockLease); 
    
    const terminationDto = { status: LeaseStatus.TERMINATED };
    
    await service.update('lease-123', terminationDto);
    
    // 2. Verify the transactional update logic
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prismaTxMock.lease.update).toHaveBeenCalledWith({
      where: { id: 'lease-123' },
      data: terminationDto,
    });
    // 3. Verify unit.update was called to set the OCCUPIED status
    expect(prismaTxMock.unit.update).toHaveBeenCalledWith({
      where: { id: mockLease.unitId },
      data: { status: 'OCCUPIED' },
    });
  });
});
});