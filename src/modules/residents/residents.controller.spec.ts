// src/modules/users/users.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ResidentController } from './residents.controller';
import { ResidentService } from './residents.service';

// Mock the ResidentService
const mockResidentService = {
  findAll: jest.fn(),
  // Add mocks for create, findOne, update, deactivate if needed later
};

describe('ResidentController', () => {
  let controller: ResidentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResidentController],
      providers: [
        {
          provide: ResidentService,
          useValue: mockResidentService, // Use our mock
        },
      ],
    }).compile();

    controller = module.get<ResidentController>(ResidentController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  
  // --- Verification: findAll parameter parsing ---
  it('should correctly parse and pass skip and take numbers to service', async () => {
    // 1. Arrange: Define input query parameters as strings
    const queryRole = 'RESIDENT';
    const querySkip = '5';
    const queryTake = '15';
    
    mockResidentService.findAll.mockResolvedValue([]); // Mock return value

    // 2. Act: Call the controller method with string parameters
    await controller.findAll(queryRole as any, querySkip, queryTake); 

    // 3. Assert: Check if the service was called with correct types (number)
    expect(mockResidentService.findAll).toHaveBeenCalledWith(
      queryRole,
      5,  // Should be parsed to number
      15 // Should be parsed to number
    );
  });
  
  it('should use default skip and take values when parameters are missing', async () => {
    mockResidentService.findAll.mockResolvedValue([]); 

    // Call the controller without skip/take parameters
    await controller.findAll(undefined, undefined, undefined); 

    // Verify defaults were used
    expect(mockResidentService.findAll).toHaveBeenCalledWith(
      undefined,
      0,  // Default skip
      20 // Default take
    );
  });
});