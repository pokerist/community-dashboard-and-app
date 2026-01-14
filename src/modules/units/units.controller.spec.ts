// src/modules/units/units.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

// Mock the UnitsService
const mockUnitsService = {
  findAll: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  // Add mocks for update and remove here
};

describe('UnitsController', () => {
  let controller: UnitsController;
  let service: UnitsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnitsController],
      providers: [
        {
          provide: UnitsService,
          useValue: mockUnitsService, // Use our mock instead of the real service
        },
      ],
    }).compile();

    controller = module.get<UnitsController>(UnitsController);
    service = module.get<UnitsService>(UnitsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // Example Test Case: Testing the GET /units endpoint
  it('should call findAll and return a list of units', async () => {
    const result = [{ id: '1', unitNumber: 'A-101' }];
    mockUnitsService.findAll.mockReturnValue(result);

    expect(await controller.findAll()).toEqual(result);
    expect(service.findAll).toHaveBeenCalled();
  });

  // Example Test Case: Testing the POST /units endpoint
  it('should call create when creating a new unit', async () => {
    const newUnit = {
      unitNumber: 'B-202',
      building: 'B',
      type: 'APT',
      sizeSqm: 100,
    };
    mockUnitsService.create.mockImplementation((dto) => ({
      id: 'new-id',
      ...dto,
    }));

    expect(await controller.create(newUnit as any)).toEqual({
      id: 'new-id',
      ...newUnit,
    });
    expect(service.create).toHaveBeenCalledWith(newUnit);
  });
});
