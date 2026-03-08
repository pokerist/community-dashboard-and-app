import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  InvoiceStatus,
  InvoiceType,
  Prisma,
  ViolationActionStatus,
  ViolationActionType,
  ViolationStatus,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ViolationIssuedEvent } from '../../events/contracts/violation-issued.event';
import { ListAppealRequestsQueryDto } from './dto/list-appeal-requests-query.dto';
import { ReviewAppealDto } from './dto/review-appeal.dto';
import {
  ViolationAppealQueueItemDto,
  ViolationAppealQueueResponseDto,
  ViolationDetailActionRequestDto,
  ViolationDetailDto,
  ViolationDetailInvoiceDto,
  ViolationDetailPhotoEvidenceDto,
  ViolationListItemDto,
  ViolationListResponseDto,
  ViolationStatsByCategoryDto,
  ViolationStatsDto,
} from './dto/violation-response.dto';
import { ViolationsQueryDto } from './dto/violations-query.dto';
import { CreateViolationDto } from './dto/create-violation.dto';
import { UpdateViolationDto } from './dto/update-violation.dto';
import { CreateViolationActionDto } from './dto/violation-action.dto';

type ViolationListRecord = Prisma.ViolationGetPayload<{
  include: {
    category: { select: { id: true; name: true } };
    unit: { select: { unitNumber: true } };
    resident: { select: { nameEN: true; nameAR: true; email: true } };
    issuedBy: { select: { nameEN: true; nameAR: true; email: true } };
    actionRequests: { where: { type: 'APPEAL' }; select: { id: true } };
  };
}>;

type ViolationDetailRecord = Prisma.ViolationGetPayload<{
  include: {
    category: { select: { id: true; name: true; description: true } };
    unit: { select: { id: true; unitNumber: true } };
    resident: { select: { id: true; nameEN: true; nameAR: true; phone: true; email: true } };
    issuedBy: { select: { id: true; nameEN: true; nameAR: true; email: true } };
    actionRequests: {
      include: {
        requestedBy: { select: { id: true; nameEN: true; nameAR: true; email: true } };
        reviewedBy: { select: { id: true; nameEN: true; nameAR: true; email: true } };
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

type ViolationAppealQueueRecord = Prisma.ViolationActionRequestGetPayload<{
  include: {
    violation: {
      include: {
        category: { select: { name: true } };
        unit: { select: { unitNumber: true } };
        resident: { select: { nameEN: true; nameAR: true; email: true } };
      };
    };
  };
}>;

@Injectable()
export class ViolationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private toUserName(input: {
    nameEN: string | null;
    nameAR: string | null;
    email?: string | null;
  }): string {
    return input.nameEN ?? input.nameAR ?? input.email ?? 'Unknown User';
  }

  private toIso(value: Date | null): string | null {
    return value ? value.toISOString() : null;
  }

  private toViolationListItem(row: ViolationListRecord): ViolationListItemDto {
    return {
      id: row.id,
      violationNumber: row.violationNumber,
      categoryName: row.category?.name ?? row.typeLegacy ?? null,
      unitNumber: row.unit.unitNumber,
      residentName: row.resident ? this.toUserName(row.resident) : null,
      issuerName: row.issuedBy ? this.toUserName(row.issuedBy) : null,
      fineAmount: Number(row.fineAmount),
      status: row.status,
      hasAppeal: row.actionRequests.length > 0 || row.appealStatus !== null,
      appealStatus: row.appealStatus,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toActionRequestDto(
    row: ViolationDetailRecord['actionRequests'][number],
  ): ViolationDetailActionRequestDto {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      note: row.note,
      attachmentIds: row.attachmentIds,
      rejectionReason: row.rejectionReason,
      requestedById: row.requestedById,
      requestedByName: this.toUserName(row.requestedBy),
      reviewedById: row.reviewedById,
      reviewedByName: row.reviewedBy ? this.toUserName(row.reviewedBy) : null,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: this.toIso(row.reviewedAt),
    };
  }

  private toInvoiceDto(
    row: ViolationDetailRecord['invoices'][number],
  ): ViolationDetailInvoiceDto {
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      amount: Number(row.amount),
      type: row.type,
      status: row.status,
      dueDate: row.dueDate.toISOString(),
    };
  }

  private async toPhotoEvidenceDto(
    photoEvidenceIds: string[],
  ): Promise<ViolationDetailPhotoEvidenceDto[]> {
    if (photoEvidenceIds.length === 0) {
      return [];
    }

    const files = await this.prisma.file.findMany({
      where: { id: { in: photoEvidenceIds } },
      select: { id: true, name: true, mimeType: true },
    });
    const fileById = new Map(files.map((file) => [file.id, file]));

    return photoEvidenceIds.map((fileId) => {
      const file = fileById.get(fileId);
      return {
        id: fileId,
        fileName: file?.name ?? null,
        mimeType: file?.mimeType ?? null,
        url: `/files/${fileId}/stream`,
      };
    });
  }

  private async toViolationDetailDto(
    row: ViolationDetailRecord,
  ): Promise<ViolationDetailDto> {
    return {
      id: row.id,
      violationNumber: row.violationNumber,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? row.typeLegacy ?? null,
      categoryDescription: row.category?.description ?? null,
      description: row.description,
      fineAmount: Number(row.fineAmount),
      status: row.status,
      appealStatus: row.appealStatus,
      appealDeadline: this.toIso(row.appealDeadline),
      closedAt: this.toIso(row.closedAt),
      unitId: row.unitId,
      unitNumber: row.unit.unitNumber,
      residentId: row.residentId,
      residentName: row.resident ? this.toUserName(row.resident) : null,
      issuerId: row.issuedById,
      issuerName: row.issuedBy ? this.toUserName(row.issuedBy) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      photoEvidence: await this.toPhotoEvidenceDto(row.photoEvidenceIds),
      actionRequests: row.actionRequests
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((action) => this.toActionRequestDto(action)),
      invoices: row.invoices.map((invoice) => this.toInvoiceDto(invoice)),
    };
  }

  private async generateViolationNumber(): Promise<string> {
    const lastRow = await this.prisma.violation.findFirst({
      select: { violationNumber: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastRow) {
      return 'VIO-00001';
    }

    const numericPart = Number.parseInt(lastRow.violationNumber.slice(4), 10);
    const nextValue = Number.isNaN(numericPart) ? 1 : numericPart + 1;
    return `VIO-${nextValue.toString().padStart(5, '0')}`;
  }

  private async getViolationById(id: string): Promise<ViolationDetailRecord> {
    const row = await this.prisma.violation.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, description: true },
        },
        unit: {
          select: { id: true, unitNumber: true },
        },
        resident: {
          select: { id: true, nameEN: true, nameAR: true, phone: true, email: true },
        },
        issuedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
        actionRequests: {
          include: {
            requestedBy: {
              select: { id: true, nameEN: true, nameAR: true, email: true },
            },
            reviewedBy: {
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

    if (!row) {
      throw new NotFoundException(`Violation ${id} not found`);
    }
    return row;
  }

  private normalizePhotoEvidenceIds(input?: string[]): string[] {
    if (!input || input.length === 0) {
      return [];
    }
    return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean)));
  }

  private async validateCategory(categoryId?: string): Promise<{
    id: string;
    name: string;
    defaultFineAmount: Prisma.Decimal;
    isActive: boolean;
  } | null> {
    if (!categoryId) {
      return null;
    }

    const category = await this.prisma.violationCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        defaultFineAmount: true,
        isActive: true,
      },
    });
    if (!category) {
      throw new BadRequestException('Violation category not found');
    }
    if (!category.isActive) {
      throw new BadRequestException('Violation category is inactive');
    }
    return category;
  }

  async listMyViolations(userId: string): Promise<ViolationListItemDto[]> {
    const rows = await this.prisma.violation.findMany({
      where: { residentId: userId },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { unitNumber: true } },
        resident: { select: { nameEN: true, nameAR: true, email: true } },
        issuedBy: { select: { nameEN: true, nameAR: true, email: true } },
        actionRequests: {
          where: { type: ViolationActionType.APPEAL },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.toViolationListItem(row));
  }

  async listViolationActions(
    violationId: string,
  ): Promise<ViolationDetailActionRequestDto[]> {
    const violation = await this.prisma.violation.findUnique({
      where: { id: violationId },
      select: { id: true },
    });

    if (!violation) {
      throw new NotFoundException(`Violation ${violationId} not found`);
    }

    const actions = await this.prisma.violationActionRequest.findMany({
      where: { violationId },
      include: {
        requestedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
        reviewedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return actions.map((action) => this.toActionRequestDto(action));
  }

  async submitViolationAction(
    violationId: string,
    dto: CreateViolationActionDto,
    userId: string,
  ): Promise<ViolationDetailActionRequestDto> {
    const violation = await this.prisma.violation.findUnique({
      where: { id: violationId },
      select: { id: true, status: true, appealDeadline: true, residentId: true },
    });

    if (!violation) {
      throw new NotFoundException(`Violation ${violationId} not found`);
    }

    if (violation.status !== ViolationStatus.PENDING) {
      throw new BadRequestException('Violation is not in a state that allows actions');
    }

    if (dto.type === ViolationActionType.APPEAL && violation.appealDeadline) {
      if (new Date() > violation.appealDeadline) {
        throw new BadRequestException('Appeal deadline has passed');
      }
    }

    // Check for existing pending action of same type
    const existingPending = await this.prisma.violationActionRequest.findFirst({
      where: {
        violationId,
        type: dto.type,
        status: ViolationActionStatus.PENDING,
      },
      select: { id: true },
    });

    if (existingPending) {
      throw new BadRequestException(
        `A pending ${dto.type === ViolationActionType.APPEAL ? 'appeal' : 'fix submission'} already exists`,
      );
    }

    const created = await this.prisma.violationActionRequest.create({
      data: {
        violationId,
        type: dto.type,
        note: dto.note?.trim() || null,
        attachmentIds: dto.attachmentIds ?? [],
        status: ViolationActionStatus.PENDING,
        requestedById: userId,
      },
      include: {
        requestedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
        reviewedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
      },
    });

    // Update violation appealStatus if this is an appeal
    if (dto.type === ViolationActionType.APPEAL) {
      await this.prisma.violation.update({
        where: { id: violationId },
        data: { appealStatus: 'PENDING' },
      });
    }

    return this.toActionRequestDto(created);
  }

  async listViolations(filters: ViolationsQueryDto): Promise<ViolationListResponseDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();

    const where: Prisma.ViolationWhereInput = {
      status: filters.status,
      categoryId: filters.categoryId,
      unitId: filters.unitId,
      residentId: filters.residentId,
      issuedById: filters.issuedById,
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
        { violationNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
        { resident: { nameEN: { contains: search, mode: 'insensitive' } } },
        { resident: { nameAR: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (typeof filters.hasAppeal === 'boolean') {
      const appealFilter: Prisma.ViolationWhereInput = {
        actionRequests: {
          some: {
            type: ViolationActionType.APPEAL,
          },
        },
      };

      const andConditions = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = filters.hasAppeal
        ? [...andConditions, appealFilter]
        : [...andConditions, { NOT: appealFilter }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.violation.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          unit: { select: { unitNumber: true } },
          resident: { select: { nameEN: true, nameAR: true, email: true } },
          issuedBy: { select: { nameEN: true, nameAR: true, email: true } },
          actionRequests: {
            where: { type: ViolationActionType.APPEAL },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.violation.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toViolationListItem(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getViolationDetail(id: string): Promise<ViolationDetailDto> {
    const row = await this.getViolationById(id);
    return this.toViolationDetailDto(row);
  }

  async createViolation(
    dto: CreateViolationDto,
    issuedById: string,
  ): Promise<ViolationDetailDto> {
    const [unit, category] = await Promise.all([
      this.prisma.unit.findUnique({
        where: { id: dto.unitId },
        select: { id: true },
      }),
      this.validateCategory(dto.categoryId),
    ]);

    if (!unit) {
      throw new BadRequestException('Unit not found');
    }

    if (dto.residentId) {
      const resident = await this.prisma.user.findUnique({
        where: { id: dto.residentId },
        select: { id: true },
      });
      if (!resident) {
        throw new BadRequestException('Resident not found');
      }
    }

    const now = new Date();
    const appealDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const fineAmount =
      dto.fineAmount !== undefined
        ? dto.fineAmount
        : category
          ? category.defaultFineAmount.toNumber()
          : 0;
    const violationNumber = await this.generateViolationNumber();
    const photoEvidenceIds = this.normalizePhotoEvidenceIds(dto.photoEvidenceIds);

    const created = await this.prisma.$transaction(async (tx) => {
      const violation = await tx.violation.create({
        data: {
          violationNumber,
          unitId: dto.unitId,
          residentId: dto.residentId ?? null,
          categoryId: dto.categoryId ?? null,
          typeLegacy: category?.name ?? null,
          description: dto.description.trim(),
          fineAmount,
          photoEvidenceIds,
          status: ViolationStatus.PENDING,
          issuedById,
          appealDeadline,
        },
        select: { id: true },
      });

      if (fineAmount > 0) {
        await this.invoicesService.generateInvoiceTx(tx, {
          unitId: dto.unitId,
          residentId: dto.residentId,
          type: InvoiceType.FINE,
          amount: fineAmount,
          dueDate: appealDeadline,
          sources: { violationIds: [violation.id] },
          status: InvoiceStatus.PENDING,
        });
      }

      return violation;
    });

    try {
      const recipientUserIds = dto.residentId ? [dto.residentId] : [];
      this.eventEmitter.emit(
        'violation.issued',
        new ViolationIssuedEvent(
          created.id,
          violationNumber,
          dto.unitId,
          recipientUserIds,
          category?.name ?? 'General violation',
          fineAmount,
        ),
      );
    } catch {
      // Notifications must not block violation creation.
    }

    return this.getViolationDetail(created.id);
  }

  async updateViolation(id: string, dto: UpdateViolationDto): Promise<ViolationDetailDto> {
    const violation = await this.prisma.violation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });
    if (!violation) {
      throw new NotFoundException(`Violation ${id} not found`);
    }

    const category = await this.validateCategory(dto.categoryId);

    if (dto.fineAmount !== undefined && violation.status !== ViolationStatus.PENDING) {
      throw new BadRequestException('fineAmount can only be updated while status is PENDING');
    }

    await this.prisma.violation.update({
      where: { id },
      data: {
        description: dto.description?.trim(),
        fineAmount: dto.fineAmount,
        categoryId: dto.categoryId,
        typeLegacy: category?.name,
        photoEvidenceIds:
          dto.photoEvidenceIds === undefined
            ? undefined
            : this.normalizePhotoEvidenceIds(dto.photoEvidenceIds),
      },
    });

    return this.getViolationDetail(id);
  }

  async cancelViolation(id: string, adminId: string): Promise<ViolationDetailDto> {
    if (!adminId) {
      throw new BadRequestException('Invalid admin context');
    }

    const row = await this.prisma.violation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });
    if (!row) {
      throw new NotFoundException(`Violation ${id} not found`);
    }
    if (row.status === ViolationStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid violation');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.violation.update({
        where: { id },
        data: {
          status: ViolationStatus.CANCELLED,
          closedAt: new Date(),
        },
      });

      await tx.invoice.updateMany({
        where: {
          violationId: id,
          type: InvoiceType.FINE,
          status: InvoiceStatus.PENDING,
        },
        data: {
          status: InvoiceStatus.CANCELLED,
        },
      });
    });

    return this.getViolationDetail(id);
  }

  async markAsPaid(id: string): Promise<ViolationDetailDto> {
    const row = await this.prisma.violation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException(`Violation ${id} not found`);
    }

    const paidDate = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.violation.update({
        where: { id },
        data: {
          status: ViolationStatus.PAID,
        },
      });

      await tx.invoice.updateMany({
        where: {
          violationId: id,
          type: InvoiceType.FINE,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
        },
        data: {
          status: InvoiceStatus.PAID,
          paidDate,
        },
      });
    });

    return this.getViolationDetail(id);
  }

  async listAppealRequests(
    filters: ListAppealRequestsQueryDto,
  ): Promise<ViolationAppealQueueResponseDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();

    const where: Prisma.ViolationActionRequestWhereInput = {
      type: ViolationActionType.APPEAL,
      status: filters.status,
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
        {
          violation: {
            violationNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          violation: {
            unit: {
              unitNumber: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          violation: {
            resident: {
              nameEN: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.violationActionRequest.findMany({
        where,
        include: {
          violation: {
            include: {
              category: { select: { name: true } },
              unit: { select: { unitNumber: true } },
              resident: { select: { nameEN: true, nameAR: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.violationActionRequest.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toAppealQueueItemDto(row)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private toAppealQueueItemDto(
    row: ViolationAppealQueueRecord,
  ): ViolationAppealQueueItemDto {
    return {
      actionRequestId: row.id,
      violationId: row.violationId,
      violationNumber: row.violation.violationNumber,
      categoryName: row.violation.category?.name ?? row.violation.typeLegacy ?? null,
      unitNumber: row.violation.unit.unitNumber,
      residentName: row.violation.resident
        ? this.toUserName(row.violation.resident)
        : null,
      fineAmount: Number(row.violation.fineAmount),
      appealNote: row.note,
      submittedAt: row.createdAt.toISOString(),
      status: row.status,
    };
  }

  private async getActionRequestOrThrow(actionRequestId: string) {
    const row = await this.prisma.violationActionRequest.findUnique({
      where: { id: actionRequestId },
      include: {
        violation: {
          select: { id: true },
        },
      },
    });

    if (!row) {
      throw new NotFoundException('Violation action request not found');
    }
    if (row.status !== ViolationActionStatus.PENDING) {
      throw new BadRequestException('Violation action request is no longer pending');
    }

    return row;
  }

  async reviewAppeal(
    actionRequestId: string,
    dto: ReviewAppealDto,
    reviewerUserId: string,
  ): Promise<ViolationDetailDto> {
    const action = await this.getActionRequestOrThrow(actionRequestId);
    if (action.type !== ViolationActionType.APPEAL) {
      throw new BadRequestException('Action request is not an appeal');
    }

    const reason = dto.reason?.trim() || null;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.violationActionRequest.update({
        where: { id: actionRequestId },
        data: {
          status: dto.approved
            ? ViolationActionStatus.APPROVED
            : ViolationActionStatus.REJECTED,
          rejectionReason: dto.approved ? null : reason,
          reviewedById: reviewerUserId,
          reviewedAt: now,
        },
      });

      if (dto.approved) {
        await tx.violation.update({
          where: { id: action.violationId },
          data: {
            status: ViolationStatus.CANCELLED,
            appealStatus: 'APPROVED',
            closedAt: now,
          },
        });

        await tx.invoice.updateMany({
          where: {
            violationId: action.violationId,
            type: InvoiceType.FINE,
            status: InvoiceStatus.PENDING,
          },
          data: {
            status: InvoiceStatus.CANCELLED,
          },
        });
      } else {
        await tx.violation.update({
          where: { id: action.violationId },
          data: {
            appealStatus: 'REJECTED',
          },
        });
      }
    });

    return this.getViolationDetail(action.violationId);
  }

  async reviewFixSubmission(
    actionRequestId: string,
    dto: ReviewAppealDto,
    reviewerUserId: string,
  ): Promise<ViolationDetailDto> {
    const action = await this.getActionRequestOrThrow(actionRequestId);
    if (action.type !== ViolationActionType.FIX_SUBMISSION) {
      throw new BadRequestException('Action request is not a fix submission');
    }

    const reason = dto.reason?.trim() || null;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.violationActionRequest.update({
        where: { id: actionRequestId },
        data: {
          status: dto.approved
            ? ViolationActionStatus.APPROVED
            : ViolationActionStatus.REJECTED,
          rejectionReason: dto.approved ? null : reason,
          reviewedById: reviewerUserId,
          reviewedAt: now,
        },
      });

      if (dto.approved) {
        await tx.violation.update({
          where: { id: action.violationId },
          data: {
            status: ViolationStatus.CANCELLED,
            closedAt: now,
          },
        });

        await tx.invoice.updateMany({
          where: {
            violationId: action.violationId,
            type: InvoiceType.FINE,
            status: InvoiceStatus.PENDING,
          },
          data: {
            status: InvoiceStatus.CANCELLED,
          },
        });
      }
    });

    return this.getViolationDetail(action.violationId);
  }

  async getViolationStats(): Promise<ViolationStatsDto> {
    const [total, pending, paid, appealed, cancelled, pendingAppeals, issued, collected] =
      await Promise.all([
        this.prisma.violation.count(),
        this.prisma.violation.count({ where: { status: ViolationStatus.PENDING } }),
        this.prisma.violation.count({ where: { status: ViolationStatus.PAID } }),
        this.prisma.violation.count({ where: { status: ViolationStatus.APPEALED } }),
        this.prisma.violation.count({ where: { status: ViolationStatus.CANCELLED } }),
        this.prisma.violationActionRequest.count({
          where: {
            type: ViolationActionType.APPEAL,
            status: ViolationActionStatus.PENDING,
          },
        }),
        this.prisma.violation.aggregate({ _sum: { fineAmount: true } }),
        this.prisma.violation.aggregate({
          where: { status: ViolationStatus.PAID },
          _sum: { fineAmount: true },
        }),
      ]);

    const groupedByCategory = await this.prisma.violation.groupBy({
      by: ['categoryId'],
      _count: { _all: true },
      _sum: { fineAmount: true },
    });

    const categoryIds = groupedByCategory
      .map((item) => item.categoryId)
      .filter((value): value is string => typeof value === 'string');

    const categories = categoryIds.length
      ? await this.prisma.violationCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];

    const categoryNameById = new Map(categories.map((item) => [item.id, item.name]));

    const byCategory: ViolationStatsByCategoryDto[] = groupedByCategory.map((item) => ({
      categoryId: item.categoryId,
      name:
        (item.categoryId ? categoryNameById.get(item.categoryId) : undefined) ??
        'Uncategorized',
      count: item._count._all,
      totalFines: Number(item._sum.fineAmount ?? 0),
    }));

    return {
      total,
      pending,
      paid,
      appealed,
      cancelled,
      pendingAppeals,
      totalFinesIssued: Number(issued._sum.fineAmount ?? 0),
      totalFinesCollected: Number(collected._sum.fineAmount ?? 0),
      byCategory,
    };
  }
}
