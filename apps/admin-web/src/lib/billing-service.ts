import apiClient from "./api-client";

// ─── Types ────────────────────────────────────────────────────

export type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE" | "VOID" | "CANCELLED";
export type PaymentMethod = "BANK_TRANSFER" | "CASH" | "CHEQUE" | "ONLINE" | "CARD";

export interface BillingInvoice {
  id: string;
  invoiceNumber: string | null;
  title: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  status: InvoiceStatus;
  category: string;
  categoryLabel: string | null;
  notes: string | null;
  communityId: string | null;
  communityName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  residentId: string | null;
  residentName: string | null;
  residentPhone: string | null;
  unit: { id: string; unitNumber: string } | null;
  resident: { id: string; nameEN: string | null; phone?: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPayment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string | null;
  method: string;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  status: string | null;
  invoice: {
    id: string;
    title: string;
    unit: { id: string; unitNumber: string } | null;
  } | null;
  recordedBy: { id: string; nameEN: string | null } | null;
  createdAt: string;
}

export interface BillingStats {
  totalInvoiced: number;
  totalCollected: number;
  totalOverdue: number;
  pendingCount: number;
  overdueCount: number;
  paidCount: number;
  totalCount: number;
}

export interface CreateInvoicePayload {
  communityId: string;
  unitId: string;
  residentId?: string;
  title: string;
  amount: number;
  currency: string;
  dueDate: string;
  category: string;
  notes?: string;
}

export interface RecordPaymentPayload {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  paidAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fb = ""): string {
  return typeof v === "string" && v.trim().length > 0 ? v : fb;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function num(v: unknown, fb = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fb;
}

const INVOICE_STATUSES: ReadonlySet<string> = new Set([
  "PENDING", "PAID", "OVERDUE", "VOID", "CANCELLED",
]);

function parseInvoiceStatus(v: unknown): InvoiceStatus {
  if (typeof v === "string" && INVOICE_STATUSES.has(v)) return v as InvoiceStatus;
  return "PENDING";
}

function normalizeInvoice(v: unknown): BillingInvoice {
  const r = isObj(v) ? v : {};
  const unit = isObj(r.unit) ? r.unit : null;
  const resident = isObj(r.resident) ? r.resident : null;

  return {
    id: str(r.id),
    invoiceNumber: strOrNull(r.invoiceNumber),
    title: str(r.title, str(r.type, "Invoice")),
    amount: num(r.amount),
    currency: str(r.currency, "EGP"),
    dueDate: strOrNull(r.dueDate),
    status: parseInvoiceStatus(r.status),
    category: str(r.category, str(r.type, "OTHER")),
    categoryLabel: strOrNull(r.categoryLabel),
    notes: strOrNull(r.notes),
    communityId: strOrNull(r.communityId),
    communityName: strOrNull(r.communityName),
    unitId: strOrNull(r.unitId),
    unitNumber: strOrNull(r.unitNumber) ?? (unit ? str(unit.unitNumber, null as any) : null),
    residentId: strOrNull(r.residentId),
    residentName: strOrNull(r.residentName) ?? (resident ? strOrNull(resident.nameEN ?? resident.name) : null),
    residentPhone: resident ? strOrNull(resident.phone) : null,
    unit: unit ? { id: str(unit.id), unitNumber: str(unit.unitNumber, "--") } : null,
    resident: resident ? { id: str(resident.id), nameEN: strOrNull(resident.nameEN ?? resident.name), phone: strOrNull(resident.phone) } : null,
    createdAt: str(r.createdAt, new Date(0).toISOString()),
    updatedAt: str(r.updatedAt, str(r.createdAt, new Date(0).toISOString())),
  };
}

function normalizePayment(v: unknown): BillingPayment {
  const r = isObj(v) ? v : {};
  const inv = isObj(r.invoice) ? r.invoice : null;
  const invUnit = inv && isObj(inv.unit) ? inv.unit : null;
  const by = isObj(r.recordedBy) ? r.recordedBy : null;

  return {
    id: str(r.id),
    invoiceId: str(r.invoiceId),
    amount: num(r.amount),
    currency: strOrNull(r.currency),
    method: str(r.method, str(r.paymentMethod, "CASH")),
    referenceNumber: strOrNull(r.referenceNumber ?? r.transactionRef),
    notes: strOrNull(r.notes),
    paidAt: strOrNull(r.paidAt ?? r.paidDate ?? r.createdAt),
    status: strOrNull(r.status),
    invoice: inv
      ? {
          id: str(inv.id),
          title: str(inv.title, str(inv.type, "Invoice")),
          unit: invUnit ? { id: str(invUnit.id), unitNumber: str(invUnit.unitNumber, "--") } : null,
        }
      : null,
    recordedBy: by ? { id: str(by.id), nameEN: strOrNull(by.nameEN ?? by.name) } : null,
    createdAt: str(r.createdAt, new Date(0).toISOString()),
  };
}

function normalizeStats(v: unknown): BillingStats {
  const r = isObj(v) ? v : {};
  // Backend returns: totalRevenue, pendingAmount, overdueAmount, overdueCount, paidThisMonth, invoicesByStatus
  const byStatus = isObj(r.invoicesByStatus) ? r.invoicesByStatus : {};
  const pendingCount = num(byStatus.PENDING);
  const paidCount = num(byStatus.PAID);
  const overdueCount = num(r.overdueCount, num(byStatus.OVERDUE));
  const voidCount = num(byStatus.VOID) + num(byStatus.CANCELLED);
  const totalCount = pendingCount + paidCount + overdueCount + voidCount;
  return {
    totalInvoiced: num(r.totalRevenue) + num(r.pendingAmount) + num(r.overdueAmount),
    totalCollected: num(r.totalRevenue),
    totalOverdue: num(r.overdueAmount),
    pendingCount,
    overdueCount,
    paidCount,
    totalCount,
  };
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

function normalizePaginated<T>(
  payload: unknown,
  normalizer: (item: unknown) => T,
): PaginatedResponse<T> {
  if (isObj(payload)) {
    const items = Array.isArray(payload.data) ? payload.data : [];
    const data = items.map(normalizer);
    return { data, total: num(payload.total, data.length) };
  }
  if (Array.isArray(payload)) {
    const data = payload.map(normalizer);
    return { data, total: data.length };
  }
  return { data: [], total: 0 };
}

// ─── Service ──────────────────────────────────────────────────

interface ListInvoicesParams {
  communityId?: string;
  status?: InvoiceStatus;
  category?: string;
  unitId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ListPaymentsParams {
  communityId?: string;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const billingService = {
  async getStats(communityId?: string): Promise<BillingStats> {
    try {
      const res = await apiClient.get("/invoices/stats", {
        params: communityId ? { communityId } : undefined,
      });
      return normalizeStats(res.data);
    } catch {
      return {
        totalInvoiced: 0, totalCollected: 0, totalOverdue: 0,
        pendingCount: 0, overdueCount: 0, paidCount: 0, totalCount: 0,
      };
    }
  },

  async listInvoices(params: ListInvoicesParams): Promise<PaginatedResponse<BillingInvoice>> {
    const query: Record<string, unknown> = {};
    if (params.communityId) query.communityId = params.communityId;
    if (params.status) query.status = params.status;
    if (params.category) query.type = params.category;
    if (params.unitId) query.unitId = params.unitId;
    if (params.from) query.dueFrom = params.from;
    if (params.to) query.dueTo = params.to;
    if (params.search) query.search = params.search;
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;

    const res = await apiClient.get("/invoices", { params: query });
    return normalizePaginated(res.data, normalizeInvoice);
  },

  async listPayments(params: ListPaymentsParams): Promise<PaginatedResponse<BillingPayment>> {
    const query: Record<string, unknown> = {};
    if (params.communityId) query.communityId = params.communityId;
    if (params.method) query.method = params.method;
    if (params.from) query.from = params.from;
    if (params.to) query.to = params.to;
    if (params.search) query.search = params.search;
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;

    // Derive payments from paid invoices to avoid relying on non-canonical endpoints.
    const invoiceQuery = { ...query, status: "PAID" };
    const res = await apiClient.get("/invoices", { params: invoiceQuery });
    const paginated = normalizePaginated(res.data, normalizeInvoice);
    const payments: BillingPayment[] = paginated.data.map((inv) => ({
      id: inv.id,
      invoiceId: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      method: "CASH",
      referenceNumber: inv.invoiceNumber,
      notes: inv.notes,
      paidAt: inv.updatedAt,
      status: "COMPLETED",
      invoice: { id: inv.id, title: inv.title, unit: inv.unit },
      recordedBy: null,
      createdAt: inv.updatedAt,
    }));
    return { data: payments, total: paginated.total };
  },

  async createInvoice(payload: CreateInvoicePayload): Promise<BillingInvoice> {
    const res = await apiClient.post("/invoices", {
      unitId: payload.unitId,
      residentId: payload.residentId,
      type: payload.category,
      amount: payload.amount,
      dueDate: payload.dueDate,
      notes: payload.notes,
    });
    return normalizeInvoice(res.data);
  },

  async recordPayment(payload: RecordPaymentPayload): Promise<unknown> {
    const res = await apiClient.patch(`/invoices/${payload.invoiceId}/pay`, {
      paidDate: payload.paidAt,
      paymentMethod: payload.method,
      referenceNumber: payload.referenceNumber,
      notes: payload.notes,
    });
    return res.data;
  },

  async voidInvoice(id: string): Promise<unknown> {
    const res = await apiClient.patch(`/invoices/${id}/cancel`, {
      reason: "Voided by admin",
    });
    return res.data;
  },

  async listCommunityOptions(): Promise<Array<{ id: string; label: string }>> {
    const res = await apiClient.get("/communities");
    const payload = res.data;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    return rows.map((r: Record<string, unknown>) => ({
      id: str(r.id),
      label: str(r.name, str(r.nameEN, str(r.label, "--"))),
    }));
  },

  async listUnitOptions(communityId: string): Promise<Array<{ id: string; label: string }>> {
    const res = await apiClient.get("/units", {
      params: { communityId, limit: 500 },
    });
    const payload = res.data;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    return rows.map((r: Record<string, unknown>) => ({
      id: str(r.id),
      label: str(r.unitNumber, str(r.label, "--")),
    }));
  },

  async listResidentOptions(communityId: string): Promise<Array<{ id: string; label: string }>> {
    const res = await apiClient.get("/admin/users", {
      params: { userType: "resident", take: 500, skip: 0 },
    });
    const payload = res.data;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    const filtered = rows.filter((row: Record<string, unknown>) => {
      if (!communityId) return true;
      if (strOrNull(row.communityId) === communityId) return true;
      const resident = isObj(row.resident) ? row.resident : null;
      if (resident && strOrNull(resident.communityId) === communityId) return true;
      const unitAccesses = Array.isArray(row.unitAccesses) ? row.unitAccesses : [];
      return unitAccesses.some((ua) => {
        if (!isObj(ua)) return false;
        const unit = isObj(ua.unit) ? ua.unit : null;
        return unit ? strOrNull(unit.communityId) === communityId : false;
      });
    });

    return filtered.map((r: Record<string, unknown>) => ({
      id: str(r.id),
      label: str(r.nameEN, str(r.name, str(r.email, "--"))),
    }));
  },
};

export default billingService;
