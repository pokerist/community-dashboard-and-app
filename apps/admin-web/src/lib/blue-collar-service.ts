import apiClient from './api-client';
import { extractRows } from './live-data';

export type AccessStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'USED'
  | 'REVOKED'
  | 'CANCELLED';

export type EntityStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type BlueCollarSettings = {
  id: string;
  communityId: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  allowedDays: number[];
  termsAndConditions: string | null;
  termsVersion: number;
  updatedAt: string;
  updatedById: string | null;
};

export type BlueCollarHoliday = {
  id: string;
  communityId: string;
  date: string;
  label: string;
  createdAt: string;
};

export type BlueCollarTerms = {
  terms: string;
  version: number;
  updatedAt: string | null;
};

export type BlueCollarWorker = {
  id: string;
  accessProfileId: string;
  fullName: string;
  nationalId: string;
  jobType: string | null;
  contractorName: string;
  unitNumber: string;
  status: EntityStatus;
  accessProfileStatus: AccessStatus;
};

export type BlueCollarWorkerListResponse = {
  data: BlueCollarWorker[];
  total: number;
  page: number;
  limit: number;
};

export type AccessGrantTimelineItem = {
  id: string;
  unitId: string;
  validFrom: string;
  validTo: string;
  permissions: Array<'ENTER' | 'WORK' | 'DELIVER'>;
};

export type BlueCollarWorkerDetail = {
  id: string;
  accessProfileId: string;
  fullName: string;
  nationalId: string;
  phone: string | null;
  photoId: string | null;
  notes: string | null;
  jobType: string | null;
  status: EntityStatus;
  accessProfileStatus: AccessStatus;
  contractorName: string;
  unitNumber: string;
  accessGrants: AccessGrantTimelineItem[];
};

export type BlueCollarWorkerStats = {
  totalWorkers: number;
  activeWorkers: number;
  pendingApproval: number;
  contractorCount: number;
};

export type UpsertBlueCollarSettingsPayload = {
  workingHoursStart: string;
  workingHoursEnd: string;
  allowedDays: number[];
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

export type CommunityOption = { id: string; label: string };
export type UnitOption = { id: string; label: string; communityId: string | null };

function unitLabel(row: UnitRow): string {
  return [
    row.projectName ? row.projectName : null,
    row.block ? `Block ${row.block}` : null,
    row.unitNumber ? `Unit ${row.unitNumber}` : null,
  ]
    .filter(Boolean)
    .join(' - ');
}

const blueCollarService = {
  async getSettings(communityId: string): Promise<BlueCollarSettings | null> {
    const response = await apiClient.get<BlueCollarSettings | null>('/blue-collar/settings', {
      params: { communityId },
    });
    return response.data ?? null;
  },

  async upsertSettings(
    communityId: string,
    payload: UpsertBlueCollarSettingsPayload,
  ): Promise<BlueCollarSettings> {
    const response = await apiClient.put<BlueCollarSettings>('/blue-collar/settings', payload, {
      params: { communityId },
    });
    return response.data;
  },

  async listHolidays(communityId: string, year?: number): Promise<BlueCollarHoliday[]> {
    const response = await apiClient.get<BlueCollarHoliday[]>('/blue-collar/holidays', {
      params: { communityId, year },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async addHoliday(
    communityId: string,
    payload: { date: string; label: string },
  ): Promise<BlueCollarHoliday> {
    const response = await apiClient.post<BlueCollarHoliday>('/blue-collar/holidays', payload, {
      params: { communityId },
    });
    return response.data;
  },

  async removeHoliday(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/blue-collar/holidays/${id}`);
    return response.data;
  },

  async getTerms(communityId: string): Promise<BlueCollarTerms> {
    const response = await apiClient.get<BlueCollarTerms>('/blue-collar/terms', {
      params: { communityId },
    });
    return response.data;
  },

  async updateTerms(communityId: string, terms: string): Promise<BlueCollarTerms> {
    const response = await apiClient.put<BlueCollarTerms>(
      '/blue-collar/terms',
      { terms },
      { params: { communityId } },
    );
    return response.data;
  },

  async listWorkers(filters: {
    communityId?: string;
    contractorId?: string;
    status?: EntityStatus;
    unitId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<BlueCollarWorkerListResponse> {
    const response = await apiClient.get<BlueCollarWorkerListResponse>('/blue-collar/workers', {
      params: filters,
    });
    return response.data;
  },

  async listPendingWorkers(communityId: string): Promise<BlueCollarWorker[]> {
    const response = await apiClient.get<BlueCollarWorker[]>('/blue-collar/workers/pending', {
      params: { communityId },
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  async getWorkerDetail(workerId: string): Promise<BlueCollarWorkerDetail> {
    const response = await apiClient.get<BlueCollarWorkerDetail>(`/blue-collar/workers/${workerId}`);
    return response.data;
  },

  async approveWorkerAccess(accessProfileId: string): Promise<{ accessProfileId: string; status: AccessStatus; notes: string | null }> {
    const response = await apiClient.post<{ accessProfileId: string; status: AccessStatus; notes: string | null }>(
      `/blue-collar/workers/${accessProfileId}/approve`,
      {},
    );
    return response.data;
  },

  async rejectWorkerAccess(
    accessProfileId: string,
    reason: string,
  ): Promise<{ accessProfileId: string; status: AccessStatus; notes: string | null }> {
    const response = await apiClient.post<{ accessProfileId: string; status: AccessStatus; notes: string | null }>(
      `/blue-collar/workers/${accessProfileId}/reject`,
      { reason },
    );
    return response.data;
  },

  async getWorkerStats(communityId: string): Promise<BlueCollarWorkerStats> {
    const response = await apiClient.get<BlueCollarWorkerStats>('/blue-collar/stats', {
      params: { communityId },
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

export default blueCollarService;
