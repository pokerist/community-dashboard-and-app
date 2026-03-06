import apiClient from "./api-client";

export type LeaseStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "TERMINATED";
export type LeaseSource = "OWNER" | "COMPOUND";
export type RentRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type InvoiceStatus = "PAID" | "PENDING" | "OVERDUE" | "CANCELLED";

export interface RentalSettings {
  leasingEnabled: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
}

export interface ToggleLeasingPayload {
  enabled: boolean;
  reason?: string;
}

export interface RentalStats {
  activeLeases: number;
  expiringThisMonth: number;
  expiredLeases: number;
  pendingRentRequests: number;
  totalMonthlyRevenue: number;
  leasingEnabled: boolean;
}

export interface LeaseListItem {
  id: string;
  unitNumber: string;
  communityName: string;
  ownerName: string;
  tenantName: string | null;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  status: LeaseStatus;
  daysUntilExpiry: number | null;
  source: LeaseSource;
}

export interface LeaseRenewalLink {
  id: string;
  startDate: string;
  endDate: string;
  status: LeaseStatus;
}

export interface LeaseInvoiceHistoryItem {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  paidDate: string | null;
}

export interface LeasePersonSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface LeaseUnitSummary {
  id: string;
  unitNumber: string;
  projectName: string;
  communityName: string | null;
}

export interface LeaseDetail {
  id: string;
  status: LeaseStatus;
  source: LeaseSource;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number | null;
  autoRenew: boolean;
  renewalNoticeSentAt: string | null;
  unit: LeaseUnitSummary;
  owner: LeasePersonSummary;
  tenant: LeasePersonSummary | null;
  renewedFrom: LeaseRenewalLink | null;
  renewedTo: LeaseRenewalLink | null;
  renewalChain: LeaseRenewalLink[];
  invoiceHistory: LeaseInvoiceHistoryItem[];
}

export interface ListLeasesFilters {
  communityId?: string;
  unitId?: string;
  status?: LeaseStatus;
  ownerId?: string;
  tenantId?: string;
  expiringWithinDays?: number;
  search?: string;
}

export interface RenewLeasePayload {
  startDate: string;
  endDate: string;
  monthlyRent: number;
  autoRenew?: boolean;
}

export interface TerminateLeasePayload {
  reason: string;
}

export interface RentRequestListItem {
  id: string;
  unitId: string;
  unitNumber: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantNationality: string;
  status: RentRequestStatus;
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  contractFileId: string | null;
  tenantNationalIdFileId: string | null;
}

export interface ListRentRequestsFilters {
  ownerUserId?: string;
  from?: string;
  to?: string;
  status?: RentRequestStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedRentRequests {
  data: RentRequestListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CommunityOption {
  id: string;
  name: string;
}

const LEASE_STATUS_VALUES: ReadonlySet<LeaseStatus> = new Set([
  "ACTIVE",
  "EXPIRING_SOON",
  "EXPIRED",
  "TERMINATED",
]);

const LEASE_SOURCE_VALUES: ReadonlySet<LeaseSource> = new Set([
  "OWNER",
  "COMPOUND",
]);

const RENT_REQUEST_STATUS_VALUES: ReadonlySet<RentRequestStatus> = new Set([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

const INVOICE_STATUS_VALUES: ReadonlySet<InvoiceStatus> = new Set([
  "PAID",
  "PENDING",
  "OVERDUE",
  "CANCELLED",
]);

const DEFAULT_SETTINGS: RentalSettings = {
  leasingEnabled: true,
  suspensionReason: null,
  suspendedAt: null,
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return parsed.toISOString();
}

function parseLeaseStatus(value: unknown): LeaseStatus {
  if (typeof value === "string" && LEASE_STATUS_VALUES.has(value as LeaseStatus)) {
    return value as LeaseStatus;
  }
  return "ACTIVE";
}

function parseLeaseSource(value: unknown): LeaseSource {
  if (typeof value === "string" && LEASE_SOURCE_VALUES.has(value as LeaseSource)) {
    return value as LeaseSource;
  }
  return "OWNER";
}

function parseRentRequestStatus(value: unknown): RentRequestStatus {
  if (
    typeof value === "string" &&
    RENT_REQUEST_STATUS_VALUES.has(value as RentRequestStatus)
  ) {
    return value as RentRequestStatus;
  }
  return "PENDING";
}

function parseInvoiceStatus(value: unknown): InvoiceStatus {
  if (
    typeof value === "string" &&
    INVOICE_STATUS_VALUES.has(value as InvoiceStatus)
  ) {
    return value as InvoiceStatus;
  }
  return "PENDING";
}

function calculateDaysUntilExpiry(
  endDateIso: string,
  status: LeaseStatus,
): number | null {
  if (status !== "ACTIVE") {
    return null;
  }
  const endDate = new Date(endDateIso);
  if (Number.isNaN(endDate.getTime())) {
    return null;
  }
  const diffMs = endDate.getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function getErrorStatus(error: unknown): number | null {
  if (!isObjectRecord(error)) {
    return null;
  }
  const response = error.response;
  if (!isObjectRecord(response)) {
    return null;
  }
  const status = response.status;
  return typeof status === "number" ? status : null;
}

function isNotFoundError(error: unknown): boolean {
  return getErrorStatus(error) === 404;
}

function normalizeLeaseListItem(value: unknown): LeaseListItem {
  const row = isObjectRecord(value) ? value : {};
  const unit = isObjectRecord(row.unit) ? row.unit : {};
  const owner = isObjectRecord(row.owner) ? row.owner : {};
  const tenant = isObjectRecord(row.tenant) ? row.tenant : {};
  const community = isObjectRecord(unit.community) ? unit.community : {};

  const status = parseLeaseStatus(row.status);
  const endDate = parseIsoDate(row.endDate, new Date(0).toISOString());
  const explicitDays =
    row.daysUntilExpiry === null
      ? null
      : numberOr(row.daysUntilExpiry, Number.NaN);
  const daysUntilExpiry = Number.isFinite(explicitDays as number)
    ? (explicitDays as number)
    : calculateDaysUntilExpiry(endDate, status);

  return {
    id: stringOr(row.id, ""),
    unitNumber: stringOr(row.unitNumber, stringOr(unit.unitNumber, "--")),
    communityName: stringOr(
      row.communityName,
      stringOr(community.name, stringOr(unit.projectName, "--")),
    ),
    ownerName: stringOr(row.ownerName, stringOr(owner.nameEN, "--")),
    tenantName: stringOrNull(row.tenantName ?? tenant.nameEN),
    monthlyRent: numberOr(row.monthlyRent, 0),
    startDate: parseIsoDate(row.startDate, new Date(0).toISOString()),
    endDate,
    status,
    daysUntilExpiry,
    source: parseLeaseSource(row.source),
  };
}

function normalizeLeaseRenewalLink(value: unknown): LeaseRenewalLink | null {
  if (!isObjectRecord(value)) {
    return null;
  }
  return {
    id: stringOr(value.id, ""),
    startDate: parseIsoDate(value.startDate, new Date(0).toISOString()),
    endDate: parseIsoDate(value.endDate, new Date(0).toISOString()),
    status: parseLeaseStatus(value.status),
  };
}

function normalizeLeaseInvoiceItem(value: unknown): LeaseInvoiceHistoryItem {
  const row = isObjectRecord(value) ? value : {};
  return {
    id: stringOr(row.id, ""),
    invoiceNumber: stringOr(row.invoiceNumber, ""),
    dueDate: parseIsoDate(row.dueDate, new Date(0).toISOString()),
    amount: numberOr(row.amount, 0),
    status: parseInvoiceStatus(row.status),
    paidDate: stringOrNull(row.paidDate),
  };
}

function normalizeLeasePerson(value: unknown): LeasePersonSummary {
  const row = isObjectRecord(value) ? value : {};
  return {
    id: stringOr(row.id, ""),
    name: stringOrNull(row.name ?? row.nameEN),
    email: stringOrNull(row.email),
    phone: stringOrNull(row.phone),
  };
}

function normalizeLeaseDetail(value: unknown): LeaseDetail {
  const row = isObjectRecord(value) ? value : {};
  const unit = isObjectRecord(row.unit) ? row.unit : {};
  const community = isObjectRecord(unit.community) ? unit.community : {};
  const status = parseLeaseStatus(row.status);

  return {
    id: stringOr(row.id, ""),
    status,
    source: parseLeaseSource(row.source),
    startDate: parseIsoDate(row.startDate, new Date(0).toISOString()),
    endDate: parseIsoDate(row.endDate, new Date(0).toISOString()),
    monthlyRent: numberOr(row.monthlyRent, 0),
    securityDeposit:
      row.securityDeposit === null ? null : numberOr(row.securityDeposit, 0),
    autoRenew: typeof row.autoRenew === "boolean" ? row.autoRenew : false,
    renewalNoticeSentAt: stringOrNull(row.renewalNoticeSentAt),
    unit: {
      id: stringOr(unit.id, ""),
      unitNumber: stringOr(unit.unitNumber, "--"),
      projectName: stringOr(unit.projectName, "--"),
      communityName: stringOrNull(unit.communityName ?? community.name),
    },
    owner: normalizeLeasePerson(row.owner),
    tenant: row.tenant === null ? null : normalizeLeasePerson(row.tenant),
    renewedFrom: normalizeLeaseRenewalLink(row.renewedFrom),
    renewedTo: normalizeLeaseRenewalLink(row.renewedTo),
    renewalChain: Array.isArray(row.renewalChain)
      ? row.renewalChain
          .map((item) => normalizeLeaseRenewalLink(item))
          .filter((item): item is LeaseRenewalLink => item !== null)
      : [],
    invoiceHistory: Array.isArray(row.invoiceHistory)
      ? row.invoiceHistory.map((item) => normalizeLeaseInvoiceItem(item))
      : [],
  };
}

function normalizeRentRequestItem(value: unknown): RentRequestListItem {
  const row = isObjectRecord(value) ? value : {};
  const owner = isObjectRecord(row.owner) ? row.owner : {};
  const unit = isObjectRecord(row.unit) ? row.unit : {};
  const reviewedBy = isObjectRecord(row.reviewedBy) ? row.reviewedBy : {};

  return {
    id: stringOr(row.id, ""),
    unitId: stringOr(row.unitId, stringOr(unit.id, "")),
    unitNumber: stringOr(row.unitNumber, stringOr(unit.unitNumber, "--")),
    ownerUserId: stringOr(row.ownerUserId, stringOr(owner.id, "")),
    ownerName: stringOrNull(row.ownerName ?? owner.nameEN),
    ownerEmail: stringOrNull(row.ownerEmail ?? owner.email),
    tenantName: stringOr(row.tenantName, "--"),
    tenantEmail: stringOr(row.tenantEmail, "--"),
    tenantPhone: stringOr(row.tenantPhone, "--"),
    tenantNationality: stringOr(row.tenantNationality, "EGYPTIAN"),
    status: parseRentRequestStatus(row.status),
    rejectionReason: stringOrNull(row.rejectionReason),
    requestedAt: parseIsoDate(
      row.requestedAt ?? row.createdAt,
      new Date(0).toISOString(),
    ),
    reviewedAt: stringOrNull(row.reviewedAt),
    reviewedByName: stringOrNull(row.reviewedByName ?? reviewedBy.nameEN),
    contractFileId: stringOrNull(row.contractFileId),
    tenantNationalIdFileId: stringOrNull(row.tenantNationalIdFileId),
  };
}

function normalizePaginatedRequests(
  payload: unknown,
  fallbackPage: number,
  fallbackLimit: number,
): PaginatedRentRequests {
  if (isObjectRecord(payload)) {
    const data = Array.isArray(payload.data)
      ? payload.data.map((item) => normalizeRentRequestItem(item))
      : [];
    return {
      data,
      total: numberOr(payload.total, data.length),
      page: numberOr(payload.page, fallbackPage),
      limit: numberOr(payload.limit, fallbackLimit),
    };
  }

  if (Array.isArray(payload)) {
    const data = payload.map((item) => normalizeRentRequestItem(item));
    return {
      data,
      total: data.length,
      page: fallbackPage,
      limit: fallbackLimit,
    };
  }

  return {
    data: [],
    total: 0,
    page: fallbackPage,
    limit: fallbackLimit,
  };
}

function filterLegacyRequests(
  rows: RentRequestListItem[],
  filters: ListRentRequestsFilters,
): RentRequestListItem[] {
  const search = filters.search?.trim().toLowerCase();
  const fromTime = filters.from ? new Date(filters.from).getTime() : null;
  const toTime = filters.to ? new Date(filters.to).getTime() : null;

  return rows.filter((row) => {
    if (filters.ownerUserId && row.ownerUserId !== filters.ownerUserId) {
      return false;
    }
    if (filters.status && row.status !== filters.status) {
      return false;
    }
    if (search) {
      const haystack = [
        row.tenantName,
        row.tenantEmail,
        row.ownerName ?? "",
        row.unitNumber,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    const requestedAtTime = new Date(row.requestedAt).getTime();
    if (fromTime !== null && Number.isFinite(fromTime) && requestedAtTime < fromTime) {
      return false;
    }
    if (toTime !== null && Number.isFinite(toTime) && requestedAtTime > toTime) {
      return false;
    }
    return true;
  });
}

const rentalService = {
  async getSettings(): Promise<RentalSettings> {
    try {
      const response = await apiClient.get<RentalSettings>("/rental/settings");
      const data = response.data;
      return {
        leasingEnabled:
          typeof data?.leasingEnabled === "boolean"
            ? data.leasingEnabled
            : DEFAULT_SETTINGS.leasingEnabled,
        suspensionReason:
          typeof data?.suspensionReason === "string"
            ? data.suspensionReason
            : null,
        suspendedAt:
          typeof data?.suspendedAt === "string" ? data.suspendedAt : null,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return DEFAULT_SETTINGS;
      }
      throw error;
    }
  },

  async toggleLeasing(payload: ToggleLeasingPayload): Promise<RentalSettings> {
    try {
      const response = await apiClient.patch<RentalSettings>(
        "/rental/settings/toggle",
        payload,
      );
      return response.data;
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          leasingEnabled: payload.enabled,
          suspensionReason: payload.enabled ? null : payload.reason ?? null,
          suspendedAt: payload.enabled ? null : new Date().toISOString(),
        };
      }
      throw error;
    }
  },

  async getStats(): Promise<RentalStats> {
    try {
      const response = await apiClient.get<RentalStats>("/rental/stats");
      const payload = response.data;
      return {
        activeLeases: numberOr(payload.activeLeases, 0),
        expiringThisMonth: numberOr(payload.expiringThisMonth, 0),
        expiredLeases: numberOr(payload.expiredLeases, 0),
        pendingRentRequests: numberOr(payload.pendingRentRequests, 0),
        totalMonthlyRevenue: numberOr(payload.totalMonthlyRevenue, 0),
        leasingEnabled:
          typeof payload.leasingEnabled === "boolean"
            ? payload.leasingEnabled
            : true,
      };
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const [leasesResponse, requestsResponse] = await Promise.all([
        apiClient.get<unknown[]>("/leases"),
        apiClient.get<unknown[]>("/rent-requests/admin"),
      ]);

      const leases = Array.isArray(leasesResponse.data)
        ? leasesResponse.data.map((item) => normalizeLeaseListItem(item))
        : [];
      const requests = Array.isArray(requestsResponse.data)
        ? requestsResponse.data.map((item) => normalizeRentRequestItem(item))
        : [];

      const activeLeases = leases.filter((row) => row.status === "ACTIVE");
      const expiringThisMonth = activeLeases.filter((row) => {
        const days = row.daysUntilExpiry;
        return days !== null && days >= 0 && days <= 30;
      }).length;
      const expiredLeases = leases.filter((row) => {
        if (row.status === "EXPIRED") return true;
        if (row.status !== "ACTIVE") return false;
        const days = row.daysUntilExpiry;
        return days !== null && days < 0;
      }).length;

      return {
        activeLeases: activeLeases.length,
        expiringThisMonth,
        expiredLeases,
        pendingRentRequests: requests.filter((row) => row.status === "PENDING")
          .length,
        totalMonthlyRevenue: activeLeases.reduce(
          (sum, row) => sum + row.monthlyRent,
          0,
        ),
        leasingEnabled: true,
      };
    }
  },

  async listLeases(filters: ListLeasesFilters): Promise<LeaseListItem[]> {
    try {
      const response = await apiClient.get<unknown[]>("/rental/leases", {
        params: filters,
      });
      return Array.isArray(response.data)
        ? response.data.map((item) => normalizeLeaseListItem(item))
        : [];
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const response = await apiClient.get<unknown[]>("/leases");
      const rows = Array.isArray(response.data)
        ? response.data.map((item) => normalizeLeaseListItem(item))
        : [];

      const search = filters.search?.trim().toLowerCase();

      return rows
        .filter((row) => {
          if (filters.status && row.status !== filters.status) {
            return false;
          }
          if (search) {
            const haystack = [
              row.unitNumber,
              row.ownerName,
              row.tenantName ?? "",
              row.communityName,
            ]
              .join(" ")
              .toLowerCase();
            if (!haystack.includes(search)) {
              return false;
            }
          }
          if (
            typeof filters.expiringWithinDays === "number" &&
            row.status === "ACTIVE"
          ) {
            const days = row.daysUntilExpiry;
            if (
              days === null ||
              days < 0 ||
              days > filters.expiringWithinDays
            ) {
              return false;
            }
          }
          return true;
        })
        .sort((a, b) => a.endDate.localeCompare(b.endDate));
    }
  },

  async getLeaseDetail(id: string): Promise<LeaseDetail> {
    try {
      const response = await apiClient.get<LeaseDetail>(`/rental/leases/${id}`);
      return normalizeLeaseDetail(response.data);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      const legacy = await apiClient.get<LeaseDetail | unknown>(`/leases/${id}`);
      return normalizeLeaseDetail(legacy.data);
    }
  },

  async renewLease(id: string, payload: RenewLeasePayload): Promise<LeaseDetail> {
    try {
      const response = await apiClient.post<LeaseDetail>(
        `/rental/leases/${id}/renew`,
        payload,
      );
      return normalizeLeaseDetail(response.data);
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new Error("Lease renewal endpoint is unavailable on this backend build");
      }
      throw error;
    }
  },

  async terminateLease(id: string, payload: TerminateLeasePayload): Promise<LeaseDetail> {
    try {
      const response = await apiClient.post<LeaseDetail>(
        `/rental/leases/${id}/terminate`,
        payload,
      );
      return normalizeLeaseDetail(response.data);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      const response = await apiClient.post<LeaseDetail>(
        `/leases/${id}/terminate`,
        payload,
      );
      return normalizeLeaseDetail(response.data);
    }
  },

  async listRequests(filters: ListRentRequestsFilters): Promise<PaginatedRentRequests> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    try {
      const response = await apiClient.get<PaginatedRentRequests>(
        "/rental/requests",
        {
          params: { ...filters, page, limit },
        },
      );
      return normalizePaginatedRequests(response.data, page, limit);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }

      const legacyResponse = await apiClient.get<unknown[]>("/rent-requests/admin");
      const legacyRows = Array.isArray(legacyResponse.data)
        ? legacyResponse.data.map((item) => normalizeRentRequestItem(item))
        : [];

      const filtered = filterLegacyRequests(legacyRows, filters);
      const start = (page - 1) * limit;
      return {
        data: filtered.slice(start, start + limit),
        total: filtered.length,
        page,
        limit,
      };
    }
  },

  async approveRequest(id: string): Promise<RentRequestListItem> {
    try {
      const response = await apiClient.post<RentRequestListItem>(
        `/rental/requests/${id}/approve`,
      );
      return normalizeRentRequestItem(response.data);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      const response = await apiClient.patch<RentRequestListItem>(
        `/rent-requests/${id}/review`,
        { status: "APPROVED" },
      );
      return normalizeRentRequestItem(response.data);
    }
  },

  async rejectRequest(id: string, reason: string): Promise<RentRequestListItem> {
    try {
      const response = await apiClient.post<RentRequestListItem>(
        `/rental/requests/${id}/reject`,
        { reason },
      );
      return normalizeRentRequestItem(response.data);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      const response = await apiClient.patch<RentRequestListItem>(
        `/rent-requests/${id}/review`,
        { status: "REJECTED", rejectionReason: reason },
      );
      return normalizeRentRequestItem(response.data);
    }
  },

  async listCommunities(): Promise<CommunityOption[]> {
    const response = await apiClient.get<
      Array<{ id: string; name: string }> | { data?: Array<{ id: string; name: string }> }
    >("/communities");
    const payload = response.data;
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));
  },
};

export default rentalService;
