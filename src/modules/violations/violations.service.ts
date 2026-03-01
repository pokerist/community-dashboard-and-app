// src/modules/violations/violations.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateViolationDto, UpdateViolationDto } from './dto/violations.dto';
import {
  CreateViolationActionDto,
  ReviewViolationActionDto,
} from './dto/violation-action.dto';
import { InvoicesService } from '../invoices/invoices.service';
import {
  ViolationStatus,
  InvoiceStatus,
  InvoiceType,
  ViolationActionStatus,
  ViolationActionType,
} from '@prisma/client';
import { ViolationsQueryDto } from './dto/violations-query.dto';
import { paginate } from '../../common/utils/pagination.util';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ViolationIssuedEvent } from '../../events/contracts/violation-issued.event';

@Injectable()
export class ViolationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Helper to generate sequential numbers (VIO-00001)
  private async generateViolationNumber(): Promise<string> {
    const lastViolation = await this.prisma.violation.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { violationNumber: true },
    });
    const lastNumber = lastViolation?.violationNumber
      ? parseInt(lastViolation.violationNumber.substring(4))
      : 0;
    const newNumber = lastNumber + 1;
    return `VIO-${newNumber.toString().padStart(5, '0')}`;
  }

  async create(dto: CreateViolationDto) {
    const violationNumber = await this.generateViolationNumber();
    const { attachmentIds = [], ...violationData } = dto;

    const violation = await this.prisma.$transaction(async (tx) => {
      // 1. Create the Violation Record
      const violation = await tx.violation.create({
        data: {
          violationNumber,
          unitId: dto.unitId,
          residentId: dto.residentId,
          type: dto.type,
          description: dto.description,
          fineAmount: dto.fineAmount,
          issuedById: dto.issuedById,
          status: ViolationStatus.PENDING,
        },
      });

      // 2. Create attachments if provided
      if (attachmentIds.length > 0) {
        const attachmentsData = attachmentIds.map((fileId) => ({
          fileId: fileId,
          entityId: violation.id,
          entity: 'VIOLATION',
        }));
        await tx.attachment.createMany({
          data: attachmentsData,
          skipDuplicates: true,
        });
      }

      // 3. Automatically Create the Invoice (Financial Consequence)
      if (dto.fineAmount > 0) {
        await this.invoicesService.generateInvoiceTx(tx, {
          unitId: dto.unitId,
          residentId: dto.residentId,
          type: InvoiceType.FINE,
          amount: dto.fineAmount,
          dueDate: dto.dueDate,
          sources: { violationIds: [violation.id] },
          status: InvoiceStatus.PENDING,
        });
      }

      return violation;
    });

    try {
      const recipientUserIds = await this.resolveViolationRecipients({
        unitId: dto.unitId,
        residentId: dto.residentId,
      });

      this.eventEmitter.emit(
        'violation.issued',
        new ViolationIssuedEvent(
          violation.id,
          violation.violationNumber,
          violation.unitId,
          recipientUserIds,
          violation.type,
          Number(dto.fineAmount),
        ),
      );
    } catch (err: unknown) {
      // Don’t fail violation issuance if notifications fail.
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to emit violation.issued event:', message);
    }

    return violation;
  }

  private async resolveViolationRecipients(input: {
    unitId: string;
    residentId?: string;
  }): Promise<string[]> {
    if (input.residentId) return [input.residentId];

    const primaryResidentUnit = await this.prisma.residentUnit.findFirst({
      where: { unitId: input.unitId, isPrimary: true },
      select: { resident: { select: { userId: true } } },
    });

    const primaryUserId = primaryResidentUnit?.resident?.userId;
    return primaryUserId ? [primaryUserId] : [];
  }

  async findAll(query: ViolationsQueryDto) {
    const {
      status,
      unitId,
      residentId,
      issuedById,
      createdAtFrom,
      createdAtTo,
      ...baseQuery
    } = query;

    const filters: Record<string, any> = {
      status,
      unitId,
      residentId,
      issuedById,
      createdAtFrom,
      createdAtTo,
    };

    return paginate(this.prisma.violation, baseQuery, {
      searchFields: ['violationNumber', 'type', 'description'],
      additionalFilters: filters,
      include: {
        unit: { select: { unitNumber: true, projectName: true } },
        resident: { select: { nameEN: true, email: true } },
        issuedBy: { select: { nameEN: true } },
        invoices: { select: { id: true, status: true, invoiceNumber: true } },
      },
    });
  }

  async findMine(actorUserId: string) {
    const unitAccessRows = await this.prisma.unitAccess.findMany({
      where: {
        userId: actorUserId,
        status: 'ACTIVE',
        canViewFinancials: true,
      },
      select: { unitId: true },
    });

    const unitIds = Array.from(new Set(unitAccessRows.map((r) => r.unitId)));

    return this.prisma.violation.findMany({
      where: {
        OR: [
          { residentId: actorUserId },
          ...(unitIds.length > 0 ? [{ unitId: { in: unitIds } }] : []),
        ],
      },
      include: {
        unit: { select: { id: true, unitNumber: true, block: true, projectName: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, amount: true, dueDate: true } },
        issuedBy: { select: { id: true, nameEN: true, nameAR: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // NOTE: findOne must include 'invoices' to support the remove check.
  async findOne(id: string) {
    const violation = await this.prisma.violation.findUnique({
      where: { id },
      include: {
        unit: true,
        resident: true,
        // CRITICAL: Ensure invoices includes status and id for the check in remove()
        invoices: {
          select: { id: true, status: true, invoiceNumber: true },
        },
        issuedBy: { select: { nameEN: true } },
      },
    });
    if (!violation) throw new NotFoundException(`Violation ${id} not found`);
    return violation;
  }

  async findOneForActor(
    id: string,
    ctx: { actorUserId: string; permissions: string[] },
  ) {
    const violation = await this.findOne(id);

    const canViewAll = ctx.permissions.includes('violation.view_all');
    if (canViewAll) return violation;

    const isDirectTarget =
      violation.residentId && violation.residentId === ctx.actorUserId;

    if (!isDirectTarget) {
      const hasActiveUnitAccess = await this.prisma.unitAccess.findFirst({
        where: {
          userId: ctx.actorUserId,
          unitId: violation.unitId,
          status: 'ACTIVE',
        },
        select: { id: true, canViewFinancials: true },
      });

      if (!hasActiveUnitAccess || !hasActiveUnitAccess.canViewFinancials) {
        throw new ForbiddenException('You do not have access to this violation');
      }
    }

    return violation;
  }

  async update(id: string, dto: UpdateViolationDto) {
    await this.findOne(id);
    return this.prisma.violation.update({
      where: { id },
      data: {
        status: dto.status,
        appealStatus: dto.appealStatus,
      },
    });
  }

  async createActionForActor(
    violationId: string,
    input: {
      actorUserId: string;
      permissions: string[];
      dto: CreateViolationActionDto;
    },
  ) {
    await this.findOneForActor(violationId, {
      actorUserId: input.actorUserId,
      permissions: input.permissions,
    });

    const note = input.dto.note?.trim() || null;
    const attachmentIds = Array.from(
      new Set((input.dto.attachmentIds ?? []).filter(Boolean)),
    );

    if (attachmentIds.length) {
      const filesCount = await this.prisma.file.count({
        where: { id: { in: attachmentIds } },
      });
      if (filesCount !== attachmentIds.length) {
        throw new BadRequestException('One or more attachment files are invalid');
      }
    }

    return this.prisma.violationActionRequest.create({
      data: {
        violationId,
        requestedById: input.actorUserId,
        type: input.dto.type,
        note,
        attachmentIds,
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
  }

  async listActionsForActor(
    violationId: string,
    ctx: { actorUserId: string; permissions: string[] },
  ) {
    await this.findOneForActor(violationId, ctx);

    return this.prisma.violationActionRequest.findMany({
      where: { violationId },
      include: {
        requestedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
        reviewedBy: {
          select: { id: true, nameEN: true, nameAR: true, email: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async reviewActionRequest(
    actionId: string,
    reviewerUserId: string,
    dto: ReviewViolationActionDto,
  ) {
    const action = await this.prisma.violationActionRequest.findUnique({
      where: { id: actionId },
      include: {
        violation: {
          select: { id: true, status: true, appealStatus: true },
        },
      },
    });

    if (!action) throw new NotFoundException('Violation action request not found');
    if (action.status !== ViolationActionStatus.PENDING) {
      throw new BadRequestException(
        'Violation action request is no longer pending',
      );
    }

    if (
      dto.status !== ViolationActionStatus.APPROVED &&
      dto.status !== ViolationActionStatus.REJECTED
    ) {
      throw new BadRequestException('Invalid review status');
    }

    const reviewNote = dto.note?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.violationActionRequest.update({
        where: { id: action.id },
        data: {
          status: dto.status,
          rejectionReason:
            dto.status === ViolationActionStatus.REJECTED ? reviewNote : null,
          reviewedById: reviewerUserId,
          reviewedAt: new Date(),
        },
      });

      if (action.type === ViolationActionType.APPEAL) {
        await tx.violation.update({
          where: { id: action.violationId },
          data: {
            appealStatus:
              dto.status === ViolationActionStatus.APPROVED
                ? 'APPROVED'
                : 'REJECTED',
          },
        });
      }

      if (
        action.type === ViolationActionType.FIX_SUBMISSION &&
        dto.status === ViolationActionStatus.APPROVED
      ) {
        await tx.violation.update({
          where: { id: action.violationId },
          data: { appealStatus: 'FIX_VERIFIED' },
        });
      }

      return updated;
    });
  }

  async remove(id: string) {
    // CRITICAL: findOne must be called here to include the invoices array!
    const violation = await this.findOne(id);

    // Find the first (and likely only) linked invoice
    const linkedInvoice = violation.invoices?.[0];

    // If there is an invoice, we must handle it (Transactional logic)
    return this.prisma.$transaction(async (tx) => {
      if (linkedInvoice) {
        if (linkedInvoice.status === InvoiceStatus.PAID) {
          throw new BadRequestException(
            'Cannot delete a violation that has already been paid.',
          );
        }

        // Action: Cancel or Delete the invoice.
        // Deleting the invoice is safe here since the violation is also being deleted.
        // We use the Prisma client within the transaction (tx.invoice.delete)
        await tx.invoice.delete({ where: { id: linkedInvoice.id } });
      }

      return tx.violation.delete({ where: { id } });
    });
  }
}
