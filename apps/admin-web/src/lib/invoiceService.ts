import apiClient from './api-client';

export type InvoiceStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

export type InvoiceType =
  | 'RENT'
  | 'SERVICE_FEE'
  | 'UTILITY'
  | 'FINE'
  | 'MAINTENANCE_FEE'
  | 'BOOKING_FEE'
  | 'SETUP_FEE'
  | 'LATE_FEE'
  | 'MISCELLANEOUS'
  | 'OWNER_EXPENSE'
  | 'MANAGEMENT_FEE'
  | 'CREDIT_MEMO'
  | 'DEBIT_MEMO';

export type InvoiceSourceType =
  | 'MANUAL'
  | 'VIOLATION'
  | 'SERVICE_REQUEST'
  | 'BOOKING'
  | 'COMPLAINT'
  | 'UNIT_FEE';

export type InvoiceCategory = {
  id: string;
  label: string;
  mappedType: InvoiceType;
  isSystem: boolean;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  unitNumber: string;
  communityName: string;
  residentName: string | null;
  type: InvoiceType;
  categoryLabel: string | null;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: InvoiceStatus;
  source: InvoiceSourceType;
  createdAt: string;
};

export type InvoiceListResponse = {
  data: InvoiceListItem[];
  total: number;
  page: number;
  limit: number;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  source: InvoiceSourceType;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  categoryLabel: string | null;
  categoryColor: string | null;
  createdAt: string;
  updatedAt: string;
  parties: {
    unitId: string;
    unitNumber: string;
    communityName: string;
    residentId: string | null;
    residentName: string | null;
    residentPhone: string | null;
  };
  sourceRecord: {
    kind: InvoiceSourceType;
    id: string | null;
    label: string;
    secondaryLabel: string | null;
    amount: number | null;
  };
  paymentHistory: Array<{
    paidDate: string;
    amount: number;
  }>;
  documents: Array<{
    id: string;
    fileId: string;
    name: string;
    mimeType: string | null;
    size: number | null;
    key: string;
    createdAt: string;
  }>;
};

export type InvoiceStats = {
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  paidThisMonth: number;
  invoicesByType: Record<InvoiceType, number>;
  invoicesByStatus: Record<InvoiceStatus, number>;
};

export type ListInvoicesFilters = {
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
  page?: number;
  limit?: number;
};

export type CreateInvoicePayload = {
  unitId: string;
  residentId?: string;
  type: InvoiceType;
  amount: number;
  dueDate: string;
  notes?: string;
};

type CommunityRow = {
  id: string;
  name: string;
  code?: string | null;
};

type UnitRow = {
  id: string;
  unitNumber?: string | null;
  block?: string | null;
  projectName?: string | null;
  communityId?: string | null;
};

type ResidentRow = {
  id: string;
  nameEN?: string | null;
  email?: string | null;
};

export type CommunityOption = {
  id: string;
  label: string;
};

export type UnitOption = {
  id: string;
  label: string;
  communityId: string | null;
};

export type ResidentOption = {
  id: string;
  label: string;
};

export const INVOICE_TYPE_OPTIONS: InvoiceType[] = [
  'RENT',
  'SERVICE_FEE',
  'UTILITY',
  'FINE',
  'MAINTENANCE_FEE',
  'BOOKING_FEE',
  'SETUP_FEE',
  'LATE_FEE',
  'MISCELLANEOUS',
  'OWNER_EXPENSE',
  'MANAGEMENT_FEE',
  'CREDIT_MEMO',
  'DEBIT_MEMO',
];

export const SOURCE_BADGE_COLOR: Record<InvoiceSourceType, string> = {
  MANUAL: 'bg-slate-500/15 text-slate-300 border border-slate-500/20',
  VIOLATION: 'bg-red-500/15 text-red-300 border border-red-500/30',
  SERVICE_REQUEST: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  BOOKING: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  COMPLAINT: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  UNIT_FEE: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const INVOICE_STATUS_VALUES: ReadonlySet<InvoiceStatus> = new Set([
  'PAID',
  'PENDING',
  'OVERDUE',
  'CANCELLED',
]);

const INVOICE_TYPE_VALUES: ReadonlySet<InvoiceType> = new Set([
  'RENT',
  'SERVICE_FEE',
  'UTILITY',
  'FINE',
  'MAINTENANCE_FEE',
  'BOOKING_FEE',
  'SETUP_FEE',
  'LATE_FEE',
  'MISCELLANEOUS',
  'OWNER_EXPENSE',
  'MANAGEMENT_FEE',
  'CREDIT_MEMO',
  'DEBIT_MEMO',
]);

const INVOICE_SOURCE_VALUES: ReadonlySet<InvoiceSourceType> = new Set([
  'MANUAL',
  'VIOLATION',
  'SERVICE_REQUEST',
  'BOOKING',
  'COMPLAINT',
  'UNIT_FEE',
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getEmptyStats(): InvoiceStats {
  return {
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    paidThisMonth: 0,
    invoicesByType: {
      RENT: 0,
      SERVICE_FEE: 0,
      UTILITY: 0,
      FINE: 0,
      MAINTENANCE_FEE: 0,
      BOOKING_FEE: 0,
      SETUP_FEE: 0,
      LATE_FEE: 0,
      MISCELLANEOUS: 0,
      OWNER_EXPENSE: 0,
      MANAGEMENT_FEE: 0,
      CREDIT_MEMO: 0,
      DEBIT_MEMO: 0,
    },
    invoicesByStatus: {
      PAID: 0,
      PENDING: 0,
      OVERDUE: 0,
      CANCELLED: 0,
    },
  };
}

function parseInvoiceStatus(value: unknown): InvoiceStatus {
  if (typeof value === 'string' && INVOICE_STATUS_VALUES.has(value as InvoiceStatus)) {
    return value as InvoiceStatus;
  }
  return 'PENDING';
}

function parseInvoiceType(value: unknown): InvoiceType {
  if (typeof value === 'string' && INVOICE_TYPE_VALUES.has(value as InvoiceType)) {
    return value as InvoiceType;
  }
  return 'MISCELLANEOUS';
}

function deriveSource(value: Record<string, unknown>): InvoiceSourceType {
  const raw = value.source;
  if (typeof raw === 'string' && INVOICE_SOURCE_VALUES.has(raw as InvoiceSourceType)) {
    return raw as InvoiceSourceType;
  }
  if (stringOrNull(value.violationId)) return 'VIOLATION';
  if (stringOrNull(value.serviceRequestId)) return 'SERVICE_REQUEST';
  if (stringOrNull(value.bookingId)) return 'BOOKING';
  if (stringOrNull(value.complaintId)) return 'COMPLAINT';
  if (Array.isArray(value.unitFees) && value.unitFees.length > 0) return 'UNIT_FEE';
  return 'MANUAL';
}

function normalizeInvoiceListItem(value: unknown): InvoiceListItem {
  const row = isObjectRecord(value) ? value : {};
  const unit = isObjectRecord(row.unit) ? row.unit : {};
  const community = isObjectRecord(unit.community) ? unit.community : {};
  const resident = isObjectRecord(row.resident) ? row.resident : {};

  return {
    id: stringOr(row.id, ''),
    invoiceNumber: stringOr(row.invoiceNumber, stringOr(row.id, '')),
    unitNumber: stringOr(row.unitNumber, stringOr(unit.unitNumber, '--')),
    communityName: stringOr(
      row.communityName,
      stringOr(community.name, stringOr(unit.projectName, '--')),
    ),
    residentName: stringOrNull(row.residentName ?? resident.nameEN),
    type: parseInvoiceType(row.type),
    categoryLabel: stringOrNull(row.categoryLabel),
    amount: numberOr(row.amount, 0),
    dueDate: stringOr(row.dueDate, new Date(0).toISOString()),
    paidDate: stringOrNull(row.paidDate),
    status: parseInvoiceStatus(row.status),
    source: deriveSource(row),
    createdAt: stringOr(row.createdAt, new Date(0).toISOString()),
  };
}

function normalizeListResponse(payload: unknown): InvoiceListResponse {
  if (Array.isArray(payload)) {
    const data = payload.map((row) => normalizeInvoiceListItem(row));
    return {
      data,
      total: data.length,
      page: 1,
      limit: data.length || 25,
    };
  }

  if (isObjectRecord(payload)) {
    const data = Array.isArray(payload.data)
      ? payload.data.map((row) => normalizeInvoiceListItem(row))
      : [];
    return {
      data,
      total: numberOr(payload.total, data.length),
      page: numberOr(payload.page, 1),
      limit: numberOr(payload.limit, Math.max(data.length, 1)),
    };
  }

  return {
    data: [],
    total: 0,
    page: 1,
    limit: 25,
  };
}

function normalizeStats(payload: unknown): InvoiceStats {
  const base = getEmptyStats();
  if (!isObjectRecord(payload)) {
    return base;
  }

  const byType = isObjectRecord(payload.invoicesByType) ? payload.invoicesByType : {};
  const byStatus = isObjectRecord(payload.invoicesByStatus)
    ? payload.invoicesByStatus
    : {};

  return {
    totalRevenue: numberOr(payload.totalRevenue, 0),
    pendingAmount: numberOr(payload.pendingAmount, 0),
    overdueAmount: numberOr(payload.overdueAmount, 0),
    overdueCount: numberOr(payload.overdueCount, 0),
    paidThisMonth: numberOr(payload.paidThisMonth, 0),
    invoicesByType: {
      RENT: numberOr(byType.RENT, base.invoicesByType.RENT),
      SERVICE_FEE: numberOr(byType.SERVICE_FEE, base.invoicesByType.SERVICE_FEE),
      UTILITY: numberOr(byType.UTILITY, base.invoicesByType.UTILITY),
      FINE: numberOr(byType.FINE, base.invoicesByType.FINE),
      MAINTENANCE_FEE: numberOr(
        byType.MAINTENANCE_FEE,
        base.invoicesByType.MAINTENANCE_FEE,
      ),
      BOOKING_FEE: numberOr(byType.BOOKING_FEE, base.invoicesByType.BOOKING_FEE),
      SETUP_FEE: numberOr(byType.SETUP_FEE, base.invoicesByType.SETUP_FEE),
      LATE_FEE: numberOr(byType.LATE_FEE, base.invoicesByType.LATE_FEE),
      MISCELLANEOUS: numberOr(
        byType.MISCELLANEOUS,
        base.invoicesByType.MISCELLANEOUS,
      ),
      OWNER_EXPENSE: numberOr(
        byType.OWNER_EXPENSE,
        base.invoicesByType.OWNER_EXPENSE,
      ),
      MANAGEMENT_FEE: numberOr(
        byType.MANAGEMENT_FEE,
        base.invoicesByType.MANAGEMENT_FEE,
      ),
      CREDIT_MEMO: numberOr(byType.CREDIT_MEMO, base.invoicesByType.CREDIT_MEMO),
      DEBIT_MEMO: numberOr(byType.DEBIT_MEMO, base.invoicesByType.DEBIT_MEMO),
    },
    invoicesByStatus: {
      PAID: numberOr(byStatus.PAID, base.invoicesByStatus.PAID),
      PENDING: numberOr(byStatus.PENDING, base.invoicesByStatus.PENDING),
      OVERDUE: numberOr(byStatus.OVERDUE, base.invoicesByStatus.OVERDUE),
      CANCELLED: numberOr(byStatus.CANCELLED, base.invoicesByStatus.CANCELLED),
    },
  };
}

function normalizeInvoiceDetail(payload: unknown): InvoiceDetail {
  const row = isObjectRecord(payload) ? payload : {};
  const parties = isObjectRecord(row.parties) ? row.parties : {};
  const sourceRecord = isObjectRecord(row.sourceRecord) ? row.sourceRecord : {};
  const documents = Array.isArray(row.documents) ? row.documents : [];
  const paymentHistory = Array.isArray(row.paymentHistory) ? row.paymentHistory : [];

  const source = deriveSource(row);

  return {
    id: stringOr(row.id, ''),
    invoiceNumber: stringOr(row.invoiceNumber, stringOr(row.id, '')),
    type: parseInvoiceType(row.type),
    status: parseInvoiceStatus(row.status),
    source,
    amount: numberOr(row.amount, 0),
    dueDate: stringOr(row.dueDate, new Date(0).toISOString()),
    paidDate: stringOrNull(row.paidDate),
    categoryLabel: stringOrNull(row.categoryLabel),
    categoryColor: stringOrNull(row.categoryColor),
    createdAt: stringOr(row.createdAt, new Date(0).toISOString()),
    updatedAt: stringOr(row.updatedAt, stringOr(row.createdAt, new Date(0).toISOString())),
    parties: {
      unitId: stringOr(parties.unitId, ''),
      unitNumber: stringOr(parties.unitNumber, '--'),
      communityName: stringOr(parties.communityName, '--'),
      residentId: stringOrNull(parties.residentId),
      residentName: stringOrNull(parties.residentName),
      residentPhone: stringOrNull(parties.residentPhone),
    },
    sourceRecord: {
      kind: typeof sourceRecord.kind === 'string' && INVOICE_SOURCE_VALUES.has(sourceRecord.kind as InvoiceSourceType)
        ? (sourceRecord.kind as InvoiceSourceType)
        : source,
      id: stringOrNull(sourceRecord.id),
      label: stringOr(sourceRecord.label, 'Manually created'),
      secondaryLabel: stringOrNull(sourceRecord.secondaryLabel),
      amount: sourceRecord.amount === null ? null : numberOr(sourceRecord.amount, 0),
    },
    paymentHistory: paymentHistory
      .map((item) => {
        const entry = isObjectRecord(item) ? item : {};
        return {
          paidDate: stringOr(entry.paidDate, new Date(0).toISOString()),
          amount: numberOr(entry.amount, 0),
        };
      })
      .filter((item) => item.paidDate.length > 0),
    documents: documents
      .map((item) => {
        const entry = isObjectRecord(item) ? item : {};
        return {
          id: stringOr(entry.id, ''),
          fileId: stringOr(entry.fileId, ''),
          name: stringOr(entry.name, 'Attachment'),
          mimeType: stringOrNull(entry.mimeType),
          size: entry.size === null ? null : numberOr(entry.size, 0),
          key: stringOr(entry.key, ''),
          createdAt: stringOr(entry.createdAt, new Date(0).toISOString()),
        };
      })
      .filter((item) => item.id.length > 0),
  };
}

function unitLabel(row: UnitRow): string {
  return [
    row.projectName ? row.projectName : null,
    row.block ? `Block ${row.block}` : null,
    row.unitNumber ? `Unit ${row.unitNumber}` : null,
  ]
    .filter(Boolean)
    .join(' - ');
}

const invoiceService = {
  async listInvoices(
    filters: ListInvoicesFilters,
  ): Promise<InvoiceListResponse> {
    const response = await apiClient.get<InvoiceListResponse>('/invoices', {
      params: filters,
    });
    return normalizeListResponse(response.data);
  },

  async getInvoiceStats(filters?: {
    communityId?: string;
    createdFrom?: string;
    createdTo?: string;
    dueFrom?: string;
    dueTo?: string;
  }): Promise<InvoiceStats> {
    try {
      const response = await apiClient.get<InvoiceStats>('/invoices/stats', {
        params: filters,
      });
      return normalizeStats(response.data);
    } catch (error) {
      const status =
        isObjectRecord(error) &&
        isObjectRecord(error.response) &&
        typeof error.response.status === 'number'
          ? error.response.status
          : null;
      if (status === 404) {
        return getEmptyStats();
      }
      throw error;
    }
  },

  async getInvoiceDetail(id: string): Promise<InvoiceDetail> {
    const response = await apiClient.get<InvoiceDetail>(`/invoices/${id}`);
    return normalizeInvoiceDetail(response.data);
  },

  async createInvoice(payload: CreateInvoicePayload): Promise<InvoiceDetail> {
    const response = await apiClient.post<InvoiceDetail>('/invoices', payload);
    return response.data;
  },

  async markAsPaid(id: string, paidDate?: string): Promise<InvoiceDetail> {
    const response = await apiClient.patch<InvoiceDetail>(
      `/invoices/${id}/pay`,
      {
        paidDate,
      },
    );
    return response.data;
  },

  async cancelInvoice(id: string, reason: string): Promise<InvoiceDetail> {
    const response = await apiClient.patch<InvoiceDetail>(
      `/invoices/${id}/cancel`,
      {
        reason,
      },
    );
    return response.data;
  },

  async bulkMarkOverdue(): Promise<{ updatedCount: number }> {
    const response = await apiClient.post<{ updatedCount: number }>(
      '/invoices/bulk-overdue',
    );
    return response.data;
  },

  async listCategories(includeInactive = true): Promise<InvoiceCategory[]> {
    try {
      const response = await apiClient.get<InvoiceCategory[]>(
        '/invoice-categories',
        {
          params: { includeInactive },
        },
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      const status =
        isObjectRecord(error) &&
        isObjectRecord(error.response) &&
        typeof error.response.status === 'number'
          ? error.response.status
          : null;
      const message =
        isObjectRecord(error) &&
        isObjectRecord(error.response) &&
        isObjectRecord(error.response.data) &&
        typeof error.response.data.message === 'string'
          ? error.response.data.message
          : '';
      const missingTable =
        message.includes('InvoiceCategory') &&
        message.toLowerCase().includes('does not exist');

      if (status === 404 || missingTable) {
        return [];
      }
      throw error;
    }
  },

  async createCategory(payload: {
    label: string;
    mappedType?: InvoiceType;
    description?: string;
    color?: string;
  }): Promise<InvoiceCategory> {
    const response = await apiClient.post<InvoiceCategory>(
      '/invoice-categories',
      payload,
    );
    return response.data;
  },

  async updateCategory(
    id: string,
    payload: Partial<{
      label: string;
      mappedType: InvoiceType;
      description: string;
      color: string;
    }>,
  ): Promise<InvoiceCategory> {
    const response = await apiClient.patch<InvoiceCategory>(
      `/invoice-categories/${id}`,
      payload,
    );
    return response.data;
  },

  async toggleCategory(id: string): Promise<InvoiceCategory> {
    const response = await apiClient.patch<InvoiceCategory>(
      `/invoice-categories/${id}/toggle`,
    );
    return response.data;
  },

  async reorderCategories(orderedIds: string[]): Promise<InvoiceCategory[]> {
    const response = await apiClient.patch<InvoiceCategory[]>(
      '/invoice-categories/reorder',
      {
        orderedIds,
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async listCommunityOptions(): Promise<CommunityOption[]> {
    const response = await apiClient.get<
      CommunityRow[] | { data?: CommunityRow[] }
    >('/communities');
    const payload = response.data;
    const rows: CommunityRow[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.code ? `${row.name} (${row.code})` : row.name,
    }));
  },

  async listUnitOptions(): Promise<UnitOption[]> {
    const response = await apiClient.get<{ data?: UnitRow[] } | UnitRow[]>(
      '/units',
      {
        params: { page: 1, limit: 100 },
      },
    );
    const payload = response.data;
    const rows: UnitRow[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    return rows.map((row) => ({
      id: row.id,
      label: unitLabel(row) || row.id,
      communityId: row.communityId ?? null,
    }));
  },

  async listResidentOptions(): Promise<ResidentOption[]> {
    const response = await apiClient.get<ResidentRow[]>('/admin/users', {
      params: { userType: 'resident', take: 200, skip: 0 },
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.nameEN || row.email || row.id,
    }));
  },
};

export default invoiceService;
