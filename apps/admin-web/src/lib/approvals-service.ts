import apiClient, { API_BASE_URL } from "./api-client";
import unitService from "./unit-service";
import usersService from "./users-service";

export type ApprovalType = "OWNER" | "FAMILY" | "DELEGATE" | "HOME_STAFF";
export type OwnerQueueStatus = "PENDING" | "PROCESSING" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type HouseholdQueueStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type FamilyRelationship = "SON_DAUGHTER" | "MOTHER_FATHER" | "SPOUSE";
export type HomeStaffType = "DRIVER" | "NANNY" | "SERVANT" | "GARDENER" | "OTHER";
export type DelegateFeeMode = "NO_FEE" | "FEE_REQUIRED";

export type ApprovalDocument = {
  label: string;
  url: string;
};

export type ApprovalDocuments = {
  photo: string | null;
  nationalId: string | null;
  passport: string | null;
  other: ApprovalDocument[];
};

export type ApprovalBaseItem = {
  id: string;
  type: ApprovalType;
  status: OwnerQueueStatus | HouseholdQueueStatus;
  submittedAt: string;
  isPreRegistration: boolean;
  documents: ApprovalDocuments;
};

export type OwnerApprovalItem = ApprovalBaseItem & {
  name: string | null;
  phone: string;
  email: string | null;
  nationalId: string;
  roleIntent: string | null;
  origin: string;
  expiresAt: string;
  verificationCode: string | null;
  photoUrl: string | null;
  nationalIdFileUrl: string | null;
  lookupResult: Record<string, unknown> | null;
};

export type FamilyApprovalItem = ApprovalBaseItem & {
  fullName: string;
  phone: string;
  email: string | null;
  relationship: FamilyRelationship;
  ownerUserId: string;
  ownerName: string;
  unitId: string;
  unitNumber: string | null;
  projectName: string;
  nationality: string;
  nationalIdOrPassport: string | null;
  featurePermissions: Record<string, unknown> | null;
};

export type DelegateApprovalItem = ApprovalBaseItem & {
  fullName: string;
  phone: string;
  email: string | null;
  ownerUserId: string;
  ownerName: string;
  unitId: string;
  unitNumber: string | null;
  projectName: string;
  validFrom: string;
  validTo: string;
  qrScopes: string[];
  feeMode: DelegateFeeMode;
  feeAmount: number | null;
  featurePermissions: Record<string, unknown> | null;
};

export type HomeStaffApprovalItem = ApprovalBaseItem & {
  fullName: string;
  phone: string;
  ownerUserId: string;
  ownerName: string;
  unitId: string;
  unitNumber: string | null;
  projectName: string;
  staffType: HomeStaffType;
  accessValidFrom: string;
  accessValidTo: string;
  isLiveIn: boolean;
  employmentFrom: string | null;
  employmentTo: string | null;
};

export type ApprovalStats = {
  pendingOwners: number;
  pendingFamilyMembers: number;
  pendingDelegates: number;
  pendingHomeStaff: number;
  pendingTenants: number;
  totalPending: number;
};

export type TenantApprovalItem = {
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
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  contractFileId: string | null;
  tenantNationalIdFileId: string | null;
};

export type TenantFilter = {
  search?: string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  page?: number;
  limit?: number;
};

export type ApprovalActionResponse = {
  success: true;
  id: string;
  status: OwnerQueueStatus | HouseholdQueueStatus;
};

export type PreRegistrationResponse = {
  success: true;
  userId: string;
  requestId: string;
  status: OwnerQueueStatus | HouseholdQueueStatus;
};

export type OwnerFilter = {
  search?: string;
  status?: "PENDING" | "PROCESSING" | "ALL";
  dateFrom?: string;
  dateTo?: string;
  registrationType?: "SELF" | "PRE_REG";
};

export type FamilyFilter = {
  search?: string;
  status?: HouseholdQueueStatus;
  dateFrom?: string;
  dateTo?: string;
  ownerUserId?: string;
  unitId?: string;
  relationship?: FamilyRelationship;
};

export type DelegateFilter = {
  search?: string;
  status?: HouseholdQueueStatus;
  dateFrom?: string;
  dateTo?: string;
  ownerUserId?: string;
  feeMode?: DelegateFeeMode;
};

export type HomeStaffFilter = {
  search?: string;
  status?: HouseholdQueueStatus;
  dateFrom?: string;
  dateTo?: string;
  staffType?: HomeStaffType;
};

export type PreRegisterOwnerPayload = {
  nameEN: string;
  email: string;
  phone: string;
  nationalId: string;
  unitId?: string;
  notes?: string;
};

export type PreRegisterFamilyPayload = {
  ownerUserId: string;
  unitId: string;
  fullName: string;
  phone: string;
  relationship: FamilyRelationship;
  email?: string;
  nationalIdOrPassport?: string;
  notes?: string;
};

export type OwnerOption = {
  id: string;
  label: string;
};

export type UnitOption = {
  id: string;
  label: string;
};

function normalizeFileUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

const approvalsService = {
  async getStats(): Promise<ApprovalStats> {
    const response = await apiClient.get<ApprovalStats>("/approvals/stats");
    return response.data;
  },

  async listOwners(filters: OwnerFilter): Promise<OwnerApprovalItem[]> {
    const response = await apiClient.get<OwnerApprovalItem[]>("/approvals/owners", {
      params: filters,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async listFamilyMembers(filters: FamilyFilter): Promise<FamilyApprovalItem[]> {
    const response = await apiClient.get<FamilyApprovalItem[]>("/approvals/family-members", {
      params: filters,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async listDelegates(filters: DelegateFilter): Promise<DelegateApprovalItem[]> {
    const response = await apiClient.get<DelegateApprovalItem[]>("/approvals/delegates", {
      params: filters,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async listHomeStaff(filters: HomeStaffFilter): Promise<HomeStaffApprovalItem[]> {
    const response = await apiClient.get<HomeStaffApprovalItem[]>("/approvals/home-staff", {
      params: filters,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async approveOwner(id: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/owners/${id}/approve`);
    return response.data;
  },

  async rejectOwner(id: string, reason: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/owners/${id}/reject`, { reason });
    return response.data;
  },

  async approveFamilyMember(id: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/family-members/${id}/approve`);
    return response.data;
  },

  async rejectFamilyMember(id: string, reason: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/family-members/${id}/reject`, {
      reason,
    });
    return response.data;
  },

  async approveDelegate(id: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/delegates/${id}/approve`);
    return response.data;
  },

  async rejectDelegate(id: string, reason: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/delegates/${id}/reject`, {
      reason,
    });
    return response.data;
  },

  async approveHomeStaff(id: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/home-staff/${id}/approve`);
    return response.data;
  },

  async rejectHomeStaff(id: string, reason: string): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(`/approvals/home-staff/${id}/reject`, {
      reason,
    });
    return response.data;
  },

  async preRegisterOwner(payload: PreRegisterOwnerPayload): Promise<PreRegistrationResponse> {
    const response = await apiClient.post<PreRegistrationResponse>("/approvals/pre-register/owner", payload);
    return response.data;
  },

  async preRegisterFamilyMember(payload: PreRegisterFamilyPayload): Promise<PreRegistrationResponse> {
    const response = await apiClient.post<PreRegistrationResponse>(
      "/approvals/pre-register/family-member",
      payload,
    );
    return response.data;
  },

  async listOwnerOptions(): Promise<OwnerOption[]> {
    const response = await usersService.listOwners({ page: 1, limit: 100 });
    return response.items.map((row) => ({
      id: row.userId,
      label: row.email ? `${row.name} (${row.email})` : row.name,
    }));
  },

  async listUnitOptions(): Promise<UnitOption[]> {
    const response = await unitService.listUnits({ page: 1, limit: 100 });
    return response.data.map((row) => ({
      id: row.id,
      label: [row.projectName, row.block ? `Block ${row.block}` : null, row.unitNumber]
        .filter(Boolean)
        .join(" - "),
    }));
  },

  async listTenants(filters: TenantFilter): Promise<{ data: TenantApprovalItem[]; total: number }> {
    const params: Record<string, unknown> = {
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
    };
    if (filters.search) params.search = filters.search;
    if (filters.status && filters.status !== "ALL") params.status = filters.status;
    let raw: unknown;
    try {
      const response = await apiClient.get("/rental/requests", { params });
      raw = response.data;
    } catch {
      const legacyResponse = await apiClient.get("/rental/rent-requests", { params });
      raw = legacyResponse.data;
    }
    if (raw && typeof raw === "object" && "data" in raw) {
      return { data: (raw as any).data as TenantApprovalItem[], total: (raw as any).total ?? 0 };
    }
    const arr = Array.isArray(raw) ? raw : [];
    return { data: arr as TenantApprovalItem[], total: arr.length };
  },

  async approveTenant(id: string): Promise<{ success: true }> {
    try {
      const response = await apiClient.post(`/rental/requests/${id}/approve`);
      return response.data as { success: true };
    } catch {
      const legacyResponse = await apiClient.post(`/rental/rent-requests/${id}/approve`);
      return legacyResponse.data as { success: true };
    }
  },

  async rejectTenant(id: string, reason: string): Promise<{ success: true }> {
    try {
      const response = await apiClient.post(`/rental/requests/${id}/reject`, { reason });
      return response.data as { success: true };
    } catch {
      const legacyResponse = await apiClient.post(`/rental/rent-requests/${id}/reject`, {
        reason,
      });
      return legacyResponse.data as { success: true };
    }
  },

  async fetchDocumentBlob(url: string): Promise<Blob> {
    const response = await apiClient.get(normalizeFileUrl(url), {
      responseType: "blob",
    });
    return response.data as Blob;
  },
};

export default approvalsService;

