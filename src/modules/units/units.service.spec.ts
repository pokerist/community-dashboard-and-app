// src/modules/units/units.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UnitsService } from './units.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrismaService = {
  unit: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
  residentUnit: {
    create: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  resident: {
    findUnique: jest.fn(),
  },
  lease: {
    findMany: jest.fn(),
  },
};

const mockEventEmitter = {
  emit: jest.fn(),
};

describe('UnitsService', () => {
  let service: UnitsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService, // Provide the mock
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Example Test Case: Testing the findAll method
  it('should return all units', async () => {
    const expectedUnits = { data: [{ id: 'u1', unitNumber: 'A-101' }], meta: { total: 1, page: 1, limit: 10, totalPages: 1 } };
    mockPrismaService.unit.findMany.mockResolvedValue([{ id: 'u1', unitNumber: 'A-101' }]);
    mockPrismaService.unit.count.mockResolvedValue(1);

    expect(await service.findAll({})).toEqual(expectedUnits);
  });

  // Example Test Case: Testing the create method
  it('should successfully create a unit', async () => {
    const newUnitData = {
      unitNumber: 'C-303',
      building: 'C',
      type: 'APT',
      sizeSqm: 120,
    };
    const createdUnit = { id: 'u3', ...newUnitData, status: 'AVAILABLE' };
    mockPrismaService.unit.create.mockResolvedValue(createdUnit);

    expect(await service.create(newUnitData as any)).toEqual(createdUnit);
    expect(prisma.unit.create).toHaveBeenCalled();
  });
});
