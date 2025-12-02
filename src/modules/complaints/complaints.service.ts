import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { ComplaintStatus, Priority } from '@prisma/client';

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next sequential complaint number (e.g., CMP-00001)
   */
  private async generateComplaintNumber(): Promise<string> {
    const lastComplaint = await this.prisma.complaint.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { complaintNumber: true },
    });
    const lastNumber = lastComplaint?.complaintNumber
      ? parseInt(lastComplaint.complaintNumber.substring(4))
      : 0;
    const newNumber = lastNumber + 1;
    return `CMP-${newNumber.toString().padStart(5, '0')}`;
  }

  // --- 1. CREATE ---
  async create(dto: CreateComplaintDto) {
    const complaintNumber = await this.generateComplaintNumber();

    return this.prisma.complaint.create({
      data: {
        ...dto,
        complaintNumber,
        status: ComplaintStatus.NEW, // Default status from schema
        priority: dto.priority || Priority.MEDIUM, // Use provided priority or MEDIUM default
      },
    });
  }
  
  // --- 2. READ (FIND ALL) ---
  async findAll() {
    return this.prisma.complaint.findMany({
      include: {
        reporter: { select: { nameEN: true, email: true } },
        unit: { select: { unitNumber: true } },
        assignedTo: { select: { nameEN: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- 3. READ (FIND ONE) ---
  async findOne(id: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        reporter: true,
        unit: true,
        assignedTo: true,
      },
    });
    if (!complaint) throw new NotFoundException(`Complaint ${id} not found.`);
    return complaint;
  }

  // --- 4. UPDATE ---
  async update(id: string, dto: UpdateComplaintDto) {
    await this.findOne(id); // Check existence

    // Add logic for status updates that require additional fields/checks
    if (dto.status) {
      if (dto.status === ComplaintStatus.RESOLVED || dto.status === ComplaintStatus.CLOSED) {
        // Business Rule: Ensure resolution notes are present when closing
        if (!dto.resolutionNotes) {
          throw new BadRequestException('Resolution notes are required to RESOLVE or CLOSE a complaint.');
        }
      }
    }
    
    return this.prisma.complaint.update({
      where: { id },
      data: dto,
    });
  }

  // --- 5. DELETE ---
  async remove(id: string) {
    const complaint = await this.findOne(id); // Check existence

    // Business Rule: Prevent deletion of resolved/closed complaints to maintain history
    if (complaint.status === ComplaintStatus.RESOLVED || complaint.status === ComplaintStatus.CLOSED) {
        throw new BadRequestException(`Cannot delete a ${complaint.status} complaint.`);
    }
    
    return this.prisma.complaint.delete({
      where: { id },
    });
  }

  // --- 6. Helper: Change Status (Used internally or by a dedicated status route) ---
  async updateStatus(id: string, status: ComplaintStatus, resolutionNotes?: string) {
    await this.findOne(id);

    if (
        (status === ComplaintStatus.RESOLVED || status === ComplaintStatus.CLOSED) &&
        !resolutionNotes
    ) {
        throw new BadRequestException('Resolution notes are required to transition to RESOLVED or CLOSED status.');
    }

    return this.prisma.complaint.update({
        where: { id },
        data: {
            status,
            resolutionNotes,
            resolvedAt
    });
  }
}