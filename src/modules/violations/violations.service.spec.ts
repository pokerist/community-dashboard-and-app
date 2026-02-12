import { Test, TestingModule } from '@nestjs/testing';
import { ViolationsService } from './violations.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { BadRequestException } from '@nestjs/common';
import { ViolationStatus, InvoiceStatus, InvoiceType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrismaService = {
  violation: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  invoice: {
    // Required for $transaction mock in remove()
    delete: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(mockPrismaService)), // Mock transaction
};

// Mock InvoicesService to check if generateInvoice is called
const mockInvoicesService = {
  generateInvoice: jest.fn(),
};

describe('ViolationsService (Unit)', () => {
  let service: ViolationsService;
  let prisma: typeof mockPrismaService;
  let invoicesService: InvoicesService;

  const VIO_ID = 'vio-123';
  const UNIT_ID = 'unit-1';
  const RES_ID = 'res-1';

  const mockCreateDto = {
    unitId: UNIT_ID,
    residentId: RES_ID,
    type: 'Parking',
    description: 'Double parked',
    fineAmount: 50.0,
    dueDate: new Date(2026, 0, 15),
  };

  const mockViolation = {
    id: VIO_ID,
    ...mockCreateDto,
    fineAmount: new Decimal(mockCreateDto.fineAmount),
    status: ViolationStatus.PENDING,
    violationNumber: 'VIO-00001',
    createdAt: new Date(),
    updatedAt: new Date(),
    invoices: [], // Default empty array for relations
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViolationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: InvoicesService, useValue: mockInvoicesService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<ViolationsService>(ViolationsService);
    prisma = module.get<PrismaService>(PrismaService) as any;
    invoicesService = module.get<InvoicesService>(InvoicesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // [Create] Method Tests (Invoices Integration)
  describe('create', () => {
    it('should create a violation and a linked invoice if fineAmount > 0', async () => {
      // Mock sequential number generation (if it was a separate private function)
      const generateSpy = jest
        .spyOn(service as any, 'generateViolationNumber')
        .mockResolvedValue('VIO-00002');

      // Mock the Prisma call to return the created violation
      prisma.violation.create.mockResolvedValue({
        ...mockViolation,
        id: 'new-vio-id',
        violationNumber: 'VIO-00002',
      });

      await service.create(mockCreateDto as any);

      // Check 1: Violation was created with correct data
      expect(prisma.violation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            violationNumber: 'VIO-00002',
            fineAmount: mockCreateDto.fineAmount,
            status: ViolationStatus.PENDING,
          }),
        }),
      );

      // Check 2: Invoice was created with the correct link and data
      expect(invoicesService.generateInvoice).toHaveBeenCalledWith({
        unitId: UNIT_ID,
        residentId: RES_ID,
        type: InvoiceType.FINE,
        amount: mockCreateDto.fineAmount,
        dueDate: mockCreateDto.dueDate,
        sources: { violationIds: ['new-vio-id'] }, // CRITICAL: Check the link
        status: InvoiceStatus.PENDING,
      });
    });

    it('should create a violation but NOT create an invoice if fineAmount is 0', async () => {
      const dtoNoFine = { ...mockCreateDto, fineAmount: 0.0 };
      prisma.violation.create.mockResolvedValue({
        ...mockViolation,
        fineAmount: new Decimal(0),
      });

      await service.create(dtoNoFine as any);

      expect(prisma.violation.create).toHaveBeenCalled();
      expect(invoicesService.generateInvoice).not.toHaveBeenCalled();
    });
  });

  // [Remove] Method Tests (Transactional Integrity)
  describe('remove', () => {
    const mockInvoiceId = 'inv-456';
    const mockLinkedInvoice = {
      id: mockInvoiceId,
      status: InvoiceStatus.PENDING,
      invoiceNumber: 'INV-00005',
    };
    const mockPaidInvoice = {
      ...mockLinkedInvoice,
      status: InvoiceStatus.PAID,
    };

    // Utility to mock findOne result with specific invoices
    const mockFindOneWithInvoices = (invoices) => {
      jest.spyOn(service, 'findOne').mockResolvedValue({
        ...mockViolation,
        invoices,
      } as any);
    };

    it('should delete violation and its linked PENDING invoice in a transaction', async () => {
      mockFindOneWithInvoices([mockLinkedInvoice]);
      prisma.violation.delete.mockResolvedValue(mockViolation);

      await service.remove(VIO_ID);

      expect(prisma.$transaction).toHaveBeenCalled();
      // Check that the linked invoice was deleted
      expect(prisma.invoice.delete).toHaveBeenCalledWith({
        where: { id: mockInvoiceId },
      });
      // Check that the violation was deleted
      expect(prisma.violation.delete).toHaveBeenCalledWith({
        where: { id: VIO_ID },
      });
    });

    it('should only delete the violation if no invoice is linked', async () => {
      mockFindOneWithInvoices([]);
      prisma.violation.delete.mockResolvedValue(mockViolation);

      await service.remove(VIO_ID);

      expect(prisma.$transaction).toHaveBeenCalled(); // Transaction is still used for simplicity/consistency
      expect(prisma.invoice.delete).not.toHaveBeenCalled();
      expect(prisma.violation.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException if the linked invoice is PAID', async () => {
      mockFindOneWithInvoices([mockPaidInvoice]);

      await expect(service.remove(VIO_ID)).rejects.toThrow(
        new BadRequestException(
          'Cannot delete a violation that has already been paid.',
        ),
      );

      expect(prisma.$transaction).toHaveBeenCalled(); // The error prevents transaction start
      expect(prisma.invoice.delete).not.toHaveBeenCalled();
      expect(prisma.violation.delete).not.toHaveBeenCalled();
    });
  });
});
