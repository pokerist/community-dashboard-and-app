import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintsService } from './complaints.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplaintStatus, Priority } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';

// --- MOCK PRISMA SERVICE ---
const mockPrismaService = {
  complaint: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

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
    const createDto: CreateComplaintDto = {
      reporterId: 'user-1-uuid',
      description: 'Loud party next door.',
      category: 'Noise',
    };

    it('should generate CMP-00001 when no prior complaints exist', async () => {
      // Mock findFirst to return null (no previous complaints)
      mockPrismaService.complaint.findFirst.mockResolvedValue(null);
      mockPrismaService.complaint.create.mockResolvedValue({ id: 'new-id', complaintNumber: 'CMP-00001', ...createDto });

      await service.create(createDto);

      expect(mockPrismaService.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ complaintNumber: 'CMP-00001' }),
        }),
      );
    });

    it('should generate the next sequential number (CMP-00124)', async () => {
      // Mock findFirst to return the last number
      mockPrismaService.complaint.findFirst.mockResolvedValue({ complaintNumber: 'CMP-00123' });
      mockPrismaService.complaint.create.mockResolvedValue({ id: 'new-id', complaintNumber: 'CMP-00124', ...createDto });

      await service.create(createDto);

      expect(mockPrismaService.complaint.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ complaintNumber: 'CMP-00124' }),
        }),
      );
    });
    
    it('should set default status and priority if not provided', async () => {
      // Mock findFirst to simulate new number
      mockPrismaService.complaint.findFirst.mockResolvedValue({ complaintNumber: 'CMP-00001' });
      mockPrismaService.complaint.create.mockResolvedValue({ id: 'new-id', complaintNumber: 'CMP-00002', status: ComplaintStatus.NEW, priority: Priority.MEDIUM });

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
        mockPrismaService.complaint.findUnique.mockResolvedValue(existingComplaint);
        mockPrismaService.complaint.update.mockResolvedValue(existingComplaint);
    });

    it('should throw BadRequestException if status is CLOSED but no resolutionNotes', async () => {
        const updateDto: UpdateComplaintDto = {
            status: ComplaintStatus.CLOSED,
            resolutionNotes: undefined, // Missing notes
        };

        // Assert that the rejection occurs before calling prisma.update
        await expect(service.update('comp-1-uuid', updateDto)).rejects.toThrow(BadRequestException);
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
        mockPrismaService.complaint.findUnique.mockResolvedValue(resolvedComplaint);
        
        await expect(service.remove('comp-1-uuid')).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.complaint.delete).not.toHaveBeenCalled();
    });

    it('should delete if complaint is NEW', async () => {
        const newComplaint = {
            id: 'comp-1-uuid',
            status: ComplaintStatus.NEW,
        };
        mockPrismaService.complaint.findUnique.mockResolvedValue(newComplaint);
        
        await service.remove('comp-1-uuid');

        expect(mockPrismaService.complaint.delete).toHaveBeenCalledWith({ where: { id: 'comp-1-uuid' } });
    });
    
    it('should throw NotFoundException if complaint does not exist', async () => {
        mockPrismaService.complaint.findUnique.mockResolvedValue(null);
        
        await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});