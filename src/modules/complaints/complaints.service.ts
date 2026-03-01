import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateComplaintDto, UpdateComplaintDto } from './dto/complaints.dto';
import { ComplaintsQueryDto } from './dto/complaints-query.dto';
import { CreateComplaintCommentDto } from './dto/create-complaint-comment.dto';
import {
  ComplaintStatus,
  Priority,
  InvoiceType,
  Channel,
  Audience,
  NotificationType,
} from '@prisma/client';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../common/utils/pagination.util';
import { getActiveUnitAccess } from '../../common/utils/unit-access.util';

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private invoicesService: InvoicesService,
    private readonly notificationsService: NotificationsService,
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
  async create(dto: CreateComplaintDto & { reporterId: string }) {
    return this.createInternal(dto, { enforceUnitAccess: true });
  }

  private canViewAllOrManage(permissions: string[] = []) {
    return (
      permissions.includes('complaint.view_all') ||
      permissions.includes('complaint.manage')
    );
  }

  async createForAdmin(
    dto: CreateComplaintDto,
    ctx: { actorUserId?: string } = {},
  ) {
    const reporterId = dto.reporterId ?? ctx.actorUserId;
    if (!reporterId) {
      throw new BadRequestException(
        'reporterId is required for admin complaint creation',
      );
    }

    return this.createInternal(
      {
        ...dto,
        reporterId,
      },
      { enforceUnitAccess: false },
    );
  }

  private async createInternal(
    dto: CreateComplaintDto & { reporterId: string },
    options: { enforceUnitAccess: boolean },
  ) {
    // Resident flow checks active unit access; admin flow can bypass this.
    if (options.enforceUnitAccess && dto.unitId) {
      await getActiveUnitAccess(this.prisma, dto.reporterId, dto.unitId);
    }

    const complaintNumber = await this.generateComplaintNumber();
    const { attachmentIds = [], ...complaintData } = dto;
    const normalizedCategory =
      dto.category?.trim() || dto.team?.trim() || 'GENERAL';
    const normalizedTitle =
      dto.title?.trim() || dto.description?.trim().slice(0, 120) || 'Complaint';
    const normalizedTeam = dto.team?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      // Create the complaint
      const complaint = await tx.complaint.create({
        data: {
          ...complaintData,
          title: normalizedTitle,
          team: normalizedTeam,
          category: normalizedCategory,
          complaintNumber,
          status: ComplaintStatus.NEW, // Default status from schema
          priority: dto.priority || Priority.MEDIUM, // Use provided priority or MEDIUM default
        },
      });

      // Create attachments if provided
      if (attachmentIds.length > 0) {
        const attachmentsData = attachmentIds.map((fileId) => ({
          fileId: fileId,
          entityId: complaint.id,
          entity: 'COMPLAINT',
        }));
        await tx.attachment.createMany({
          data: attachmentsData,
          skipDuplicates: true,
        });
      }

      return complaint;
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

  async findMine(reporterId: string) {
    return this.prisma.complaint.findMany({
      where: { reporterId },
      include: {
        unit: { select: { id: true, unitNumber: true, block: true, projectName: true } },
        assignedTo: { select: { id: true, nameEN: true, nameAR: true } },
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

  async findOneForActor(
    id: string,
    ctx: { actorUserId: string; permissions: string[] },
  ) {
    const complaint = await this.findOne(id);

    const canViewAll = ctx.permissions.includes('complaint.view_all');
    if (canViewAll) return complaint;

    if (complaint.reporterId !== ctx.actorUserId) {
      throw new ForbiddenException('You do not have access to this complaint');
    }

    return complaint;
  }

  async listCommentsForActor(
    complaintId: string,
    ctx: { actorUserId: string; permissions: string[] },
  ) {
    await this.findOneForActor(complaintId, ctx);
    const canViewInternal = this.canViewAllOrManage(ctx.permissions);

    return this.prisma.complaintComment.findMany({
      where: {
        complaintId,
        ...(canViewInternal ? {} : { isInternal: false }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addCommentForActor(
    complaintId: string,
    dto: CreateComplaintCommentDto,
    ctx: { actorUserId: string; permissions: string[] },
  ) {
    const complaint = await this.findOneForActor(complaintId, ctx);
    const canUseInternal = this.canViewAllOrManage(ctx.permissions);

    if (dto.isInternal && !canUseInternal) {
      throw new ForbiddenException('Internal comments are allowed for staff only');
    }

    const createdComment = await this.prisma.complaintComment.create({
      data: {
        complaintId: complaint.id,
        createdById: ctx.actorUserId,
        body: dto.body.trim(),
        isInternal: Boolean(dto.isInternal && canUseInternal),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            nameEN: true,
            nameAR: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const isStaffPublicReply =
      this.canViewAllOrManage(ctx.permissions) && !createdComment.isInternal;
    if (isStaffPublicReply && complaint.reporterId) {
      await this.sendComplaintNotification({
        reporterId: complaint.reporterId,
        complaintId: complaint.id,
        title: `Update on complaint ${complaint.complaintNumber ?? complaint.id.slice(0, 8)}`,
        messageEn: createdComment.body.trim(),
        eventKey: 'complaint.commented',
      });
    }

    return createdComment;
  }

  // --- 4. UPDATE (Handles all patching, including status and assignedToId) ---
  async update(id: string, dto: UpdateComplaintDto) {
    const complaint = await this.findOne(id);

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
    const previousStatus = complaint.status;
    const updated = await this.prisma.complaint.update({
      where: { id },
      data: dataToUpdate,
    });

    if (updated.reporterId && previousStatus !== updated.status) {
      await this.sendComplaintNotification({
        reporterId: updated.reporterId,
        complaintId: updated.id,
        title: `Complaint ${updated.complaintNumber ?? updated.id.slice(0, 8)} status updated`,
        messageEn: `Your complaint status is now ${String(updated.status).replaceAll('_', ' ')}.`,
        eventKey: 'complaint.status_changed',
      });
    }

    return updated;
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

  async removeForActor(
    id: string,
    ctx: { actorUserId: string; permissions: string[] },
  ) {
    const complaint = await this.findOne(id);

    const canDeleteAll = ctx.permissions.includes('complaint.delete_all');
    if (!canDeleteAll && complaint.reporterId !== ctx.actorUserId) {
      throw new ForbiddenException('You do not have access to this complaint');
    }

    return this.remove(id);
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

    const updated = await this.prisma.complaint.update({
      where: { id },
      data: dataToUpdate,
    });

    if (updated.reporterId) {
      await this.sendComplaintNotification({
        reporterId: updated.reporterId,
        complaintId: updated.id,
        title: `Complaint ${updated.complaintNumber ?? updated.id.slice(0, 8)} status updated`,
        messageEn: `Your complaint status is now ${String(updated.status).replaceAll('_', ' ')}.`,
        eventKey: 'complaint.status_changed',
      });
    }

    return updated;
  }

  private async sendComplaintNotification(params: {
    reporterId: string;
    complaintId: string;
    title: string;
    messageEn: string;
    eventKey: string;
  }) {
    try {
      await this.notificationsService.sendNotification({
        type: NotificationType.ANNOUNCEMENT,
        title: params.title,
        messageEn: params.messageEn,
        channels: [Channel.IN_APP, Channel.PUSH],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [params.reporterId] },
        payload: {
          route: '/complaints',
          entityType: 'COMPLAINT',
          entityId: params.complaintId,
          eventKey: params.eventKey,
        },
      });
    } catch {
      // Notifications must not break complaint workflow mutations.
    }
  }
}
