import apiClient from "./api-client";
import type { GateItem } from "./community-service";

export type UnitCategory = "RESIDENTIAL" | "COMMERCIAL";

export type UnitType =
  | "VILLA"
  | "APARTMENT"
  | "PENTHOUSE"
  | "DUPLEX"
  | "TOWNHOUSE"
  | "ADMINISTRATIVE"
  | "COMMERCIAL_UNIT";

export type UnitStatus =
  | "OFF_PLAN"
  | "UNDER_CONSTRUCTION"
  | "DELIVERED";

export type UnitDisplayStatus =
  | "OFF_PLAN"
  | "UNDER_CONSTRUCTION"
  | "DELIVERED";

export type GateAccessMode = "ALL_GATES" | "SELECTED_GATES";

export interface UnitListItem {
  id: string;
  communityId: string | null;
  phaseId: string | null;
  clusterId: string | null;
  unitNumber: string;
  block: string | null;
  category: UnitCategory;
  type: UnitType;
  status: UnitStatus;
  displayStatus: UnitDisplayStatus;
  isDelivered: boolean;
  isActive: boolean;
  communityName: string;
  phaseName: string | null;
  clusterName: string | null;
  bedrooms: number | null;
  sizeSqm: number | null;
  residentCount: number;
  createdAt: string;
}

export interface UnitDetail extends UnitListItem {
  gateAccess: {
    mode: GateAccessMode;
    gates: GateItem[];
  };
  leases: Array<{
    id: string;
    startDate: string;
    endDate: string;
    status: string;
    tenantId: string | null;
    tenantEmail: string | null;
  }>;
  currentResidents: Array<{
    id: string;
    residentId: string;
    userId: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    userStatus: string | null;
    isPrimary: boolean;
    role: string;
    assignedAt: string;
    familyMembers: Array<{
      id: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      relationship: string;
      status: string;
    }>;
  }>;
  recentComplaints: Array<{
    id: string;
    complaintNumber: string;
    category: string;
    status: string;
    createdAt: string;
  }>;
  invoiceSummary: {
    totalPaid: number;
    totalPending: number;
    overdueCount: number;
  };
}

export interface UnitListQuery {
  page?: number;
  limit?: number;
  search?: string;
  communityId?: string;
  phaseId?: string;
  clusterId?: string;
  category?: UnitCategory;
  displayStatus?: UnitDisplayStatus;
  includeInactive?: boolean;
  isActive?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateUnitPayload {
  communityId: string;
  phaseId?: string;
  clusterId?: string;
  block?: string;
  unitNumber: string;
  category?: UnitCategory;
  type: UnitType;
  status?: UnitStatus;
  isDelivered?: boolean;
  floors?: number;
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  gateAccessMode?: GateAccessMode;
  allowedGateIds?: string[];
}

const unitService = {
  async listUnits(query: UnitListQuery): Promise<PaginatedResponse<UnitListItem>> {
    const response = await apiClient.get<PaginatedResponse<UnitListItem>>("/units", {
      params: query,
    });
    return response.data;
  },

  async listMyUnits(query: UnitListQuery): Promise<PaginatedResponse<UnitListItem>> {
    const response = await apiClient.get<PaginatedResponse<UnitListItem>>("/units/my", {
      params: query,
    });
    return response.data;
  },

  async getUnit(id: string): Promise<UnitDetail> {
    const response = await apiClient.get<UnitDetail>(`/units/${id}`);
    return response.data;
  },

  async createUnit(payload: CreateUnitPayload): Promise<UnitDetail> {
    const response = await apiClient.post<UnitDetail>("/units", payload);
    return response.data;
  },

  async updateUnit(id: string, payload: Partial<CreateUnitPayload>): Promise<UnitDetail> {
    const response = await apiClient.patch<UnitDetail>(`/units/${id}`, payload);
    return response.data;
  },

  async deactivateUnit(id: string, reason?: string) {
    const response = await apiClient.delete<{ success: true }>(`/units/${id}`, {
      data: { reason },
    });
    return response.data;
  },

  async reactivateUnit(id: string) {
    const response = await apiClient.post<{ success: true }>(`/units/${id}/reactivate`);
    return response.data;
  },

  async getUnitGateAccess(id: string): Promise<{ mode: GateAccessMode; gates: GateItem[] }> {
    const response = await apiClient.get<{ mode: GateAccessMode; gates: GateItem[] }>(
      `/units/${id}/gate-access`,
    );
    return response.data;
  },

  async updateUnitGateAccess(
    id: string,
    payload: { mode: GateAccessMode; allowedGateIds: string[] },
  ): Promise<{ mode: GateAccessMode; gates: GateItem[] }> {
    const response = await apiClient.patch<{ mode: GateAccessMode; gates: GateItem[] }>(
      `/units/${id}/gate-access`,
      payload,
    );
    return response.data;
  },

  async getUnitsByCluster(clusterId: string): Promise<UnitListItem[]> {
    const response = await apiClient.get<UnitListItem[]>(`/units/clusters/${clusterId}`);
    return Array.isArray(response.data) ? response.data : [];
  },
};

export default unitService;
