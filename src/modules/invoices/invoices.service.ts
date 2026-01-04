// src/modules/invoices/invoices.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoices.dto';
import {
  Prisma,
  Invoice,
  InvoiceStatus,
  ViolationStatus,
  InvoiceType,
  ServiceRequestStatus,
  ComplaintStatus,
  BookingStatus,
  IncidentStatus,
} from '@prisma/client';
import { CreateUnitFeeDto, UpdateUnitFeeDto } from './dto/unit-fees.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InvoiceCreatedEvent } from '../../events/contracts/invoice-created.event';

// --- Types for the new generic invoice generator ---
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

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Helper to generate the next invoice number using a DB-backed sequence
  // This uses an atomic increment on the InvoiceSequence model to guarantee
  // unique, sequential numbers even under concurrent requests.
  private async generateInvoiceNumber(): Promise<string> {
    // We wrap the sequence increment in a transaction in case we want to extend
    // the logic later (e.g., support multiple named sequences).
    const seq = await this.prisma.$transaction(async (tx) => {
      // Ensure a sequence row exists (upsert is safe)
      await tx.invoiceSequence.upsert({
        where: { name: 'invoices' },
        update: {},
        create: { name: 'invoices', counter: BigInt(0) },
      });

      // Atomically increment the counter and return the updated row
      const updated = await tx.invoiceSequence.update({
        where: { name: 'invoices' },
        data: { counter: { increment: BigInt(1) } },
      });

      return updated;
    });

    // Use a stable prefix and fixed width for invoice numbers.
    const prefix = 'INV-';
    const counter =
      typeof seq.counter === 'bigint'
        ? seq.counter
        : BigInt(seq.counter as any);
    const width = 5;
    return `${prefix}${counter.toString().padStart(width, '0')}`;
  }

  // Transactional invoice number generator that uses the provided TransactionClient
  // This ensures the sequence increment participates in the same transaction as the
  // created invoice and will be rolled back if the transaction aborts, preventing
  // gaps in the invoice sequence caused by failed attempts.
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
      data: { counter: { increment: BigInt(1) } },
    });

    const prefix = 'INV-';
    const counter =
      typeof updated.counter === 'bigint'
        ? updated.counter
        : BigInt(updated.counter as any);
    const width = 5;
    return `${prefix}${counter.toString().padStart(width, '0')}`;
  }

  async create(dto: CreateInvoiceDto) {
    const invoiceNumber =
      dto.invoiceNumber || (await this.generateInvoiceNumber());

    const newInvoice = await this.prisma.invoice.create({
      data: {
        ...dto,
        invoiceNumber,
      },
    });

    this.eventEmitter.emit(
      'invoice.created',
      new InvoiceCreatedEvent(
        newInvoice.id,
        newInvoice.unitId,
        newInvoice.residentId,
        newInvoice.amount.toNumber(),
        newInvoice.dueDate,
        newInvoice.type,
      ),
    );

    return newInvoice;
  }

  /**
   * Generate an invoice and atomically link provided sources (e.g., UnitFees).
   * NOTE: Current schema supports linking UnitFees (by setting invoiceId on the UnitFee)
   * and a single Violation via invoice.violationId. Supporting multiple-source links
   * or a fully polymorphic approach will require a schema migration (InvoiceSource).
   */
  async generateInvoice(dto: GenerateInvoiceDto) {
    const {
      unitId,
      residentId,
      amount,
      dueDate,
      type,
      sources,
      invoiceNumber,
    } = dto;

    const newInvoice = await this.prisma.$transaction(async (tx) => {
      const maxAttempts = 5;
      let lastError: any = null;

      // Validate UnitFees belong to the same unit and match provided unitId (if provided)
      if (sources?.unitFeeIds && sources.unitFeeIds.length > 0) {
        const fees = await tx.unitFee.findMany({
          where: { id: { in: sources.unitFeeIds } },
          select: { unitId: true, id: true },
        });

        if (fees.length !== sources.unitFeeIds.length) {
          throw new NotFoundException('Some UnitFees were not found.');
        }

        const uniqueUnits = new Set(fees.map((f) => f.unitId));
        if (uniqueUnits.size > 1) {
          throw new BadRequestException('UnitFees belong to multiple units.');
        }

        const onlyUnitId = fees[0].unitId;
        if (onlyUnitId !== unitId) {
          throw new BadRequestException(
            'UnitFees do not belong to the provided unitId.',
          );
        }
      }

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const finalInvoiceNumber =
          invoiceNumber ?? (await this.generateInvoiceNumberTx(tx));

        const createData: Prisma.InvoiceUncheckedCreateInput = {
          unitId,
          residentId,
          amount,
          dueDate,
          type,
          invoiceNumber: finalInvoiceNumber,
        };

        if (dto.status) {
          // small, explicit cast because Prisma's create input types are nested complex types
          (createData as any).status = dto.status;
        }

        if (sources?.violationIds && sources.violationIds.length > 0) {
          if (sources.violationIds.length > 1) {
            throw new BadRequestException(
              'Multiple violations per invoice are not supported by the current schema. Consider migrating to an InvoiceSource table.',
            );
          }
          (createData as any).violationId = sources.violationIds[0];
        }

        // Service Requests: only single serviceRequestId per invoice supported by schema
        if (
          sources?.serviceRequestIds &&
          sources.serviceRequestIds.length > 0
        ) {
          if (sources.serviceRequestIds.length > 1) {
            throw new BadRequestException(
              'Multiple service requests per invoice are not supported by the current schema. Consider migrating to an InvoiceSource table.',
            );
          }
          (createData as any).serviceRequestId = sources.serviceRequestIds[0];
        }

        // Complaints
        if (sources?.complaintIds && sources.complaintIds.length > 0) {
          if (sources.complaintIds.length > 1) {
            throw new BadRequestException(
              'Multiple complaints per invoice are not supported by the current schema. Consider migrating to an InvoiceSource table.',
            );
          }
          (createData as any).complaintId = sources.complaintIds[0];
        }

        // Bookings
        if (sources?.bookingIds && sources.bookingIds.length > 0) {
          if (sources.bookingIds.length > 1) {
            throw new BadRequestException(
              'Multiple bookings per invoice are not supported by the current schema. Consider migrating to an InvoiceSource table.',
            );
          }
          (createData as any).bookingId = sources.bookingIds[0];
        }

        // Incidents
        if (sources?.incidentIds && sources.incidentIds.length > 0) {
          if (sources.incidentIds.length > 1) {
            throw new BadRequestException(
              'Multiple incidents per invoice are not supported by the current schema. Consider migrating to an InvoiceSource table.',
            );
          }
          (createData as any).incidentId = sources.incidentIds[0];
        }

        try {
          const created = await tx.invoice.create({ data: createData });

          // Bulk-link UnitFees (if provided)
          if (sources?.unitFeeIds && sources.unitFeeIds.length > 0) {
            await tx.unitFee.updateMany({
              where: { id: { in: sources.unitFeeIds } },
              data: { invoiceId: created.id },
            });
          }

          return created;
        } catch (err: any) {
          lastError = err;
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            const target = (err.meta?.target as string[]) ?? [];
            if (target.includes('invoiceNumber')) {
              if (attempt === maxAttempts - 1) throw err;
              // collision - try again
              continue;
            }
          }
          throw err;
        }
      }

      throw lastError;
    });

    // Emit event outside the transaction
    this.eventEmitter.emit(
      'invoice.created',
      new InvoiceCreatedEvent(
        newInvoice.id,
        newInvoice.unitId,
        newInvoice.residentId,
        newInvoice.amount.toNumber(),
        newInvoice.dueDate,
        newInvoice.type,
      ),
    );

    return newInvoice;
  }

  async findAll() {
    return this.prisma.invoice.findMany({
      include: {
        resident: { select: { nameEN: true, email: true } },
        unit: { select: { unitNumber: true, projectName: true } },
        documents: { include: { file: true } }, // <--- INCLUDE DOCUMENTS AND FILE METADATA
      },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        unit: true,
        resident: true,
        documents: { include: { file: true } }, // <--- INCLUDE DOCUMENTS AND FILE METADATA
      },
    });

    if (!invoice)
      throw new NotFoundException(`Invoice with ID ${id} not found.`);
    return invoice;
  }

  async findByResident(residentId: string) {
    return this.prisma.invoice.findMany({
      where: { residentId },
      include: {
        documents: { include: { file: true } }, // <--- INCLUDE DOCUMENTS
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    await this.findOne(id); // Check existence

    return this.prisma.invoice.update({
      where: { id },
      data: dto,
    });
  }

  async markAsPaid(id: string) {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException(`Invoice ${id} is already marked as paid.`);
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        `Invoice ${id} is cancelled and cannot be paid.`,
      );
    }

    // Use a transaction for integrity
    return this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.PAID,
          paidDate: new Date(),
          // Placeholder for future integration:
          // paymentMethod: paymentMethod,
          // transactionRef: transactionRef
        },
      });

      // Crucial: If the invoice came from a Violation, update the Violation status!
      if (updatedInvoice.violationId) {
        await tx.violation.update({
          where: { id: updatedInvoice.violationId },
          data: { status: ViolationStatus.PAID },
        });
      }

      // Expand to update related sources (serviceRequest, complaint, booking, incident)
      if (updatedInvoice.serviceRequestId) {
        await tx.serviceRequest.update({
          where: { id: updatedInvoice.serviceRequestId },
          data: { status: ServiceRequestStatus.RESOLVED },
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

      return updatedInvoice;
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check existence

    // For production, you may prevent deletion of PAID invoices.
    return this.prisma.invoice.delete({
      where: { id },
    });
  }

  // --- UnitFee CRUD Methods ---

  async createUnitFee(dto: CreateUnitFeeDto) {
    return this.prisma.unitFee.create({ data: dto });
  }

  async findAllUnitFees() {
    return this.prisma.unitFee.findMany({
      include: {
        unit: { select: { unitNumber: true, projectName: true } },
        invoice: { select: { status: true, invoiceNumber: true } },
      },
      orderBy: { billingMonth: 'desc' },
    });
  }

  async removeUnitFee(id: string) {
    // Check if the fee has already been invoiced
    const fee = await this.prisma.unitFee.findUnique({ where: { id } });

    if (!fee) throw new NotFoundException(`UnitFee with ID ${id} not found.`);
    if (fee.invoiceId) {
      throw new BadRequestException(
        `Cannot delete fee; it has already been included in Invoice ${fee.invoiceId}.`,
      );
    }

    return this.prisma.unitFee.delete({ where: { id } });
  }

  async generateMonthlyUtilityInvoices(billingMonth: Date) {
    // 1. Find all UN-INVOICED UnitFees for the target month
    const feesToInvoice = await this.prisma.unitFee.findMany({
      where: {
        billingMonth: billingMonth,
        invoiceId: null, // Only fees that haven't been linked to an invoice
      },
      include: {
        unit: {
          select: {
            id: true,
            // Crucial: Find the current primary resident for this unit to bill them
            residents: {
              where: { isPrimary: true },
              select: { residentId: true },
              take: 1,
            },
          },
        },
      },
    });

    if (feesToInvoice.length === 0) return []; // Nothing to do

    // 2. Group fees by Unit to create one invoice per unit/resident
    const groupedFees = feesToInvoice.reduce(
      (acc, fee) => {
        const unitId = fee.unitId;
        if (!acc[unitId]) {
          acc[unitId] = {
            fees: [] as (typeof feesToInvoice)[number][],
            total: 0,
            residentId: fee.unit.residents[0]?.residentId,
          };
        }
        acc[unitId].fees.push(fee);
        acc[unitId].total += fee.amount.toNumber();
        return acc;
      },
      {} as Record<
        string,
        {
          fees: (typeof feesToInvoice)[number][];
          total: number;
          residentId?: string;
        }
      >,
    );

    // 3. Create Invoices concurrently (batches) using the new generator that links UnitFees
    const createPromises: Promise<Invoice | null>[] = Object.entries(
      groupedFees,
    ).map(([unitId, group]) => {
      if (!group.residentId) {
        console.warn(
          `Skipping unit ${unitId}: No primary resident found for billing.`,
        );
        return Promise.resolve(null);
      }
      return this.generateInvoice({
        unitId: unitId,
        residentId: group.residentId,
        type: InvoiceType.UTILITY,
        amount: group.total,
        dueDate: this.calculateUtilityDueDate(billingMonth),
        sources: { unitFeeIds: group.fees.map((f) => f.id) },
      });
    });

    const results = await Promise.all(createPromises);
    const newInvoices = results.filter((r): r is Invoice => r !== null);

    return newInvoices;
  }

  // Helper to calculate the due date (e.g., 10th of the next month)
  private calculateUtilityDueDate(billingMonth: Date): Date {
    const dueDate = new Date(billingMonth);
    dueDate.setMonth(dueDate.getMonth() + 1); // Next month
    dueDate.setDate(10); // Due on the 10th
    return dueDate;
  }
}
