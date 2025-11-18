// src/modules/units/units.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UnitsService } from './units.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrismaService = {
  unit: {
    findMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
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
    const expectedUnits = [{ id: 'u1', unitNumber: 'A-101' }];
    mockPrismaService.unit.findMany.mockResolvedValue(expectedUnits);

    expect(await service.findAll()).toEqual(expectedUnits);
    expect(prisma.unit.findMany).toHaveBeenCalledWith({
      orderBy: { unitNumber: 'asc' },
      include: { residents: true },
    });
  });

  // Example Test Case: Testing the create method
  it('should successfully create a unit', async () => {
    const newUnitData = { unitNumber: 'C-303', building: 'C', type: 'APT', sizeSqm: 120 };
    const createdUnit = { id: 'u3', ...newUnitData, status: 'AVAILABLE' };
    mockPrismaService.unit.create.mockResolvedValue(createdUnit);

    expect(await service.create(newUnitData as any)).toEqual(createdUnit);
    expect(prisma.unit.create).toHaveBeenCalled();
  });
});