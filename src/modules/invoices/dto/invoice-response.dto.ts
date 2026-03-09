import { InvoiceStatus, InvoiceType } from '@prisma/client';

export type InvoiceSourceType =
  | 'MANUAL'
  | 'VIOLATION'
  | 'SERVICE_REQUEST'
  | 'BOOKING'
  | 'COMPLAINT'
  | 'UNIT_FEE';

export class InvoiceCategoryResponseDto {
  id!: string;
  label!: string;
  mappedType!: InvoiceType;
  isSystem!: boolean;
  description!: string | null;
  isActive!: boolean;
  displayOrder!: number;
  color!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class InvoiceListItemDto {
  id!: string;
  invoiceNumber!: string;
  unitNumber!: string;
  communityName!: string;
  residentId!: string | null;
  residentName!: string | null;
  residentPhone!: string | null;
  type!: InvoiceType;
  categoryLabel!: string | null;
  amount!: number;
  dueDate!: string;
  paidDate!: string | null;
  status!: InvoiceStatus;
  source!: InvoiceSourceType;
  createdAt!: string;
}

export class PaginatedInvoiceListResponseDto {
  data!: InvoiceListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
}

export class InvoicePaymentHistoryItemDto {
  paidDate!: string;
  amount!: number;
}

export class InvoiceDocumentItemDto {
  id!: string;
  fileId!: string;
  name!: string;
  mimeType!: string | null;
  size!: number | null;
  key!: string;
  createdAt!: string;
}

export class InvoiceSourceRecordDto {
  kind!: InvoiceSourceType;
  id!: string | null;
  label!: string;
  secondaryLabel!: string | null;
  amount!: number | null;
}

export class InvoicePartiesDto {
  unitId!: string;
  unitNumber!: string;
  communityName!: string;
  residentId!: string | null;
  residentName!: string | null;
  residentPhone!: string | null;
}

export class InvoiceDetailResponseDto {
  id!: string;
  invoiceNumber!: string;
  type!: InvoiceType;
  status!: InvoiceStatus;
  source!: InvoiceSourceType;
  amount!: number;
  dueDate!: string;
  paidDate!: string | null;
  categoryLabel!: string | null;
  categoryColor!: string | null;
  createdAt!: string;
  updatedAt!: string;
  parties!: InvoicePartiesDto;
  sourceRecord!: InvoiceSourceRecordDto;
  paymentHistory!: InvoicePaymentHistoryItemDto[];
  documents!: InvoiceDocumentItemDto[];
}

export class InvoiceStatsResponseDto {
  totalRevenue!: number;
  pendingAmount!: number;
  overdueAmount!: number;
  overdueCount!: number;
  paidThisMonth!: number;
  invoicesByType!: Record<InvoiceType, number>;
  invoicesByStatus!: Record<InvoiceStatus, number>;
}
