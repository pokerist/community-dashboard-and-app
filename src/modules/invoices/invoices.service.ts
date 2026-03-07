import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BookingStatus,
  ComplaintStatus,
  IncidentStatus,
  Invoice,
  InvoiceStatus,
  InvoiceType,
  Prisma,
  ServiceRequestStatus,
  ViolationStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceCreatedEvent } from '../../events/contracts/invoice-created.event';
import {
  CancelInvoiceDto,
  CreateInvoiceDto,
  MarkAsPaidDto,
  SimulateInvoicePaymentDto,
} from './dto/invoices.dto';
import { InvoiceStatsQueryDto, ListInvoicesDto } from './dto/invoice-query.dto';
import {
  InvoiceCategoryResponseDto,
  InvoiceDetailResponseDto,
  InvoiceListItemDto,
  InvoiceSourceRecordDto,
  InvoiceSourceType,
  InvoiceStatsResponseDto,
  PaginatedInvoiceListResponseDto,
} from './dto/invoice-response.dto';
import { CreateUnitFeeDto } from './dto/unit-fees.dto';

export type InvoiceSources = {
  unitFeeIds?: string[];
  violationIds?: string[];
  serviceRequestIds?: string[];
  complaintIds?: string[];
  bookingIds?: string[];
  incidentIds?: string[];
};

export interface GenerateInvoiceDto {
  unitId: string;
  residentId?: string;
  amount: number;
  dueDate: Date;
  type: InvoiceType;
  sources?: InvoiceSources;
  invoiceNumber?: string;
  status?: InvoiceStatus;
}

type ActorContext = {
  actorUserId: string;
  permissions: string[];
  roles: string[];
};

type InvoiceFilterInput = {
  unitId?: string;
  residentId?: string;
  type?: InvoiceType;
  status?: InvoiceStatus;
  communityId?: string;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
};

type InvoiceCategoryLookup = Map<
  InvoiceType,
  { label: string; color: string | null }
>;

type InvoiceListRow = Prisma.InvoiceGetPayload<{
  include: {
    unit: {
      select: {
        unitNumber: true;
        projectName: true;
        community: { select: { name: true } };
      };
    };
    resident: { select: { nameEN: true } };
    unitFees: { select: { id: true }; take: 1 };
  };
}>;

type InvoiceDetailRow = Prisma.InvoiceGetPayload<{
  include: {
    unit: {
      select: {
        id: true;
        unitNumber: true;
        projectName: true;
        community: { select: { name: true } };
      };
    };
    resident: { select: { id: true; nameEN: true; phone: true } };
    violation: {
      select: {
        id: true;
        violationNumber: true;
        typeLegacy: true;
        fineAmount: true;
        category: { select: { name: true } };
      };
    };
    serviceRequest: {
      select: { id: true; service: { select: { name: true } } };
    };
    booking: {
      select: { id: true; date: true; facility: { select: { name: true } } };
    };
    complaint: {
      select: {
        id: true;
        complaintNumber: true;
        categoryLegacy: true;
        category: { select: { name: true } };
      };
    };
    unitFees: {
      select: { id: true; type: true; amount: true; billingMonth: true };
      orderBy: { billingMonth: 'desc' };
      take: 5;
    };
    documents: { include: { file: true } };
  };
}>;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private isSuperAdminRole(roles: unknown): boolean {
    return (
      Array.isArray(roles) &&
      roles.some(
        (role) =>
          typeof role === 'string' && role.toUpperCase() === 'SUPER_ADMIN',
      )
    );
  }

  private canViewAllInvoices(ctx: ActorContext): boolean {
    return (
      this.isSuperAdminRole(ctx.roles) ||
      (Array.isArray(ctx.permissions) &&
        ctx.permissions.includes('invoice.view_all'))
    );
  }

  private async generateInvoiceNumberTx(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    await tx.invoiceSequence.upsert({
      where: { name: 'invoices' },
      update: {},
      create: { name: 'invoices', counter: BigInt(0) },
    });

    const updated = await tx.invoiceSequence.update({
      where: { name: 'invoices' },
      data: {
        counter: {
          increment: BigInt(1),
        },
      },
    });

    return `INV-${updated.counter.toString().padStart(5, '0')}`;
  }

  private async generateInvoiceNumber(): Promise<string> {
    return this.prisma.$transaction((tx) => this.generateInvoiceNumberTx(tx));
  }

  async listCategories(
    includeInactive = false,
  ): Promise<InvoiceCategoryResponseDto[]> {
    const rows = await this.prisma.invoiceCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      label: row.label,
      mappedType: row.mappedType,
      isSystem: row.isSystem,
      description: row.description,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      color: row.color,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listInvoices(
    filters: ListInvoicesDto,
  ): Promise<PaginatedInvoiceListResponseDto> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 25, 100);
    const skip = (page - 1) * limit;
    const where = this.buildInvoiceWhere(filters);

    const [total, rows, categoryLookup] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          unit: {
            select: {
              unitNumber: true,
              projectName: true,
              community: { select: { name: true } },
            },
          },
          resident: { select: { nameEN: true } },
          unitFees: { select: { id: true }, take: 1 },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.getCategoryLookup(),
    ]);

    return {
      data: rows.map((row) => this.mapInvoiceListItem(row, categoryLookup)),
      total,
      page,
      limit,
    };
  }

  async getInvoiceDetail(id: string): Promise<InvoiceDetailResponseDto> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            projectName: true,
            community: { select: { name: true } },
          },
        },
        resident: { select: { id: true, nameEN: true, phone: true } },
        violation: {
          select: {
            id: true,
            violationNumber: true,
            typeLegacy: true,
            fineAmount: true,
            category: { select: { name: true } },
          },
        },
        serviceRequest: {
          select: { id: true, service: { select: { name: true } } },
        },
        booking: {
          select: {
            id: true,
            date: true,
            facility: { select: { name: true } },
          },
        },
        complaint: {
          select: {
            id: true,
            complaintNumber: true,
            categoryLegacy: true,
            category: { select: { name: true } },
          },
        },
        unitFees: {
          select: { id: true, type: true, amount: true, billingMonth: true },
          orderBy: { billingMonth: 'desc' },
          take: 5,
        },
        documents: { include: { file: true } },
      },
    });

    if (!row) {
      throw new NotFoundException('Invoice not found');
    }

    const categoryLookup = await this.getCategoryLookup();
    return this.mapInvoiceDetail(row, categoryLookup);
  }

  async createInvoice(
    dto: CreateInvoiceDto,
  ): Promise<InvoiceDetailResponseDto> {
    const dueDate = new Date(dto.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('dueDate must be a valid datetime');
    }

    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    if (dto.residentId) {
      const residentAssignment = await this.prisma.residentUnit.findFirst({
        where: {
          unitId: dto.unitId,
          resident: {
            userId: dto.residentId,
          },
        },
        select: { id: true },
      });

      if (!residentAssignment) {
        throw new BadRequestException(
          'Resident does not belong to the selected unit',
        );
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumberTx(tx);
      return tx.invoice.create({
        data: {
          unitId: dto.unitId,
          residentId: dto.residentId ?? null,
          type: dto.type,
          amount: new Prisma.Decimal(dto.amount),
          dueDate,
          invoiceNumber,
        },
        select: { id: true },
      });
    });

    const createdInvoice = await this.getInvoiceDetail(created.id);

    this.eventEmitter.emit(
      'invoice.created',
      new InvoiceCreatedEvent(
        createdInvoice.id,
        dto.unitId,
        dto.residentId ?? null,
        dto.amount,
        dueDate,
        dto.type,
      ),
    );

    return createdInvoice;
  }

  async markAsPaid(
    id: string,
    dto?: MarkAsPaidDto,
  ): Promise<InvoiceDetailResponseDto> {
    const paidDate = dto?.paidDate ? new Date(dto.paidDate) : new Date();
    if (Number.isNaN(paidDate.getTime())) {
      throw new BadRequestException('paidDate must be a valid datetime');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Invoice is already paid');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Cancelled invoices cannot be paid');
    }

    await this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.PAID,
          paidDate,
        },
        select: {
          id: true,
          violationId: true,
          serviceRequestId: true,
          complaintId: true,
          bookingId: true,
          incidentId: true,
          amount: true,
        },
      });

      if (updatedInvoice.violationId) {
        await tx.violation.update({
          where: { id: updatedInvoice.violationId },
          data: { status: ViolationStatus.PAID },
        });
      }

      if (updatedInvoice.serviceRequestId) {
        const existingRequest = await tx.serviceRequest.findUnique({
          where: { id: updatedInvoice.serviceRequestId },
          select: { id: true, serviceId: true, resolvedAt: true },
        });

        if (!existingRequest) {
          throw new NotFoundException('Linked service request was not found');
        }

        const requestRow = await tx.serviceRequest.update({
          where: { id: updatedInvoice.serviceRequestId },
          data: {
            status: ServiceRequestStatus.RESOLVED,
            resolvedAt: existingRequest.resolvedAt ?? new Date(),
          },
          select: { serviceId: true },
        });

        await tx.service.update({
          where: { id: requestRow.serviceId },
          data: {
            revenueTotal: {
              increment: updatedInvoice.amount,
            },
          },
        });
      }

      if (updatedInvoice.complaintId) {
        await tx.complaint.update({
          where: { id: updatedInvoice.complaintId },
          data: { status: ComplaintStatus.RESOLVED },
        });
      }

      if (updatedInvoice.bookingId) {
        await tx.booking.update({
          where: { id: updatedInvoice.bookingId },
          data: { status: BookingStatus.APPROVED },
        });
      }

      if (updatedInvoice.incidentId) {
        await tx.incident.update({
          where: { id: updatedInvoice.incidentId },
          data: { status: IncidentStatus.RESOLVED },
        });
      }
    });

    return this.getInvoiceDetail(id);
  }

  async cancelInvoice(
    id: string,
    dto: CancelInvoiceDto,
  ): Promise<InvoiceDetailResponseDto> {
    if (!dto.reason.trim()) {
      throw new BadRequestException('reason is required');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException('Paid invoices cannot be cancelled');
    }

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
      },
    });

    return this.getInvoiceDetail(id);
  }

  async bulkMarkOverdue(): Promise<{ updatedCount: number }> {
    const result = await this.prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.PENDING,
        dueDate: { lt: new Date() },
      },
      data: {
        status: InvoiceStatus.OVERDUE,
      },
    });

    return { updatedCount: result.count };
  }

  async getInvoiceStats(
    filters: InvoiceStatsQueryDto,
  ): Promise<InvoiceStatsResponseDto> {
    const where = this.buildInvoiceWhere(filters);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const nextMonthStart = new Date(monthStart);
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

    const [
      paid,
      pending,
      overdue,
      overdueCount,
      paidThisMonth,
      groupedByType,
      groupedByStatus,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...where, status: InvoiceStatus.PAID },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: InvoiceStatus.PENDING },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...where, status: InvoiceStatus.OVERDUE },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: { ...where, status: InvoiceStatus.OVERDUE },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...where,
          status: InvoiceStatus.PAID,
          paidDate: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    const invoicesByType = Object.fromEntries(
      Object.values(InvoiceType).map((type) => [type, 0]),
    ) as Record<InvoiceType, number>;

    for (const row of groupedByType) {
      invoicesByType[row.type] = row._count._all;
    }

    const invoicesByStatus = Object.fromEntries(
      Object.values(InvoiceStatus).map((status) => [status, 0]),
    ) as Record<InvoiceStatus, number>;

    for (const row of groupedByStatus) {
      invoicesByStatus[row.status] = row._count._all;
    }

    return {
      totalRevenue: this.decimalToNumberOrZero(paid._sum.amount),
      pendingAmount: this.decimalToNumberOrZero(pending._sum.amount),
      overdueAmount: this.decimalToNumberOrZero(overdue._sum.amount),
      overdueCount,
      paidThisMonth: this.decimalToNumberOrZero(paidThisMonth._sum.amount),
      invoicesByType,
      invoicesByStatus,
    };
  }

  async create(dto: CreateInvoiceDto): Promise<InvoiceDetailResponseDto> {
    return this.createInvoice(dto);
  }

  async findAll(): Promise<InvoiceListItemDto[]> {
    const rows = await this.listInvoices({ page: 1, limit: 100 });
    return rows.data;
  }

  async findOne(id: string): Promise<InvoiceDetailResponseDto> {
    return this.getInvoiceDetail(id);
  }

  async findOneForActor(
    id: string,
    ctx: ActorContext,
  ): Promise<InvoiceDetailResponseDto> {
    if (this.canViewAllInvoices(ctx)) {
      return this.getInvoiceDetail(id);
    }

    if (!ctx.permissions.includes('invoice.view_own')) {
      throw new ForbiddenException('You do not have access to this invoice');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        unitId: true,
        residentId: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.residentId === ctx.actorUserId) {
      return this.getInvoiceDetail(id);
    }

    const access = await this.prisma.unitAccess.findFirst({
      where: {
        userId: ctx.actorUserId,
        unitId: invoice.unitId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        canViewFinancials: true,
      },
    });

    if (!access || !access.canViewFinancials) {
      throw new ForbiddenException('You do not have access to this invoice');
    }

    return this.getInvoiceDetail(id);
  }

  async findByResident(residentId: string): Promise<InvoiceListItemDto[]> {
    const rows = await this.listInvoices({ residentId, page: 1, limit: 100 });
    return rows.data;
  }

  async findByResidentForActor(
    residentId: string,
    ctx: ActorContext,
  ): Promise<InvoiceListItemDto[]> {
    if (this.canViewAllInvoices(ctx)) {
      return this.findByResident(residentId);
    }

    if (!ctx.permissions.includes('invoice.view_own')) {
      throw new ForbiddenException('You do not have access to invoices');
    }

    if (residentId !== ctx.actorUserId) {
      throw new ForbiddenException('You can only view your own invoices');
    }

    return this.findByResident(residentId);
  }

  async findMineForActor(ctx: ActorContext): Promise<InvoiceListItemDto[]> {
    return this.findByResidentForActor(ctx.actorUserId, ctx);
  }

  async simulatePaymentForActor(
    id: string,
    dto: SimulateInvoicePaymentDto,
    ctx: ActorContext,
  ): Promise<{
    success: true;
    invoice: InvoiceDetailResponseDto;
    simulationReceipt: {
      simulated: true;
      paymentMethod: string;
      cardLast4: string | null;
      transactionRef: string;
      notes: string | null;
      paidAt: string;
    };
  }> {
    await this.findOneForActor(id, ctx);
    const invoice = await this.markAsPaid(id, {});

    const paidAt = invoice.paidDate ?? new Date().toISOString();

    return {
      success: true,
      invoice,
      simulationReceipt: {
        simulated: true,
        paymentMethod: dto.paymentMethod,
        cardLast4: dto.cardLast4 ?? null,
        transactionRef:
          dto.transactionRef?.trim() ||
          `SIM-${Date.now().toString(36).toUpperCase()}`,
        notes: dto.notes?.trim() || null,
        paidAt,
      },
    };
  }

  async remove(id: string): Promise<{ success: true }> {
    const row = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Invoice not found');
    }

    await this.prisma.invoice.delete({ where: { id } });
    return { success: true };
  }

  async createUnitFee(dto: CreateUnitFeeDto) {
    return this.prisma.unitFee.create({
      data: {
        unitId: dto.unitId,
        type: dto.type,
        amount: dto.amount,
        billingMonth: dto.billingMonth,
      },
    });
  }

  async findAllUnitFees() {
    return this.prisma.unitFee.findMany({
      include: {
        unit: {
          select: {
            unitNumber: true,
            projectName: true,
          },
        },
        invoice: {
          select: {
            status: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: {
        billingMonth: 'desc',
      },
    });
  }

  async findAllUnitFeesForActor(ctx: ActorContext) {
    const canViewAll =
      this.isSuperAdminRole(ctx.roles) ||
      ctx.permissions.includes('unit_fee.view_all');

    if (canViewAll) {
      return this.findAllUnitFees();
    }

    if (!ctx.permissions.includes('unit_fee.view_own')) {
      throw new ForbiddenException('You do not have access to unit fees');
    }

    const accessRows = await this.prisma.unitAccess.findMany({
      where: {
        userId: ctx.actorUserId,
        status: 'ACTIVE',
        canViewFinancials: true,
      },
      select: {
        unitId: true,
      },
    });

    const unitIds = Array.from(new Set(accessRows.map((row) => row.unitId)));
    if (unitIds.length === 0) {
      return [];
    }

    return this.prisma.unitFee.findMany({
      where: {
        unitId: {
          in: unitIds,
        },
      },
      include: {
        unit: {
          select: {
            unitNumber: true,
            projectName: true,
          },
        },
        invoice: {
          select: {
            status: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: {
        billingMonth: 'desc',
      },
    });
  }

  async removeUnitFee(id: string): Promise<{ success: true }> {
    const fee = await this.prisma.unitFee.findUnique({
      where: { id },
      select: {
        id: true,
        invoiceId: true,
      },
    });

    if (!fee) {
      throw new NotFoundException('Unit fee not found');
    }

    if (fee.invoiceId) {
      throw new BadRequestException(
        `Cannot delete fee; it is already linked to invoice ${fee.invoiceId}`,
      );
    }

    await this.prisma.unitFee.delete({ where: { id } });
    return { success: true };
  }

  async generateInvoice(dto: GenerateInvoiceDto): Promise<Invoice> {
    const created = await this.prisma.$transaction((tx) =>
      this.createGeneratedInvoiceInTx(tx, dto),
    );

    this.eventEmitter.emit(
      'invoice.created',
      new InvoiceCreatedEvent(
        created.id,
        created.unitId,
        created.residentId,
        created.amount.toNumber(),
        created.dueDate,
        created.type,
      ),
    );

    return created;
  }

  async generateInvoiceTx(
    tx: Prisma.TransactionClient,
    dto: GenerateInvoiceDto,
  ): Promise<Invoice> {
    const created = await this.createGeneratedInvoiceInTx(tx, dto);

    this.eventEmitter.emit(
      'invoice.created',
      new InvoiceCreatedEvent(
        created.id,
        created.unitId,
        created.residentId,
        created.amount.toNumber(),
        created.dueDate,
        created.type,
      ),
    );

    return created;
  }

  async generateMonthlyUtilityInvoices(billingMonth: Date): Promise<Invoice[]> {
    const feesToInvoice = await this.prisma.unitFee.findMany({
      where: {
        billingMonth,
        invoiceId: null,
      },
      include: {
        unit: {
          select: {
            id: true,
            residents: {
              where: { isPrimary: true },
              select: { residentId: true },
              take: 1,
            },
          },
        },
      },
    });

    if (feesToInvoice.length === 0) {
      return [];
    }

    const groupedFees = feesToInvoice.reduce<
      Record<
        string,
        {
          fees: (typeof feesToInvoice)[number][];
          total: number;
          residentId?: string;
        }
      >
    >((acc, fee) => {
      const key = fee.unitId;
      if (!acc[key]) {
        acc[key] = {
          fees: [],
          total: 0,
          residentId: fee.unit.residents[0]?.residentId,
        };
      }
      acc[key].fees.push(fee);
      acc[key].total += Number(fee.amount);
      return acc;
    }, {});

    const createdInvoices = await Promise.all(
      Object.entries(groupedFees).map(async ([unitId, group]) => {
        if (!group.residentId) {
          return null;
        }

        return this.generateInvoice({
          unitId,
          residentId: group.residentId,
          type: InvoiceType.UTILITY,
          amount: group.total,
          dueDate: this.calculateUtilityDueDate(billingMonth),
          sources: {
            unitFeeIds: group.fees.map((fee) => fee.id),
          },
        });
      }),
    );

    return createdInvoices.filter((row): row is Invoice => row !== null);
  }

  private async createGeneratedInvoiceInTx(
    tx: Prisma.TransactionClient,
    dto: GenerateInvoiceDto,
  ): Promise<Invoice> {
    const {
      unitId,
      residentId,
      amount,
      dueDate,
      type,
      sources,
      invoiceNumber,
    } = dto;

    if (sources?.unitFeeIds && sources.unitFeeIds.length > 0) {
      const fees = await tx.unitFee.findMany({
        where: { id: { in: sources.unitFeeIds } },
        select: { id: true, unitId: true },
      });

      if (fees.length !== sources.unitFeeIds.length) {
        throw new NotFoundException('Some unit fees were not found');
      }

      const uniqueUnitIds = Array.from(new Set(fees.map((fee) => fee.unitId)));
      if (uniqueUnitIds.length > 1 || uniqueUnitIds[0] !== unitId) {
        throw new BadRequestException(
          'unitFeeIds do not belong to the provided unitId',
        );
      }
    }

    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts += 1;
      const finalInvoiceNumber =
        invoiceNumber ?? (await this.generateInvoiceNumberTx(tx));

      const createData: Prisma.InvoiceUncheckedCreateInput = {
        unitId,
        residentId: residentId ?? null,
        amount,
        dueDate,
        type,
        invoiceNumber: finalInvoiceNumber,
        ...(dto.status ? { status: dto.status } : {}),
      };

      if (sources?.violationIds?.length) {
        if (sources.violationIds.length > 1) {
          throw new BadRequestException(
            'Multiple violations per invoice are not supported',
          );
        }
        createData.violationId = sources.violationIds[0];
      }

      if (sources?.serviceRequestIds?.length) {
        if (sources.serviceRequestIds.length > 1) {
          throw new BadRequestException(
            'Multiple service requests per invoice are not supported',
          );
        }
        createData.serviceRequestId = sources.serviceRequestIds[0];
      }

      if (sources?.complaintIds?.length) {
        if (sources.complaintIds.length > 1) {
          throw new BadRequestException(
            'Multiple complaints per invoice are not supported',
          );
        }
        createData.complaintId = sources.complaintIds[0];
      }

      if (sources?.bookingIds?.length) {
        if (sources.bookingIds.length > 1) {
          throw new BadRequestException(
            'Multiple bookings per invoice are not supported',
          );
        }
        createData.bookingId = sources.bookingIds[0];
      }

      if (sources?.incidentIds?.length) {
        if (sources.incidentIds.length > 1) {
          throw new BadRequestException(
            'Multiple incidents per invoice are not supported',
          );
        }
        createData.incidentId = sources.incidentIds[0];
      }

      try {
        const created = await tx.invoice.create({ data: createData });

        if (sources?.unitFeeIds?.length) {
          await tx.unitFee.updateMany({
            where: { id: { in: sources.unitFeeIds } },
            data: { invoiceId: created.id },
          });
        }

        return created;
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes('invoiceNumber') &&
          attempts < maxAttempts
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Failed to generate a unique invoice number');
  }

  private calculateUtilityDueDate(billingMonth: Date): Date {
    const dueDate = new Date(billingMonth);
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(10);
    return dueDate;
  }

  private buildInvoiceWhere(
    filters: InvoiceFilterInput,
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
      ...(filters.residentId ? { residentId: filters.residentId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.communityId
        ? { unit: { communityId: filters.communityId } }
        : {}),
      ...(filters.createdFrom || filters.createdTo
        ? {
            createdAt: {
              ...(filters.createdFrom
                ? { gte: new Date(filters.createdFrom) }
                : {}),
              ...(filters.createdTo
                ? { lte: new Date(filters.createdTo) }
                : {}),
            },
          }
        : {}),
      ...(filters.dueFrom || filters.dueTo
        ? {
            dueDate: {
              ...(filters.dueFrom ? { gte: new Date(filters.dueFrom) } : {}),
              ...(filters.dueTo ? { lte: new Date(filters.dueTo) } : {}),
            },
          }
        : {}),
    };

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        {
          invoiceNumber: {
            contains: search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          unit: {
            unitNumber: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
        {
          resident: {
            nameEN: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ];
    }

    return where;
  }

  private async getCategoryLookup(): Promise<InvoiceCategoryLookup> {
    const rows = await this.prisma.invoiceCategory.findMany({
      where: { isActive: true, isSystem: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const lookup: InvoiceCategoryLookup = new Map();
    for (const row of rows) {
      if (!lookup.has(row.mappedType)) {
        lookup.set(row.mappedType, {
          label: row.label,
          color: row.color,
        });
      }
    }

    return lookup;
  }

  private mapInvoiceListItem(
    row: InvoiceListRow,
    categoryLookup: InvoiceCategoryLookup,
  ): InvoiceListItemDto {
    const source = this.resolveInvoiceSource({
      violationId: row.violationId,
      serviceRequestId: row.serviceRequestId,
      bookingId: row.bookingId,
      complaintId: row.complaintId,
      unitFees: row.unitFees,
    });

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      unitNumber: row.unit.unitNumber,
      communityName: row.unit.community?.name ?? row.unit.projectName,
      residentName: row.resident?.nameEN ?? null,
      type: row.type,
      categoryLabel: categoryLookup.get(row.type)?.label ?? null,
      amount: Number(row.amount),
      dueDate: row.dueDate.toISOString(),
      paidDate: row.paidDate ? row.paidDate.toISOString() : null,
      status: row.status,
      source,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapInvoiceDetail(
    row: InvoiceDetailRow,
    categoryLookup: InvoiceCategoryLookup,
  ): InvoiceDetailResponseDto {
    const source = this.resolveInvoiceSource({
      violationId: row.violationId,
      serviceRequestId: row.serviceRequestId,
      bookingId: row.bookingId,
      complaintId: row.complaintId,
      unitFees: row.unitFees,
    });

    const category = categoryLookup.get(row.type);

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      type: row.type,
      status: row.status,
      source,
      amount: Number(row.amount),
      dueDate: row.dueDate.toISOString(),
      paidDate: row.paidDate ? row.paidDate.toISOString() : null,
      categoryLabel: category?.label ?? null,
      categoryColor: category?.color ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      parties: {
        unitId: row.unit.id,
        unitNumber: row.unit.unitNumber,
        communityName: row.unit.community?.name ?? row.unit.projectName,
        residentId: row.resident?.id ?? null,
        residentName: row.resident?.nameEN ?? null,
        residentPhone: row.resident?.phone ?? null,
      },
      sourceRecord: this.buildSourceRecord(row, source),
      paymentHistory: row.paidDate
        ? [{ paidDate: row.paidDate.toISOString(), amount: Number(row.amount) }]
        : [],
      documents: row.documents.map((document) => ({
        id: document.id,
        fileId: document.fileId,
        name: document.file.name,
        mimeType: document.file.mimeType,
        size: document.file.size,
        key: document.file.key,
        createdAt: document.createdAt.toISOString(),
      })),
    };
  }

  private buildSourceRecord(
    row: InvoiceDetailRow,
    source: InvoiceSourceType,
  ): InvoiceSourceRecordDto {
    if (source === 'VIOLATION' && row.violation) {
      return {
        kind: source,
        id: row.violation.id,
        label: row.violation.violationNumber,
        secondaryLabel: row.violation.category?.name ?? row.violation.typeLegacy,
        amount: Number(row.violation.fineAmount),
      };
    }

    if (source === 'SERVICE_REQUEST' && row.serviceRequest) {
      return {
        kind: source,
        id: row.serviceRequest.id,
        label: `Request ${row.serviceRequest.id.slice(0, 8).toUpperCase()}`,
        secondaryLabel: row.serviceRequest.service?.name ?? null,
        amount: Number(row.amount),
      };
    }

    if (source === 'BOOKING' && row.booking) {
      return {
        kind: source,
        id: row.booking.id,
        label: `Booking ${row.booking.id.slice(0, 8).toUpperCase()}`,
        secondaryLabel: row.booking.facility.name,
        amount: Number(row.amount),
      };
    }

    if (source === 'COMPLAINT' && row.complaint) {
      return {
        kind: source,
        id: row.complaint.id,
        label: row.complaint.complaintNumber,
        secondaryLabel: row.complaint.category?.name ?? row.complaint.categoryLegacy,
        amount: Number(row.amount),
      };
    }

    if (source === 'UNIT_FEE' && row.unitFees.length > 0) {
      const firstFee = row.unitFees[0];
      return {
        kind: source,
        id: firstFee.id,
        label: `Unit Fee (${firstFee.type})`,
        secondaryLabel: firstFee.billingMonth.toISOString().slice(0, 10),
        amount: Number(firstFee.amount),
      };
    }

    return {
      kind: 'MANUAL',
      id: null,
      label: 'Manually created',
      secondaryLabel: null,
      amount: Number(row.amount),
    };
  }

  private resolveInvoiceSource(row: {
    violationId: string | null;
    serviceRequestId: string | null;
    bookingId: string | null;
    complaintId: string | null;
    unitFees: Array<{ id: string }>;
  }): InvoiceSourceType {
    if (row.violationId) return 'VIOLATION';
    if (row.serviceRequestId) return 'SERVICE_REQUEST';
    if (row.bookingId) return 'BOOKING';
    if (row.complaintId) return 'COMPLAINT';
    if (row.unitFees.length > 0) return 'UNIT_FEE';
    return 'MANUAL';
  }

  private decimalToNumberOrZero(
    value: Prisma.Decimal | null | undefined,
  ): number {
    if (!value) {
      return 0;
    }
    return Number(value);
  }
}
