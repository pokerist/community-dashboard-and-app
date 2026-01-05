// test/service-request/service-request.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceRequestModule } from '../../src/modules/service-request/service-request.module';
import { ServiceRequestService } from '../../src/modules/service-request/service-request.service';
import { CreateServiceRequestDto } from '../../src/modules/service-request/dto/create-service-request.dto';
import { UpdateServiceRequestInternalDto } from '../../src/modules/service-request/dto/update-service-request-internal.dto';
import { FieldValueDto } from '../../src/modules/service-request/dto/field-value.dto';
import { Priority } from '@prisma/client';

// --- MOCK DATA ---
const mockUserId = 'user-uuid-123';
const mockServiceId = 'service-uuid-456';
const mockUnitId = 'unit-uuid-789';
const mockAttachmentId = 'file-uuid-111';
const mockFieldId = 'field-uuid-222';
const mockRequestId = 'req-uuid-999';

// The expected response structure for a successful creation
const mockRequestResponse = {
  id: mockRequestId,
  status: 'NEW',
  requestedAt: new Date().toISOString(),
  service: { name: 'Test Service', category: 'ADMIN' },
};

// Mock Prisma Service
const mockPrismaService = {
  serviceRequest: {
    create: jest.fn().mockResolvedValue(mockRequestResponse),
    // 1. Used by the controller findOne and service findUnique (after create, before update)
    findUnique: jest.fn().mockImplementation(({ where, include }) => {
      if (where.id === mockRequestId) {
        // Return a full object needed for the final rich-response in .create()
        return Promise.resolve({
          ...mockRequestResponse,
          // Add includes needed for the final .create() return and the findOne() route
          attachments: [],
          fieldValues: [],
          unit: {}, // Include dummy data to prevent errors in service methods
          createdBy: {},
        });
      }
      return Promise.resolve(null);
    }),
    findMany: jest.fn().mockResolvedValue([mockRequestResponse]),
    // 2. Used by the update test
    update: jest
      .fn()
      .mockResolvedValue({ id: mockRequestId, status: 'IN_PROGRESS' }),
  },
  attachment: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  serviceRequestFieldValue: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  service: {
    // 3. Used by the create service method for validation
    findUnique: jest.fn().mockImplementation(({ where, include }) => {
      if (where.id === mockServiceId) {
        return Promise.resolve({
          id: mockServiceId,
          status: true, // <-- FIXED: Must be truthy to pass 'if (!service || !service.status)'
          unitEligibility: 'ALL', // Added for completeness
          // Mock the required formFields for validation
          formFields: [{ id: mockFieldId, required: true }],
        });
      }
      return null; // Return null if the serviceId is wrong or service not found
    }),
  },
  $transaction: jest.fn().mockImplementation(async (callback) => {
    const transactionClient = mockPrismaService;
    return callback(transactionClient);
  }),
};

// Interceptor is left for completeness of the NestJS testing setup
class MockUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    req.user = { id: mockUserId, role: 'RESIDENT' };
    return next.handle();
  }
}

describe('ServiceRequestController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ServiceRequestModule],
      // NOTE: This is a mocked integration test (HTTP layer + module wiring),
      // so Prisma MUST be overridden even if ServiceRequestModule imports PrismaModule.
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideInterceptor(APP_INTERCEPTOR)
      .useClass(MockUserInterceptor)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 1: POST /service-requests
  it('1. POST /service-requests: Should successfully create a request with attachments and field values', async () => {
    // Clear mocks before this test to ensure accurate counts
    jest.clearAllMocks();

    const fieldValueDto: FieldValueDto[] = [
      { fieldId: mockFieldId, valueText: 'In' },
    ];
    const createDto: CreateServiceRequestDto = {
      serviceId: mockServiceId,
      unitId: mockUnitId,
      description: 'Need to move a sofa in next week.',
      attachmentIds: [mockAttachmentId],
      fieldValues: fieldValueDto,
      priority: Priority.HIGH,
    };

    await request(app.getHttpServer())
      .post('/service-requests')
      .set('x-user-id', mockUserId) // Passed as header for controller fix
      .send(createDto)
      .expect(201) // Expect success now validation is fixed
      .then((response) => {
        expect(response.body).toHaveProperty('id');
        expect(response.body.service.name).toEqual('Test Service');
      });

    expect(mockPrismaService.$transaction).toHaveBeenCalled();
    expect(mockPrismaService.serviceRequest.create).toHaveBeenCalled();
  });

  // Test 2: POST /service-requests (Missing required field)
  it('2. POST /service-requests: Should fail if a required dynamic field is missing', async () => {
    const createDto: CreateServiceRequestDto = {
      serviceId: mockServiceId,
      unitId: mockUnitId,
      description: 'Missing required data',
      fieldValues: [], // Submitting an empty array of values
    };

    await request(app.getHttpServer())
      .post('/service-requests')
      .set('x-user-id', mockUserId)
      .send(createDto)
      .expect(400)
      .then((response) => {
        // Expect failure message now that service is active in mock
        expect(response.body.message).toContain('Missing required fields');
        expect(response.body.message).toContain(mockFieldId);
      });
  });

  // Test 3: GET /service-requests/my-requests
  it('3. GET /service-requests/my-requests: Should return requests for the current authenticated user', async () => {
    jest.clearAllMocks(); // Clear to test this specific call count

    await request(app.getHttpServer())
      .get('/service-requests/my-requests')
      .set('x-user-id', mockUserId)
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
        expect(mockPrismaService.serviceRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { createdById: mockUserId } }),
        );
      });
  });

  // Test 4: PATCH /service-requests/:id
  it('4. PATCH /service-requests/:id: Should update the status and assignee', async () => {
    const updateDto: UpdateServiceRequestInternalDto = {
      status: 'IN_PROGRESS',
      assignedToId: 'staff-uuid-444',
    };

    await request(app.getHttpServer())
      .patch(`/service-requests/${mockRequestId}`)
      .send(updateDto)
      .expect(200) // Expect 200 now that findUnique is mocked correctly
      .then((response) => {
        expect(response.body.status).toBe('IN_PROGRESS');
      });

    // Assert that the update method was called correctly
    expect(mockPrismaService.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: mockRequestId },
        data: updateDto,
      }),
    );
  });

  // Test 5: GET /service-requests (Dashboard view: Fetch all)
  it('5. GET /service-requests: Should return all requests (Dashboard View)', async () => {
    jest.clearAllMocks(); // Clear to test this specific call count

    await request(app.getHttpServer())
      .get('/service-requests')
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
        expect(mockPrismaService.serviceRequest.findMany).toHaveBeenCalled();
      });
  });
});
