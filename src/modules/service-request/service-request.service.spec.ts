import { Test, TestingModule } from '@nestjs/testing';
import { ServiceRequestService } from './service-request.service';
import { InvoicesService } from '../invoices/invoices.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = {
  serviceRequest: {
    findUnique: jest.fn(),
  },
};

const mockInvoices = {
  generateInvoice: jest.fn(),
};

describe('ServiceRequestService', () => {
  let service: ServiceRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceRequestService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoicesService, useValue: mockInvoices },
      ],
    }).compile();

    service = module.get<ServiceRequestService>(ServiceRequestService);
    jest.clearAllMocks();
  });

  it('should create invoice for service request and link it', async () => {
    const req = {
      id: 'req-1',
      unitId: 'unit-1',
      createdById: 'res-1',
      unit: { id: 'unit-1', residents: [{ userId: 'res-1' }] },
    } as any;

    mockPrisma.serviceRequest.findUnique.mockResolvedValue(req);
    mockInvoices.generateInvoice.mockResolvedValue({
      id: 'inv-1',
    });

    const inv = await service.createInvoiceForRequest('req-1', 100, new Date());

    expect(mockPrisma.serviceRequest.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1' },
        include: expect.any(Object),
      }),
    );

    expect(mockInvoices.generateInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: 'unit-1',
        residentId: 'res-1',
        amount: 100,
        sources: { serviceRequestIds: ['req-1'] },
      }),
    );

    expect(inv).toEqual({ id: 'inv-1' });
  });
});
