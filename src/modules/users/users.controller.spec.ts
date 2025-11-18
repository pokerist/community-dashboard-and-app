// src/modules/users/users.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Mock the UsersService
const mockUsersService = {
  findAll: jest.fn(),
  // Add mocks for create, findOne, update, deactivate if needed later
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService, // Use our mock
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
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
    
    mockUsersService.findAll.mockResolvedValue([]); // Mock return value

    // 2. Act: Call the controller method with string parameters
    await controller.findAll(queryRole as any, querySkip, queryTake); 

    // 3. Assert: Check if the service was called with correct types (number)
    expect(mockUsersService.findAll).toHaveBeenCalledWith(
      queryRole,
      5,  // Should be parsed to number
      15 // Should be parsed to number
    );
  });
  
  it('should use default skip and take values when parameters are missing', async () => {
    mockUsersService.findAll.mockResolvedValue([]); 

    // Call the controller without skip/take parameters
    await controller.findAll(undefined, undefined, undefined); 

    // Verify defaults were used
    expect(mockUsersService.findAll).toHaveBeenCalledWith(
      undefined,
      0,  // Default skip
      20 // Default take
    );
  });
});