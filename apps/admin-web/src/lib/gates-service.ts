import apiClient from './api-client';
import { extractRows } from './live-data';

export type GateAccessRole =
  | 'RESIDENT'
  | 'VISITOR'
  | 'WORKER'
  | 'STAFF'
  | 'DELIVERY'
  | 'RIDESHARE';

export type GateStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type QrType =
  | 'SELF'
  | 'VISITOR'
  | 'DELIVERY'
  | 'WORKER'
  | 'SERVICE_PROVIDER'
  | 'RIDESHARE';
export type AccessStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'USED'
  | 'REVOKED'
  | 'CANCELLED';
export type GateLogStatusFilter = 'ACTIVE' | 'INSIDE' | 'EXITED';

export type GateRow = {
  id: string;
  communityId: string;
  name: string;
  code: string | null;
  status: GateStatus;
  allowedRoles: GateAccessRole[];
  etaMinutes: number | null;
  isVisitorRequestRequired: boolean;
  unitIds: string[];
  unitCount: number;
  phaseIds?: string[];
  clusterIds?: string[];
  createdAt: string;
  updatedAt: string;
};

export type GateStats = {
  totalGates: number;
  activeGates: number;
  todayEntries: number;
  currentlyInside: number;
  todayVisitors: number;
  todayDeliveries: number;
};

export type GateLogItem = {
  id: string;
  visitorName: string | null;
  requesterName: string | null;
  unitNumber: string | null;
  qrType: QrType;
  status: AccessStatus;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  durationMinutes: number | null;
  gateOperatorName: string | null;
};

export type PaginatedGateLog = {
  data: GateLogItem[];
  total: number;
  page: number;
  limit: number;
};

export type ClusterOption = {
  id: string;
  label: string;
};

export type GateCreatePayload = {
  communityId: string;
  phaseIds?: string[];
  clusterIds?: string[];
  name: string;
  allowedRoles: GateAccessRole[];
  etaMinutes?: number;
};

export type GateUpdatePayload = Partial<Omit<GateCreatePayload, 'communityId'>>;

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

export type CommunityOption = {
  id: string;
  label: string;
};

export type UnitOption = {
  id: string;
  label: string;
  communityId: string | null;
};

export const GATE_ACCESS_ROLES: GateAccessRole[] = [
  'RESIDENT',
  'VISITOR',
  'WORKER',
  'STAFF',
  'DELIVERY',
  'RIDESHARE',
];

function unitLabel(row: UnitRow): string {
  return [
    row.projectName ? row.projectName : null,
    row.block ? `Block ${row.block}` : null,
    row.unitNumber ? `Unit ${row.unitNumber}` : null,
  ]
    .filter(Boolean)
    .join(' - ');
}

const gatesService = {
  async listGates(filters: {
    communityId: string;
    includeInactive?: boolean;
  }): Promise<GateRow[]> {
    const response = await apiClient.get<GateRow[]>('/gates', { params: filters });
    return Array.isArray(response.data) ? response.data : [];
  },

  async getGateStats(communityId: string): Promise<GateStats> {
    const response = await apiClient.get<GateStats>('/gates/stats', {
      params: { communityId },
    });
    return response.data;
  },

  async createGate(payload: GateCreatePayload): Promise<GateRow> {
    const response = await apiClient.post<GateRow>('/gates', payload);
    return response.data;
  },

  async updateGate(gateId: string, payload: GateUpdatePayload): Promise<GateRow> {
    const response = await apiClient.patch<GateRow>(`/gates/${gateId}`, payload);
    return response.data;
  },

  async updateGateRoles(gateId: string, roles: GateAccessRole[]): Promise<GateRow> {
    const response = await apiClient.patch<GateRow>(`/gates/${gateId}/roles`, { roles });
    return response.data;
  },

  async removeGate(gateId: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/gates/${gateId}`);
    return response.data;
  },

  async setGateUnits(
    gateId: string,
    unitIds: string[],
  ): Promise<Array<{ id: string; gateId: string; unitId: string }>> {
    const response = await apiClient.put<Array<{ id: string; gateId: string; unitId: string }>>(
      `/gates/${gateId}/units`,
      { unitIds },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async listGateLog(filters: {
    communityId?: string;
    gateId?: string;
    from?: string;
    to?: string;
    qrType?: QrType;
    status?: GateLogStatusFilter;
    page?: number;
    limit?: number;
  }): Promise<PaginatedGateLog> {
    if (filters.gateId) {
      const { gateId, ...query } = filters;
      const response = await apiClient.get<PaginatedGateLog>(`/gates/${gateId}/log`, {
        params: query,
      });
      return response.data;
    }

    const response = await apiClient.get<PaginatedGateLog>('/gates/logs', {
      params: filters,
    });
    return response.data;
  },

  async listCommunityOptions(): Promise<CommunityOption[]> {
    const response = await apiClient.get<CommunityRow[]>('/communities');
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.code ? `${row.name} (${row.code})` : row.name,
    }));
  },

  async listClusterOptions(communityId: string): Promise<ClusterOption[]> {
    const response = await apiClient.get<{ clusters: Array<{ id: string; name: string; code: string | null }> }>(
      `/communities/${communityId}/detail`,
    );
    const rows = Array.isArray(response.data?.clusters) ? response.data.clusters : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.code ? `${row.name} (${row.code})` : row.name,
    }));
  },

  async listUnitOptions(): Promise<UnitOption[]> {
    const response = await apiClient.get('/units', { params: { page: 1, limit: 100 } });
    const rows = extractRows<UnitRow>(response.data);
    return rows.map((row) => ({
      id: row.id,
      label: unitLabel(row) || row.id,
      communityId: row.communityId ?? null,
    }));
  },
};

export default gatesService;
