// src/modules/violations/violations.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateViolationDto, UpdateViolationDto } from './dto/violations.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { ViolationStatus, InvoiceStatus, InvoiceType } from '@prisma/client';

@Injectable()
export class ViolationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
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

    // 1. Create the Violation Record
    const violation = await this.prisma.violation.create({
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

    // 2. Automatically Create the Invoice (Financial Consequence)
    if (dto.fineAmount > 0) {
      await this.invoicesService.generateInvoice({
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
  }

  async findAll() {
    return this.prisma.violation.findMany({
      include: {
        unit: { select: { unitNumber: true, projectName: true } },
        resident: { select: { nameEN: true, email: true } },
        invoices: { select: { id: true, status: true, invoiceNumber: true } },
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

  async update(id: string, dto: UpdateViolationDto) {
    await this.findOne(id);
    return this.prisma.violation.update({
      where: { id },
      data: dto,
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
