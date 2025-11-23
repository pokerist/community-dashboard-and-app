// src/modules/invoices/invoices.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoices.dto';
import { InvoiceStatus } from '@prisma/client';

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

    const lastNumber = lastInvoice?.invoiceNumber ? parseInt(lastInvoice.invoiceNumber.substring(4)) : 0;
    const newNumber = lastNumber + 1;
    return `INV-${newNumber.toString().padStart(5, '0')}`;
  }


  async create(dto: CreateInvoiceDto) {
    const invoiceNumber = dto.invoiceNumber || await this.generateInvoiceNumber();
    
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
        documents: true, // Includes the Attachment relationship
      },
    });

    if (!invoice) throw new NotFoundException(`Invoice with ID ${id} not found.`);
    return invoice;
  }

  async findByResident(residentId: string) {
    // Crucial for the community app dashboard
    return this.prisma.invoice.findMany({
      where: { residentId },
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
      throw new BadRequestException(`Invoice ${id} is cancelled and cannot be paid.`);
    }

    // Use a transaction for integrity
    return this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.PAID,
          paidDate: new Date(),
        },
      });
      // PRODUCTION NOTE: Here you'd update a ledger or trigger an external payment confirmation.
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
}