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
} from '@prisma/client';
import { CreateUnitFeeDto, UpdateUnitFeeDto } from './dto/unit-fees.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper to generate a sequential invoice number (PLACEHOLDER)
  private async generateInvoiceNumber(): Promise<string> {
    // NOTE: In a production environment, this should be done in a database transaction
    // with locking to guarantee uniqueness and sequential order.
    const lastInvoice = await this.prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    const lastNumber = lastInvoice?.invoiceNumber
      ? parseInt(lastInvoice.invoiceNumber.substring(4))
      : 0;
    const newNumber = lastNumber + 1;
    return `INV-${newNumber.toString().padStart(5, '0')}`;
  }

  async create(dto: CreateInvoiceDto) {
    const invoiceNumber =
      dto.invoiceNumber || (await this.generateInvoiceNumber());

    return this.prisma.invoice.create({
      data: {
        ...dto,
        invoiceNumber,
      },
    });
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
              select: { userId: true },
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
            fees: [],
            total: 0,
            residentId: fee.unit.residents[0]?.userId,
          };
        }
        acc[unitId].fees.push(fee);
        acc[unitId].total += fee.amount.toNumber();
        return acc;
      },
      {} as Record<
        string,
        { fees: typeof feesToInvoice; total: number; residentId?: string }
      >,
    );

    const newInvoices: Invoice[] = [];
    // 3. Create Invoices Transactionally
    for (const unitId in groupedFees) {
      const group = groupedFees[unitId];
      if (!group.residentId) {
        console.warn(
          `Skipping unit ${unitId}: No primary resident found for billing.`,
        );
        continue;
      }

      // Create the Invoice
      const newInvoice = await this.create({
        unitId: unitId,
        residentId: group.residentId,
        type: `Monthly Utility Fees (${billingMonth.toISOString().substring(0, 7)})`,
        amount: group.total,
        dueDate: this.calculateUtilityDueDate(billingMonth), // Define this helper
      });

      // Link all individual fees to the new Invoice ID (Critical Step!)
      const feeUpdates = group.fees.map((fee) =>
        this.prisma.unitFee.update({
          where: { id: fee.id },
          data: { invoiceId: newInvoice.id },
        }),
      );
      await this.prisma.$transaction(feeUpdates);

      newInvoices.push(newInvoice);
    }

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
