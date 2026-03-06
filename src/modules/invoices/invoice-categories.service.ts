import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateInvoiceCategoryDto,
  UpdateInvoiceCategoryDto,
} from './dto/invoice-categories.dto';
import { InvoiceCategoryResponseDto } from './dto/invoice-response.dto';

const DEFAULT_CATEGORY_LABELS: Record<InvoiceType, string> = {
  RENT: 'Rent',
  SERVICE_FEE: 'Service Fee',
  UTILITY: 'Utility',
  FINE: 'Fine',
  MAINTENANCE_FEE: 'Maintenance Fee',
  BOOKING_FEE: 'Booking Fee',
  SETUP_FEE: 'Setup Fee',
  LATE_FEE: 'Late Fee',
  MISCELLANEOUS: 'Miscellaneous',
  OWNER_EXPENSE: 'Owner Expense',
  MANAGEMENT_FEE: 'Management Fee',
  CREDIT_MEMO: 'Credit Memo',
  DEBIT_MEMO: 'Debit Memo',
};

const DEFAULT_CATEGORY_COLORS: Record<InvoiceType, string> = {
  RENT: '#3b82f6',
  SERVICE_FEE: '#10b981',
  UTILITY: '#14b8a6',
  FINE: '#ef4444',
  MAINTENANCE_FEE: '#f59e0b',
  BOOKING_FEE: '#f97316',
  SETUP_FEE: '#8b5cf6',
  LATE_FEE: '#dc2626',
  MISCELLANEOUS: '#64748b',
  OWNER_EXPENSE: '#0ea5e9',
  MANAGEMENT_FEE: '#2563eb',
  CREDIT_MEMO: '#22c55e',
  DEBIT_MEMO: '#f43f5e',
};

@Injectable()
export class InvoiceCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(
    includeInactive = false,
  ): Promise<InvoiceCategoryResponseDto[]> {
    const initial = await this.readCategories(includeInactive);
    if (initial.tableMissing) {
      return [];
    }

    let rows = initial.rows;
    const hasSystemCategories = rows.some((row) => row.isSystem);
    if (!hasSystemCategories) {
      await this.seedDefaultCategories();
      const seeded = await this.readCategories(includeInactive);
      rows = seeded.rows;
    }

    return rows.map((row) => this.mapCategory(row));
  }

  async createCategory(
    dto: CreateInvoiceCategoryDto,
  ): Promise<InvoiceCategoryResponseDto> {
    if (dto.mappedType) {
      this.assertMappedType(dto.mappedType);
    }

    const lastCategory = await this.prisma.invoiceCategory.findFirst({
      orderBy: [{ displayOrder: 'desc' }, { createdAt: 'desc' }],
      select: { displayOrder: true },
    });

    const row = await this.prisma.invoiceCategory.create({
      data: {
        label: dto.label.trim(),
        mappedType: dto.mappedType ?? InvoiceType.MISCELLANEOUS,
        isSystem: false,
        displayOrder: (lastCategory?.displayOrder ?? -1) + 1,
        description: dto.description?.trim() || null,
        color: dto.color ?? null,
      },
    });

    return this.mapCategory(row);
  }

  async updateCategory(
    id: string,
    dto: UpdateInvoiceCategoryDto,
  ): Promise<InvoiceCategoryResponseDto> {
    await this.assertCategoryExists(id);

    if (dto.mappedType) {
      this.assertMappedType(dto.mappedType);
    }

    const row = await this.prisma.invoiceCategory.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.mappedType !== undefined ? { mappedType: dto.mappedType } : {}),
        ...(dto.mappedType !== undefined ? { isSystem: false } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description.trim() || null }
          : {}),
        ...(dto.color !== undefined ? { color: dto.color ?? null } : {}),
      },
    });

    return this.mapCategory(row);
  }

  async toggleCategory(id: string): Promise<InvoiceCategoryResponseDto> {
    const row = await this.prisma.invoiceCategory.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!row) {
      throw new NotFoundException('Invoice category not found');
    }

    const updated = await this.prisma.invoiceCategory.update({
      where: { id },
      data: { isActive: !row.isActive },
    });

    return this.mapCategory(updated);
  }

  async reorderCategories(
    orderedIds: string[],
  ): Promise<InvoiceCategoryResponseDto[]> {
    const uniqueIds = Array.from(new Set(orderedIds));
    if (uniqueIds.length !== orderedIds.length) {
      throw new BadRequestException('orderedIds must not contain duplicates');
    }

    const existing = await this.prisma.invoiceCategory.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });

    if (existing.length !== uniqueIds.length) {
      throw new NotFoundException(
        'One or more invoice categories were not found',
      );
    }

    await this.prisma.$transaction(
      uniqueIds.map((id, index) =>
        this.prisma.invoiceCategory.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return this.listCategories(true);
  }

  private assertMappedType(value: InvoiceType): void {
    if (!Object.values(InvoiceType).includes(value)) {
      throw new BadRequestException(
        'mappedType must be a valid InvoiceType enum value',
      );
    }
  }

  private async assertCategoryExists(id: string): Promise<void> {
    const row = await this.prisma.invoiceCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Invoice category not found');
    }
  }

  private async readCategories(includeInactive: boolean): Promise<{
    rows: Array<{
      id: string;
      label: string;
      mappedType: InvoiceType;
      isSystem: boolean;
      description: string | null;
      isActive: boolean;
      displayOrder: number;
      color: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    tableMissing: boolean;
  }> {
    try {
      const rows = await this.prisma.invoiceCategory.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      });
      return { rows, tableMissing: false };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2021'
      ) {
        return { rows: [], tableMissing: true };
      }
      throw error;
    }
  }

  private async seedDefaultCategories(): Promise<void> {
    const payload = Object.values(InvoiceType).map((type, index) => ({
      label: DEFAULT_CATEGORY_LABELS[type],
      mappedType: type,
      isSystem: true,
      description: `Default mapping for ${DEFAULT_CATEGORY_LABELS[type]} invoices.`,
      color: DEFAULT_CATEGORY_COLORS[type],
      displayOrder: index,
      isActive: true,
    }));

    await this.prisma.invoiceCategory.createMany({
      data: payload,
      skipDuplicates: true,
    });
  }

  private mapCategory(row: {
    id: string;
    label: string;
    mappedType: InvoiceType;
    isSystem: boolean;
    description: string | null;
    isActive: boolean;
    displayOrder: number;
    color: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): InvoiceCategoryResponseDto {
    return {
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
    };
  }
}
