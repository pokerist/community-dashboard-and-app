import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { ComplaintsQueryDto } from './dto/complaints-query.dto';
import { ComplaintStatus, Priority, InvoiceType } from '@prisma/client';
import { InvoicesService } from '../invoices/invoices.service';
import { paginate } from '../../common/utils/pagination.util';

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

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

  /**
   * Helper to calculate resolvedAt based on status change.
   */
  private getResolutionTimestamp(status: ComplaintStatus): Date | null {
    if (
      status === ComplaintStatus.RESOLVED ||
      status === ComplaintStatus.CLOSED
    ) {
      return new Date(); // Set resolvedAt when closing/resolving
    }
    return null; // Clear resolvedAt for any other status change
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
  async findAll(query: ComplaintsQueryDto) {
    const {
      status,
      priority,
      unitId,
      reporterId,
      assignedToId,
      createdAtFrom,
      createdAtTo,
      ...baseQuery
    } = query;

    const filters: Record<string, any> = {
      status,
      priority,
      unitId,
      reporterId,
      assignedToId,
      createdAtFrom,
      createdAtTo,
    };

    return paginate(this.prisma.complaint, baseQuery, {
      searchFields: ['complaintNumber', 'category', 'description'],
      additionalFilters: filters,
      include: {
        reporter: { select: { nameEN: true, email: true } },
        unit: { select: { unitNumber: true } },
        assignedTo: { select: { nameEN: true } },
      },
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

  // --- 4. UPDATE (Handles all patching, including status and assignedToId) ---
  async update(id: string, dto: UpdateComplaintDto) {
    await this.findOne(id);

    const dataToUpdate: any = { ...dto };

    // 1. Enforce business rule: Resolution notes are required to close/resolve.
    if (
      dataToUpdate.status === ComplaintStatus.RESOLVED ||
      dataToUpdate.status === ComplaintStatus.CLOSED
    ) {
      if (!dataToUpdate.resolutionNotes) {
        throw new BadRequestException(
          'Resolution notes are required to RESOLVE or CLOSE a complaint.',
        );
      }
    }

    // 2. Auto-calculate resolvedAt timestamp if status is being updated
    if (dataToUpdate.status) {
      dataToUpdate.resolvedAt = this.getResolutionTimestamp(
        dataToUpdate.status,
      );
    }

    // 3. Send the merged data to Prisma (handles assignedToId, status, notes, and timestamp)
    return this.prisma.complaint.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  // --- 5. DELETE ---
  async remove(id: string) {
    const complaint = await this.findOne(id);

    // Business Rule: Prevent deletion of resolved/closed complaints to maintain history
    if (
      complaint.status === ComplaintStatus.RESOLVED ||
      complaint.status === ComplaintStatus.CLOSED
    ) {
      throw new BadRequestException(
        `Cannot delete a ${complaint.status} complaint.`,
      );
    }

    return this.prisma.complaint.delete({
      where: { id },
    });
  }

  /**
   * Create an invoice for a complaint (e.g., damage fine).
   */
  async createInvoiceForComplaint(
    complaintId: string,
    amount: number,
    dueDate: Date,
    type: InvoiceType = InvoiceType.FINE,
  ) {
    const complaint = await this.findOne(complaintId);
    if (!complaint)
      throw new NotFoundException(`Complaint ${complaintId} not found`);

    // Resolve primary resident: prefer explicit reporterId, otherwise find primary resident on the unit
    let residentId: string | undefined = complaint.reporterId;
    const unitId = complaint.unitId ?? complaint.unit?.id;

    if (!unitId)
      throw new BadRequestException('Complaint has no associated unit.');

    if (!residentId) {
      const unit = await this.prisma.unit.findUnique({
        where: { id: unitId },
        include: {
          residents: {
            where: { isPrimary: true },
            select: { residentId: true },
            take: 1,
          },
        },
      });
      residentId = unit?.residents?.[0]?.residentId;
    }

    const invoice = await this.invoicesService.generateInvoice({
      unitId,
      residentId,
      amount,
      dueDate,
      type,
      sources: { complaintIds: [complaintId] },
    });

    return invoice;
  }

  // --- 6. Helper: Change Status (Optional dedicated route for status quick updates) ---
  async updateStatus(
    id: string,
    status: ComplaintStatus,
    resolutionNotes?: string,
  ) {
    await this.findOne(id);

    // Enforce business rule for closing/resolving
    if (
      (status === ComplaintStatus.RESOLVED ||
        status === ComplaintStatus.CLOSED) &&
      !resolutionNotes
    ) {
      throw new BadRequestException(
        'Resolution notes are required to transition to RESOLVED or CLOSED status.',
      );
    }

    const dataToUpdate: any = { status, resolutionNotes };
    dataToUpdate.resolvedAt = this.getResolutionTimestamp(status);

    return this.prisma.complaint.update({
      where: { id },
      data: dataToUpdate,
    });
  }
}
