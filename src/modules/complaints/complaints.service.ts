import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Audience,
  Channel,
  ComplaintStatus,
  NotificationType,
  Prisma,
  Priority,
  type Complaint,
  type ComplaintCategory,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AddCommentDto } from './dto/add-comment.dto';
import {
  CheckSlaBreachesResponseDto,
  ComplaintDetailAttachmentDto,
  ComplaintDetailCommentDto,
  ComplaintDetailDto,
  ComplaintDetailInvoiceDto,
  ComplaintListItemDto,
  ComplaintListResponseDto,
  ComplaintSlaStatus,
  ComplaintStatsByCategoryDto,
  ComplaintStatsDto,
} from './dto/complaint-response.dto';
import { ComplaintsQueryDto } from './dto/complaints-query.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';

const OPEN_COMPLAINT_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.NEW,
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.PENDING_RESIDENT,
];

type ComplaintListRecord = Prisma.ComplaintGetPayload<{
  include: {
    category: { select: { id: true; name: true; slaHours: true } };
    unit: { select: { id: true; unitNumber: true } };
    reporter: { select: { id: true; nameEN: true; nameAR: true; email: true } };
    assignedTo: { select: { id: true; nameEN: true; nameAR: true; email: true } };
  };
}>;

type ComplaintDetailRecord = Prisma.ComplaintGetPayload<{
  include: {
    category: { select: { id: true; name: true; slaHours: true } };
    unit: { select: { id: true; unitNumber: true } };
    reporter: { select: { id: true; nameEN: true; nameAR: true; phone: true; email: true } };
    assignedTo: { select: { id: true; nameEN: true; nameAR: true; email: true } };
    comments: {
      include: {
        createdBy: { select: { id: true; nameEN: true; nameAR: true; email: true } };
      };
    };
    invoices: {
      select: {
        id: true;
        invoiceNumber: true;
        amount: true;
        type: true;
        status: true;
        dueDate: true;
      };
    };
  };
}>;

type ComplaintCommentRecord = Prisma.ComplaintCommentGetPayload<{
  include: {
    createdBy: { select: { id: true; nameEN: true; nameAR: true; email: true } };
  };
}>;

@Injectable()
export class ComplaintsService {
  private readonly logger = new Logger(ComplaintsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async recordStatusChange(
    entityId: string,
    fromStatus: string | null,
    toStatus: string,
    changedById: string,
    note?: string,
  ): Promise<void> {
    await this.prisma.statusHistory.create({
      data: {
        entityType: 'COMPLAINT',
        entityId,
        fromStatus,
        toStatus,
        changedById,
        note: note?.trim() || null,
      },
    });
  }

  async getStatusHistory(complaintId: string) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true },
    });
    if (!complaint) {
      throw new NotFoundException(`Complaint ${complaintId} not found`);
    }

    return this.prisma.statusHistory.findMany({
      where: { entityType: 'COMPLAINT', entityId: complaintId },
      include: {
        changedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private toUserName(input: {
    nameEN: string | null;
    nameAR: string | null;
    email?: string | null;
  }): string {
    return input.nameEN ?? input.nameAR ?? input.email ?? 'Unknown User';
  }

  private toSlaStatus(complaint: Complaint): ComplaintSlaStatus {
    if (
      complaint.status === ComplaintStatus.RESOLVED ||
      complaint.status === ComplaintStatus.CLOSED
    ) {
      return 'RESOLVED';
    }

    if (!complaint.slaDeadline) {
      return 'NO_SLA';
    }

    const now = new Date();
    if (complaint.slaBreachedAt || complaint.slaDeadline.getTime() < now.getTime()) {
      return 'BREACHED';
    }

    return 'ON_TRACK';
  }

  private toHoursRemaining(complaint: Complaint): number | null {
    const status = this.toSlaStatus(complaint);
    if (!complaint.slaDeadline || status === 'NO_SLA' || status === 'RESOLVED') {
      return null;
    }

    const nowMs = Date.now();
    const deadlineMs = complaint.slaDeadline.getTime();
    const diffHours = Math.ceil(Math.abs(deadlineMs - nowMs) / (1000 * 60 * 60));

    return status === 'BREACHED' ? -diffHours : diffHours;
  }

  private toComplaintListItem(complaint: ComplaintListRecord): ComplaintListItemDto {
    return {
      id: complaint.id,
      complaintNumber: complaint.complaintNumber,
      title: complaint.title,
      categoryName: complaint.category?.name ?? complaint.categoryLegacy ?? null,
      unitNumber: complaint.unit?.unitNumber ?? null,
      reporterName: this.toUserName(complaint.reporter),
      assigneeName: complaint.assignedTo ? this.toUserName(complaint.assignedTo) : null,
      priority: complaint.priority,
      status: complaint.status,
      slaStatus: this.toSlaStatus(complaint),
      hoursRemaining: this.toHoursRemaining(complaint),
      createdAt: complaint.createdAt.toISOString(),
    };
  }

  private toCommentDto(comment: ComplaintCommentRecord): ComplaintDetailCommentDto {
    return {
      id: comment.id,
      body: comment.body,
      isInternal: comment.isInternal,
      authorId: comment.createdBy.id,
      authorName: this.toUserName(comment.createdBy),
      createdAt: comment.createdAt.toISOString(),
    };
  }

  private toInvoiceDto(
    invoice: ComplaintDetailRecord['invoices'][number],
  ): ComplaintDetailInvoiceDto {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      type: invoice.type,
      status: invoice.status,
      dueDate: invoice.dueDate.toISOString(),
    };
  }

  private async fetchAttachments(
    complaintId: string,
  ): Promise<ComplaintDetailAttachmentDto[]> {
    const rows = await this.prisma.attachment.findMany({
      where: { entity: 'COMPLAINT', entityId: complaintId },
      include: { file: { select: { id: true, name: true, mimeType: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.file.id,
      fileName: r.file.name,
      mimeType: r.file.mimeType,
      url: `/files/${r.file.id}/stream`,
    }));
  }

  private async toDetailDto(complaint: ComplaintDetailRecord): Promise<ComplaintDetailDto> {
    const hoursRemaining = this.toHoursRemaining(complaint);

    return {
      id: complaint.id,
      complaintNumber: complaint.complaintNumber,
      title: complaint.title,
      description: complaint.description,
      priority: complaint.priority,
      status: complaint.status,
      categoryId: complaint.categoryId,
      categoryName: complaint.category?.name ?? complaint.categoryLegacy ?? null,
      categorySlaHours: complaint.category?.slaHours ?? null,
      unitId: complaint.unitId,
      unitNumber: complaint.unit?.unitNumber ?? null,
      reporterId: complaint.reporterId,
      reporterName: this.toUserName(complaint.reporter),
      assigneeId: complaint.assignedToId,
      assigneeName: complaint.assignedTo ? this.toUserName(complaint.assignedTo) : null,
      resolutionNotes: complaint.resolutionNotes,
      resolvedAt: this.toIso(complaint.resolvedAt),
      closedAt: this.toIso(complaint.closedAt),
      slaDeadline: this.toIso(complaint.slaDeadline),
      slaBreachedAt: this.toIso(complaint.slaBreachedAt),
      hoursRemaining: hoursRemaining && hoursRemaining > 0 ? hoursRemaining : null,
      hoursOverdue:
        hoursRemaining && hoursRemaining < 0 ? Math.abs(hoursRemaining) : null,
      createdAt: complaint.createdAt.toISOString(),
      updatedAt: complaint.updatedAt.toISOString(),
      comments: complaint.comments
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((item) => this.toCommentDto(item)),
      invoices: complaint.invoices.map((item) => this.toInvoiceDto(item)),
      attachments: await this.fetchAttachments(complaint.id),
    };
  }

  private async generateComplaintNumber(): Promise<string> {
    const lastComplaint = await this.prisma.complaint.findFirst({
      select: { complaintNumber: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastComplaint) {
      return 'CMP-00001';
    }

    const numericPart = Number.parseInt(lastComplaint.complaintNumber.slice(4), 10);
    const nextNumber = Number.isNaN(numericPart) ? 1 : numericPart + 1;
    return `CMP-${nextNumber.toString().padStart(5, '0')}`;
  }

  private async getComplaintById(id: string): Promise<ComplaintDetailRecord> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slaHours: true },
        },
        unit: {
          select: { id: true, unitNumber: true },
        },
        reporter: {
          select: { id: true, nameEN: true, nameAR: true, phone: true, email: true },
        },
        assignedTo: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
        comments: {
          include: {
            createdBy: {
              select: { id: true, nameEN: true, nameAR: true, email: true },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            type: true,
            status: true,
            dueDate: true,
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }

    return complaint;
  }

  async listMyComplaints(userId: string): Promise<ComplaintListItemDto[]> {
    const rows = await this.prisma.complaint.findMany({
      where: { reporterId: userId },
      include: {
        category: { select: { id: true, name: true, slaHours: true } },
        unit: { select: { id: true, unitNumber: true } },
        reporter: { select: { id: true, nameEN: true, nameAR: true, email: true } },
        assignedTo: { select: { id: true, nameEN: true, nameAR: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.toComplaintListItem(row));
  }

  async listComments(complaintId: string): Promise<ComplaintDetailCommentDto[]> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${complaintId} not found`);
    }

    const comments = await this.prisma.complaintComment.findMany({
      where: { complaintId },
      include: {
        createdBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((comment) => this.toCommentDto(comment));
  }

  async deleteComplaint(id: string, userId: string): Promise<void> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: { id: true, reporterId: true, status: true },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }

    if (complaint.reporterId !== userId) {
      throw new BadRequestException('You can only delete your own complaints');
    }

    if (complaint.status !== ComplaintStatus.NEW) {
      throw new BadRequestException('Only complaints with status NEW can be deleted');
    }

    await this.prisma.complaint.delete({ where: { id } });
  }

  async listComplaints(filters: ComplaintsQueryDto): Promise<ComplaintListResponseDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const now = new Date();

    const search = filters.search?.trim();
    const where: Prisma.ComplaintWhereInput = {
      status: filters.status,
      categoryId: filters.categoryId,
      priority: filters.priority,
      assignedToId: filters.assignedToId,
      unitId: filters.unitId,
      reporterId: filters.reporterId,
      createdAt:
        filters.dateFrom || filters.dateTo
          ? {
              gte: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
              lte: filters.dateTo ? new Date(filters.dateTo) : undefined,
            }
          : undefined,
    };

    if (search) {
      where.OR = [
        { complaintNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { reporter: { nameEN: { contains: search, mode: 'insensitive' } } },
        { reporter: { nameAR: { contains: search, mode: 'insensitive' } } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (typeof filters.slaBreached === 'boolean') {
      const breachedCondition: Prisma.ComplaintWhereInput = {
        OR: [
          { slaBreachedAt: { not: null } },
          {
            AND: [
              { status: { in: OPEN_COMPLAINT_STATUSES } },
              { slaDeadline: { lt: now } },
            ],
          },
        ],
      };

      const andConditions = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];

      where.AND = filters.slaBreached
        ? [...andConditions, breachedCondition]
        : [...andConditions, { NOT: breachedCondition }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.complaint.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, slaHours: true } },
          unit: { select: { id: true, unitNumber: true } },
          reporter: { select: { id: true, nameEN: true, nameAR: true, email: true } },
          assignedTo: { select: { id: true, nameEN: true, nameAR: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toComplaintListItem(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getComplaintDetail(id: string): Promise<ComplaintDetailDto> {
    const complaint = await this.getComplaintById(id);
    return this.toDetailDto(complaint);
  }

  async createComplaint(
    dto: CreateComplaintDto,
    reporterId: string,
  ): Promise<ComplaintDetailDto> {
    const unitExists = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true },
    });
    if (!unitExists) {
      throw new BadRequestException('Unit not found');
    }

    let category: (ComplaintCategory & { defaultAssigneeId: string | null }) | null = null;
    if (dto.categoryId) {
      category = await this.prisma.complaintCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Complaint category not found');
      }
      if (!category.isActive) {
        throw new BadRequestException('Complaint category is inactive');
      }
    }

    const now = new Date();
    const slaDeadline = category
      ? new Date(now.getTime() + category.slaHours * 60 * 60 * 1000)
      : null;
    const complaintNumber = await this.generateComplaintNumber();

    // Auto-assign from category default assignee
    const assignedToId = category?.defaultAssigneeId ?? null;
    const initialStatus = assignedToId
      ? ComplaintStatus.IN_PROGRESS
      : ComplaintStatus.NEW;

    const created = await this.prisma.complaint.create({
      data: {
        complaintNumber,
        title: dto.title?.trim() || null,
        team: category?.name ?? null,
        reporterId,
        unitId: dto.unitId,
        categoryId: dto.categoryId ?? null,
        categoryLegacy: category?.name ?? null,
        description: dto.description.trim(),
        priority: dto.priority ?? Priority.MEDIUM,
        status: initialStatus,
        slaDeadline,
        assignedToId,
      },
      select: { id: true },
    });

    await this.recordStatusChange(created.id, null, initialStatus, reporterId);

    // Store attachments via the polymorphic Attachment table
    if (dto.attachmentIds && dto.attachmentIds.length > 0) {
      await this.prisma.attachment.createMany({
        data: dto.attachmentIds.map((fileId) => ({
          fileId,
          entityId: created.id,
          entity: 'COMPLAINT',
        })),
      });
    }

    return this.getComplaintDetail(created.id);
  }

  async updateComplaint(
    id: string,
    dto: UpdateComplaintDto,
  ): Promise<ComplaintDetailDto> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }

    const updateData: Prisma.ComplaintUpdateInput = {};

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.complaintCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('Complaint category not found');
      }
      if (!category.isActive) {
        throw new BadRequestException('Complaint category is inactive');
      }
      updateData.category = { connect: { id: dto.categoryId } };
      updateData.categoryLegacy = category.name;
      updateData.team = category.name;

      // Recalculate SLA deadline if complaint is still open and has no SLA yet
      if (OPEN_COMPLAINT_STATUSES.includes(complaint.status)) {
        const now = new Date();
        updateData.slaDeadline = new Date(now.getTime() + category.slaHours * 60 * 60 * 1000);
      }
    }

    if (dto.title !== undefined) {
      updateData.title = dto.title.trim() || null;
    }

    if (dto.priority !== undefined) {
      updateData.priority = dto.priority;
    }

    await this.prisma.complaint.update({
      where: { id },
      data: updateData,
    });

    return this.getComplaintDetail(id);
  }

  async assignComplaint(
    id: string,
    assignedToId: string,
    adminId: string,
  ): Promise<ComplaintDetailDto> {
    const [complaint, assignee] = await Promise.all([
      this.prisma.complaint.findUnique({
        where: { id },
        select: { id: true, status: true },
      }),
      this.prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true },
      }),
    ]);

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }
    if (!assignee) {
      throw new BadRequestException('Assigned user not found');
    }
    if (!adminId) {
      throw new BadRequestException('Invalid admin context');
    }

    const shouldMoveToInProgress = complaint.status === ComplaintStatus.NEW;

    await this.prisma.complaint.update({
      where: { id },
      data: {
        assignedToId,
        ...(shouldMoveToInProgress ? { status: ComplaintStatus.IN_PROGRESS } : {}),
      },
    });

    if (shouldMoveToInProgress) {
      await this.recordStatusChange(
        id,
        ComplaintStatus.NEW,
        ComplaintStatus.IN_PROGRESS,
        adminId,
        'Auto-transitioned after assignment',
      );
    }

    // Notify the assigned user
    this.notificationsService
      .sendNotification({
        type: NotificationType.ANNOUNCEMENT,
        title: 'Complaint Assigned to You',
        messageEn: `You have been assigned complaint #${id.slice(0, 8)}. Please review and take action.`,
        channels: [Channel.IN_APP, Channel.PUSH],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [assignedToId] },
        payload: { route: '#complaints', entityType: 'COMPLAINT', entityId: id },
      })
      .catch((err) =>
        this.logger.error(`Assignment notification failed for complaint ${id}`, err),
      );

    return this.getComplaintDetail(id);
  }

  async updateStatus(
    id: string,
    status: ComplaintStatus,
    resolutionNotes?: string,
    changedById?: string,
  ): Promise<ComplaintDetailDto> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        complaintNumber: true,
        title: true,
        status: true,
        assignedToId: true,
        reporterId: true,
        resolvedAt: true,
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }

    const currentStatus = complaint.status;
    const trimmedResolutionNotes = resolutionNotes?.trim();
    const isDirectClose = status === ComplaintStatus.CLOSED;

    const VALID_TRANSITIONS: Partial<Record<ComplaintStatus, ComplaintStatus[]>> = {
      [ComplaintStatus.NEW]: [ComplaintStatus.IN_PROGRESS],
      [ComplaintStatus.IN_PROGRESS]: [ComplaintStatus.PENDING_RESIDENT, ComplaintStatus.RESOLVED],
      [ComplaintStatus.PENDING_RESIDENT]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED],
    };

    if (!isDirectClose) {
      const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(status)) {
        throw new BadRequestException(
          `Invalid complaint status transition: ${currentStatus} -> ${status}`,
        );
      }

      if (status === ComplaintStatus.IN_PROGRESS && currentStatus === ComplaintStatus.NEW) {
        if (!complaint.assignedToId) {
          throw new BadRequestException(
            'Complaint must be assigned before marking IN_PROGRESS',
          );
        }
      }

      if (status === ComplaintStatus.RESOLVED) {
        if (!trimmedResolutionNotes) {
          throw new BadRequestException(
            'resolutionNotes is required when moving to RESOLVED',
          );
        }
      }
    }

    const now = new Date();
    const updateData: Prisma.ComplaintUpdateInput = {
      status,
      resolutionNotes: trimmedResolutionNotes ?? undefined,
    };

    if (status === ComplaintStatus.RESOLVED) {
      updateData.resolvedAt = now;
    }

    if (status === ComplaintStatus.CLOSED) {
      updateData.closedAt = now;
      if (!complaint.resolvedAt) {
        updateData.resolvedAt = now;
      }
    }

    await this.prisma.complaint.update({
      where: { id },
      data: updateData,
    });

    if (changedById) {
      await this.recordStatusChange(id, currentStatus, status, changedById, resolutionNotes);
    }

    // Notify reporter when resolved or closed
    if (
      (status === ComplaintStatus.RESOLVED || status === ComplaintStatus.CLOSED) &&
      complaint.reporterId
    ) {
      const label = status === ComplaintStatus.RESOLVED ? 'Resolved' : 'Closed';
      this.notificationsService
        .sendNotification({
          type: NotificationType.ANNOUNCEMENT,
          title: `Complaint ${label}`,
          messageEn: `Your complaint "${complaint.title ?? complaint.complaintNumber}" has been ${label.toLowerCase()}.${trimmedResolutionNotes ? ` Note: ${trimmedResolutionNotes}` : ''}`,
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [complaint.reporterId] },
          payload: { route: '#complaints', entityType: 'COMPLAINT', entityId: id },
        })
        .catch((err) =>
          this.logger.error(`Complaint status notification failed for ${id}`, err),
        );
    }

    return this.getComplaintDetail(id);
  }

  async returnToResident(
    id: string,
    message: string,
    adminId: string,
  ): Promise<ComplaintDetailDto> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      select: {
        id: true,
        complaintNumber: true,
        title: true,
        status: true,
        reporterId: true,
      },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${id} not found`);
    }

    if (complaint.status !== ComplaintStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Complaint must be IN_PROGRESS to return to resident (current: ${complaint.status})`,
      );
    }

    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      throw new BadRequestException('A message to the resident is required');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.complaint.update({
        where: { id },
        data: { status: ComplaintStatus.PENDING_RESIDENT },
      });

      await tx.complaintComment.create({
        data: {
          complaintId: id,
          createdById: adminId,
          body: trimmedMessage,
          isInternal: false,
        },
      });

      await tx.statusHistory.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: id,
          fromStatus: complaint.status,
          toStatus: ComplaintStatus.PENDING_RESIDENT,
          changedById: adminId,
          note: trimmedMessage,
        },
      });
    });

    // Notify resident
    if (complaint.reporterId) {
      this.notificationsService
        .sendNotification({
          type: NotificationType.ANNOUNCEMENT,
          title: 'Action Required on Your Complaint',
          messageEn: `Your complaint "${complaint.title ?? complaint.complaintNumber}" requires your attention. Message from support: ${trimmedMessage}`,
          channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [complaint.reporterId] },
          payload: { route: '#complaints', entityType: 'COMPLAINT', entityId: id },
        })
        .catch((err) =>
          this.logger.error(`Return-to-resident notification failed for ${id}`, err),
        );
    }

    return this.getComplaintDetail(id);
  }

  async addComment(
    complaintId: string,
    dto: AddCommentDto,
    authorId: string,
  ): Promise<ComplaintDetailCommentDto> {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, complaintNumber: true, title: true, reporterId: true, assignedToId: true },
    });

    if (!complaint) {
      throw new NotFoundException(`Complaint ${complaintId} not found`);
    }

    const isInternal = dto.isInternal ?? false;

    const created = await this.prisma.complaintComment.create({
      data: {
        complaintId,
        createdById: authorId,
        body: dto.body.trim(),
        isInternal,
      },
      include: {
        createdBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
      },
    });

    // Notify reporter + assignee (skip internal notes for reporter, skip self)
    if (!isInternal) {
      const recipientIds = new Set<string>();
      if (complaint.reporterId && complaint.reporterId !== authorId) {
        recipientIds.add(complaint.reporterId);
      }
      if (complaint.assignedToId && complaint.assignedToId !== authorId) {
        recipientIds.add(complaint.assignedToId);
      }
      if (recipientIds.size > 0) {
        this.notificationsService
          .sendNotification({
            type: NotificationType.ANNOUNCEMENT,
            title: 'New Comment on Complaint',
            messageEn: `A new comment was posted on complaint "${complaint.title ?? complaint.complaintNumber}".`,
            channels: [Channel.IN_APP, Channel.PUSH],
            targetAudience: Audience.SPECIFIC_RESIDENCES,
            audienceMeta: { userIds: [...recipientIds] },
            payload: { route: '#complaints', entityType: 'COMPLAINT', entityId: complaintId },
          })
          .catch((err) =>
            this.logger.error(`Comment notification failed for complaint ${complaintId}`, err),
          );
      }
    }

    return this.toCommentDto(created);
  }

  async checkSlaBreaches(): Promise<CheckSlaBreachesResponseDto> {
    const now = new Date();
    const result = await this.prisma.complaint.updateMany({
      where: {
        status: { in: OPEN_COMPLAINT_STATUSES },
        slaDeadline: { lt: now },
        slaBreachedAt: null,
      },
      data: {
        slaBreachedAt: now,
      },
    });

    return { breachCount: result.count };
  }

  async getComplaintStats(): Promise<ComplaintStatsDto> {
    const [total, open, resolved, closed, slaBreached, groupedStatus, groupedPriority] =
      await Promise.all([
        this.prisma.complaint.count(),
        this.prisma.complaint.count({
          where: { status: { in: OPEN_COMPLAINT_STATUSES } },
        }),
        this.prisma.complaint.count({
          where: { status: ComplaintStatus.RESOLVED },
        }),
        this.prisma.complaint.count({
          where: { status: ComplaintStatus.CLOSED },
        }),
        this.prisma.complaint.count({
          where: {
            slaBreachedAt: { not: null },
            status: { not: ComplaintStatus.CLOSED },
          },
        }),
        this.prisma.complaint.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        this.prisma.complaint.groupBy({
          by: ['priority'],
          _count: { priority: true },
        }),
      ]);

    const resolutionSamples = await this.prisma.complaint.findMany({
      where: {
        status: { in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] },
        resolvedAt: { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
    });

    const groupedCategories = await this.prisma.complaint.groupBy({
      by: ['categoryId'],
      _count: { _all: true },
    });

    const categoryIds = groupedCategories
      .map((item) => item.categoryId)
      .filter((value): value is string => typeof value === 'string');

    const categories = categoryIds.length
      ? await this.prisma.complaintCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];

    const categoryNameById = new Map(categories.map((item) => [item.id, item.name]));

    const byCategory: ComplaintStatsByCategoryDto[] = groupedCategories.map((item) => ({
      categoryId: item.categoryId,
      name:
        (item.categoryId ? categoryNameById.get(item.categoryId) : undefined) ??
        'Uncategorized',
      count: item._count._all,
    }));

    const byStatus: Record<ComplaintStatus, number> = {
      NEW: 0,
      IN_PROGRESS: 0,
      PENDING_RESIDENT: 0,
      RESOLVED: 0,
      CLOSED: 0,
    };
    for (const row of groupedStatus) {
      byStatus[row.status] = row._count.status;
    }

    const byPriority: Record<Priority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const row of groupedPriority) {
      byPriority[row.priority] = row._count.priority;
    }

    const avgResolutionHoursRaw =
      resolutionSamples.length === 0
        ? 0
        : resolutionSamples.reduce((sum, row) => {
            const resolvedAt = row.resolvedAt ?? row.createdAt;
            const durationHours =
              (resolvedAt.getTime() - row.createdAt.getTime()) / (1000 * 60 * 60);
            return sum + durationHours;
          }, 0) / resolutionSamples.length;

    return {
      total,
      open,
      resolved,
      closed,
      slaBreached,
      avgResolutionHours: Number(avgResolutionHoursRaw.toFixed(2)),
      byPriority,
      byCategory,
      byStatus,
    };
  }
}
