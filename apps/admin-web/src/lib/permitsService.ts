import {
  PermitCategory,
  PermitStatus,
  ServiceFieldType,
} from '@prisma/client';
import apiClient from './api-client';

export type PermitTypeField = {
  id: string;
  label: string;
  type: ServiceFieldType;
  placeholder: string | null;
  required: boolean;
  displayOrder: number;
};

export type PermitTypeItem = {
  id: string;
  name: string;
  slug: string;
  category: PermitCategory;
  description: string | null;
  iconName: string | null;
  color: string | null;
  isActive: boolean;
  displayOrder: number;
  fields: PermitTypeField[];
  createdAt: string;
  updatedAt: string;
};

export type PermitRequestListItem = {
  id: string;
  requestNumber: string;
  permitTypeId: string;
  permitTypeName: string;
  category: PermitCategory;
  unitId: string;
  unitNumber: string;
  requesterId: string;
  requesterName: string;
  status: PermitStatus;
  submittedAt: string;
};

export type PermitRequestDetail = {
  id: string;
  requestNumber: string;
  status: PermitStatus;
  notes: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  permitType: PermitTypeItem;
  unit: {
    id: string;
    unitNumber: string;
    block: string | null;
  };
  requester: {
    id: string;
    name: string;
    phone: string | null;
  };
  reviewer: {
    id: string;
    name: string;
  } | null;
  fieldValues: Array<{
    fieldId: string;
    label: string;
    type: ServiceFieldType;
    valueText: string | null;
    valueNumber: number | null;
    valueBool: boolean | null;
    valueDate: string | null;
  }>;
};

export type PermitStats = {
  totalRequests: number;
  pendingRequests: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  requestsByCategory: Record<PermitCategory, number>;
  requestsByStatus: Record<PermitStatus, number>;
};

export type CreatePermitTypePayload = {
  name: string;
  category: PermitCategory;
  description?: string;
  iconName?: string;
  color?: string;
  fields?: Array<{
    label: string;
    type: ServiceFieldType;
    placeholder?: string;
    required?: boolean;
    displayOrder?: number;
  }>;
};

export type CreatePermitRequestPayload = {
  permitTypeId: string;
  unitId: string;
  fieldValues: Array<{
    fieldId: string;
    value: string | number | boolean;
  }>;
  notes?: string;
};

const permitsService = {
  async listPermitTypes(includeInactive = false): Promise<PermitTypeItem[]> {
    const response = await apiClient.get<PermitTypeItem[]>('/permit-types', {
      params: { includeInactive },
    });
    return response.data;
  },

  async getPermitType(idOrSlug: string): Promise<PermitTypeItem> {
    const response = await apiClient.get<PermitTypeItem>(`/permit-types/${idOrSlug}`);
    return response.data;
  },

  async createPermitType(payload: CreatePermitTypePayload): Promise<PermitTypeItem> {
    const response = await apiClient.post<PermitTypeItem>('/permit-types', payload);
    return response.data;
  },

  async updatePermitType(id: string, payload: Partial<CreatePermitTypePayload>): Promise<PermitTypeItem> {
    const response = await apiClient.patch<PermitTypeItem>(`/permit-types/${id}`, payload);
    return response.data;
  },

  async togglePermitType(id: string): Promise<{ id: string; isActive: boolean }> {
    const response = await apiClient.patch<{ id: string; isActive: boolean }>(`/permit-types/${id}/toggle`);
    return response.data;
  },

  async addField(
    permitTypeId: string,
    payload: {
      label: string;
      type: ServiceFieldType;
      placeholder?: string;
      required?: boolean;
      displayOrder?: number;
    },
  ): Promise<PermitTypeField> {
    const response = await apiClient.post<PermitTypeField>(`/permit-types/${permitTypeId}/fields`, payload);
    return response.data;
  },

  async removeField(fieldId: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/permit-types/fields/${fieldId}`);
    return response.data;
  },

  async listRequests(params: {
    permitTypeId?: string;
    status?: PermitStatus;
    unitId?: string;
    requestedById?: string;
    category?: PermitCategory;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  } = {}): Promise<PermitRequestListItem[]> {
    const response = await apiClient.get<PermitRequestListItem[]>('/permits', {
      params,
    });
    return response.data;
  },

  async getStats(): Promise<PermitStats> {
    const response = await apiClient.get<PermitStats>('/permits/stats');
    return response.data;
  },

  async getRequestDetail(id: string): Promise<PermitRequestDetail> {
    const response = await apiClient.get<PermitRequestDetail>(`/permits/${id}`);
    return response.data;
  },

  async createRequest(payload: CreatePermitRequestPayload): Promise<PermitRequestDetail> {
    const response = await apiClient.post<PermitRequestDetail>('/permits', payload);
    return response.data;
  },

  async approveRequest(id: string, notes?: string): Promise<PermitRequestDetail> {
    const response = await apiClient.post<PermitRequestDetail>(`/permits/${id}/approve`, {
      notes,
    });
    return response.data;
  },

  async rejectRequest(id: string, reason: string): Promise<PermitRequestDetail> {
    const response = await apiClient.post<PermitRequestDetail>(`/permits/${id}/reject`, {
      reason,
    });
    return response.data;
  },
};

export default permitsService;
