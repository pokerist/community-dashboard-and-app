import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintsService } from './complaints.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplaintStatus, Priority } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { InvoicesService } from '../invoices/invoices.service';

// --- MOCK PRISMA SERVICE ---
const mockPrismaService: any = {
  complaint: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  attachment: {
    createMany: jest.fn(),
  },
};

mockPrismaService.$transaction = jest.fn(async (cb: any) => cb(mockPrismaService));

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InvoicesService,
          useValue: { generateInvoice: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ComplaintsService>(ComplaintsService);
    prisma = module.get<PrismaService>(PrismaService);
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- TEST: SEQUENTIAL NUMBERING ---
  describe('create', () => {
    const createDto: CreateComplaintDto & { reporterId: string } = {
      reporterId: 'user-1-uuid',
      description: 'Loud party next door.',
      category: 'Noise',
    };

    it('should generate CMP-00001 when no prior complaints exist', async () => {
      // Mock findFirst to return null (no previous complaints)
      mockPrismaService.complaint.findFirst.mockResolvedValue(null);
      mockPrismaService.complaint.create.mockResolvedValue({
        id: 'new-id',
        complaintNumber: 'CMP-00001',
        ...createDto,
      });

      await service.create(createDto);

      expect(mockPrismaService.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ complaintNumber: 'CMP-00001' }),
        }),
      );
    });

    it('should generate the next sequential number (CMP-00124)', async () => {
      // Mock findFirst to return the last number
      mockPrismaService.complaint.findFirst.mockResolvedValue({
        complaintNumber: 'CMP-00123',
      });
      mockPrismaService.complaint.create.mockResolvedValue({
        id: 'new-id',
        complaintNumber: 'CMP-00124',
        ...createDto,
      });

      await service.create(createDto);

      expect(mockPrismaService.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ complaintNumber: 'CMP-00124' }),
        }),
      );
    });

    it('should set default status and priority if not provided', async () => {
      // Mock findFirst to simulate new number
      mockPrismaService.complaint.findFirst.mockResolvedValue({
        complaintNumber: 'CMP-00001',
      });
      mockPrismaService.complaint.create.mockResolvedValue({
        id: 'new-id',
        complaintNumber: 'CMP-00002',
        status: ComplaintStatus.NEW,
        priority: Priority.MEDIUM,
      });

      await service.create(createDto);

      expect(mockPrismaService.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ComplaintStatus.NEW,
            priority: Priority.MEDIUM, // Test that the default priority is set
          }),
        }),
      );
    });
  });

  // --- TEST: UPDATE & STATUS LOGIC ---
  describe('update', () => {
    const existingComplaint = {
      id: 'comp-1-uuid',
      status: ComplaintStatus.NEW,
      reporterId: 'user-1',
    };

    beforeEach(() => {
      // Mock findOne for existence check in update
      mockPrismaService.complaint.findUnique.mockResolvedValue(
        existingComplaint,
      );
      mockPrismaService.complaint.update.mockResolvedValue(existingComplaint);
    });

    it('should throw BadRequestException if status is CLOSED but no resolutionNotes', async () => {
      const updateDto: UpdateComplaintDto = {
        status: ComplaintStatus.CLOSED,
        resolutionNotes: undefined, // Missing notes
      };

      // Assert that the rejection occurs before calling prisma.update
      await expect(service.update('comp-1-uuid', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.complaint.update).not.toHaveBeenCalled();
    });

    it('should allow status change to IN_PROGRESS without notes', async () => {
      const updateDto: UpdateComplaintDto = {
        status: ComplaintStatus.IN_PROGRESS,
      };

      await service.update('comp-1-uuid', updateDto);

      expect(mockPrismaService.complaint.update).toHaveBeenCalled();
    });

    it('should allow closing a complaint if notes are present', async () => {
      const updateDto: UpdateComplaintDto = {
        status: ComplaintStatus.RESOLVED,
        resolutionNotes: 'Issue fixed by maintenance.',
      };

      await service.update('comp-1-uuid', updateDto);

      expect(mockPrismaService.complaint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ComplaintStatus.RESOLVED,
            resolutionNotes: 'Issue fixed by maintenance.',
            // NOTE: resolvedAt logic is handled in service/controller. We test the core update call here.
          }),
        }),
      );
    });
  });

  // --- TEST: DELETION RESTRICTION LOGIC ---
  describe('remove', () => {
    it('should throw BadRequestException if complaint is RESOLVED', async () => {
      const resolvedComplaint = {
        id: 'comp-1-uuid',
        status: ComplaintStatus.RESOLVED,
      };
      mockPrismaService.complaint.findUnique.mockResolvedValue(
        resolvedComplaint,
      );

      await expect(service.remove('comp-1-uuid')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.complaint.delete).not.toHaveBeenCalled();
    });

    it('should delete if complaint is NEW', async () => {
      const newComplaint = {
        id: 'comp-1-uuid',
        status: ComplaintStatus.NEW,
      };
      mockPrismaService.complaint.findUnique.mockResolvedValue(newComplaint);

      await service.remove('comp-1-uuid');

      expect(mockPrismaService.complaint.delete).toHaveBeenCalledWith({
        where: { id: 'comp-1-uuid' },
      });
    });

    it('should throw NotFoundException if complaint does not exist', async () => {
      mockPrismaService.complaint.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // --- TEST: INVOICING FROM COMPLAINT ---
  describe('createInvoiceForComplaint', () => {
    it('should create invoice for complaint and call InvoicesService.generateInvoice', async () => {
      const comp = {
        id: 'c-1',
        unitId: 'unit-1',
        reporterId: 'res-1',
        unit: { id: 'unit-1', residents: [{ userId: 'res-1' }] },
      } as any;
      mockPrismaService.complaint.findUnique.mockResolvedValue(comp);

      const mockInvoices = {
        generateInvoice: jest.fn().mockResolvedValue({ id: 'inv-1' }),
      };

      // Recreate service with mocked invoices service
      const localService = new ComplaintsService(
        mockPrismaService as any,
        mockInvoices as any,
      );

      const result = await localService.createInvoiceForComplaint(
        'c-1',
        200,
        new Date(),
      );

      expect(mockPrismaService.complaint.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c-1' },
          include: expect.any(Object),
        }),
      );
      expect(mockInvoices.generateInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          unitId: 'unit-1',
          residentId: 'res-1',
          amount: 200,
          sources: { complaintIds: ['c-1'] },
        }),
      );
      expect(result).toEqual({ id: 'inv-1' });
    });

    it('should throw NotFoundException if complaint not found', async () => {
      mockPrismaService.complaint.findUnique.mockResolvedValue(null);
      const mockInvoices = { generateInvoice: jest.fn() };
      const localService = new ComplaintsService(
        mockPrismaService as any,
        mockInvoices as any,
      );
      await expect(
        localService.createInvoiceForComplaint('missing', 100, new Date()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
