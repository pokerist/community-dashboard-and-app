// src/modules/violations/violations.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateViolationDto, UpdateViolationDto } from './dto/violations.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { ViolationStatus, InvoiceStatus } from '@prisma/client';

@Injectable()
export class ViolationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService, // Inject it
  ) {}

  // Helper to generate sequential numbers (VIO-00001)
  private async generateViolationNumber(): Promise<string> {
    const last = await this.prisma.violation.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { violationNumber: true },
    });
    const num = last?.violationNumber ? parseInt(last.violationNumber.split('-')[1]) : 0;
    return `VIO-${(num + 1).toString().padStart(5, '0')}`;
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
      await this.invoicesService.create({
        unitId: dto.unitId,
        residentId: dto.residentId,
        type: `Violation: ${dto.type}`, // e.g., "Violation: Noise Complaint"
        amount: dto.fineAmount,
        dueDate: dto.dueDate, // <--- Using the admin-provided date
        violationId: violation.id, // Linking back to source
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
        invoice: { select: { id: true, status: true, invoiceNumber: true } }, // Show linked invoice status
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const violation = await this.prisma.violation.findUnique({
      where: { id },
      include: {
        unit: true,
        resident: true,
        invoice: true, // Full invoice details
        issuedBy: { select: { nameEN: true } }
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
    const violation = await this.findOne(id);

    // If there is an invoice, we must cancel it first (Transactional logic)
    return this.prisma.$transaction(async (tx) => {
      if (violation.invoice) {
        if (violation.invoice.status === InvoiceStatus.PAID) {
           throw new BadRequestException('Cannot delete a violation that has already been paid.');
        }
        // Cancel or Delete the invoice
        await tx.invoice.delete({ where: { id: violation.invoice.id } });
      }
      
      return tx.violation.delete({ where: { id } });
    });
  }
}