import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport'; // Mock the AuthGuard
import { ServiceRequestModule } from '../../src/modules/service-request/service-request.module';
import { ServiceRequestService } from '../../src/modules/service-request/service-request.service';
import { CreateServiceRequestDto } from '../../src/modules/service-request/dto/create-service-request.dto';
import { UpdateServiceRequestInternalDto } from '../../src/modules/service-request/dto/update-service-request-internal.dto';
import { FieldValueDto } from '../../src/modules/service-request/dto/field-value.dto';
import { Role, Priority } from '@prisma/client';

// --- MOCK DATA ---
const mockUserId = 'user-uuid-123';
const mockServiceId = 'service-uuid-456';
const mockUnitId = 'unit-uuid-789';
const mockAttachmentId = 'file-uuid-111';
const mockFieldId = 'field-uuid-222';

// The expected response structure for a successful creation
const mockRequestResponse = {
  id: 'req-uuid-999',
  status: 'NEW',
  requestedAt: new Date().toISOString(),
  service: { name: 'Test Service', category: 'ADMIN' },
};

// Mock Prisma Service
const mockPrismaService = {
  serviceRequest: {
    create: jest.fn().mockResolvedValue(mockRequestResponse),
    findUnique: jest.fn().mockResolvedValue(mockRequestResponse),
    findMany: jest.fn().mockResolvedValue([mockRequestResponse]),
    update: jest
      .fn()
      .mockResolvedValue({ id: 'req-uuid-999', status: 'IN_PROGRESS' }),
  },
  attachment: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  serviceRequestFieldValue: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  service: {
    findUnique: jest.fn().mockImplementation(({ where }) => {
      // Mock the service existence and required fields for validation
      if (where.id === mockServiceId) {
        return Promise.resolve({
          id: mockServiceId,
          status: true,
          formFields: [{ id: mockFieldId, required: true }], // Ensure one required field is checked
        });
      }
      return null;
    }),
  },
  $transaction: jest.fn().mockImplementation(async (callback) => {
    // Mock the transaction: calls the callback function, passing a mock transaction client
    const transactionClient = mockPrismaService;
    return callback(transactionClient);
  }),
};

describe('ServiceRequestController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ServiceRequestModule],
      providers: [
        ServiceRequestService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    })
      .overrideGuard(AuthGuard('jwt')) // Mocks the JWT guard to bypass authentication
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          // Inject a mock user object into the request
          req.user = { id: mockUserId, role: Role.RESIDENT };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. POST /service-requests: Should successfully create a request with attachments and field values', async () => {
    // Reset mock counts before this important test
    mockPrismaService.$transaction.mockClear();
    mockPrismaService.serviceRequest.create.mockClear();

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
      .send(createDto)
      .expect(201) // Expect successful creation
      .then((response) => {
        expect(response.body).toHaveProperty('id');
        expect(response.body.service.name).toEqual('Test Service');
      });

    // Assert that the transaction was called
    expect(mockPrismaService.$transaction).toHaveBeenCalled();
    // Assert that attachment creation was called
    expect(mockPrismaService.attachment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { fileId: mockAttachmentId, serviceRequestId: expect.any(String) },
      ]),
      skipDuplicates: true,
    });
    // Assert that field value creation was called
    expect(
      mockPrismaService.serviceRequestFieldValue.createMany,
    ).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        {
          requestId: expect.any(String),
          fieldId: mockFieldId,
          valueText: 'In',
        },
      ]),
    });
  });

  it('2. POST /service-requests: Should fail if a required dynamic field is missing', async () => {
    // Mock the service to exist but expect the submission to be missing the required field
    const createDto: CreateServiceRequestDto = {
      serviceId: mockServiceId, // This service has one required field (mockFieldId)
      unitId: mockUnitId,
      description: 'Missing required data',
      fieldValues: [], // Submitting an empty array of values
    };

    await request(app.getHttpServer())
      .post('/service-requests')
      .send(createDto)
      .expect(400) // Expect Bad Request
      .then((response) => {
        expect(response.body.message).toContain('Missing required fields');
        expect(response.body.message).toContain(mockFieldId);
      });
  });

  it('3. GET /service-requests/my-requests: Should return requests for the current authenticated user', async () => {
    await request(app.getHttpServer())
      .get('/service-requests/my-requests')
      .expect(200)
      .then((response) => {
        expect(response.body).toBeInstanceOf(Array);
        expect(mockPrismaService.serviceRequest.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { createdById: mockUserId } }),
        );
      });
  });

  it('4. PATCH /service-requests/:id: Should update the status and assignee', async () => {
    const updateDto: UpdateServiceRequestInternalDto = {
      status: 'IN_PROGRESS',
      assignedToId: 'staff-uuid-444',
    };

    await request(app.getHttpServer())
      .patch(`/service-requests/req-uuid-999`)
      .send(updateDto)
      .expect(200)
      .then((response) => {
        expect(response.body.status).toBe('IN_PROGRESS');
      });

    // Assert that the update method was called correctly
    expect(mockPrismaService.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-uuid-999' },
        data: updateDto, // Ensure only the administrative fields are passed
      }),
    );
  });
});
