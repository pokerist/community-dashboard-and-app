import apiClient from './api-client';
import {
  Priority,
  ServiceCategory,
  ServiceRequestStatus,
} from '@prisma/client';

export type ServiceRequestSlaStatus =
  | 'ON_TRACK'
  | 'BREACHED'
  | 'RESOLVED'
  | 'NO_SLA';

export type ServiceFilterParams = {
  category?: ServiceCategory;
  status?: 'active' | 'inactive' | 'all';
  search?: string;
};

export type ServiceField = {
  id: string;
  label: string;
  type: string;
  placeholder: string | null;
  required: boolean;
  order: number;
};

export type ServiceListItem = {
  id: string;
  name: string;
  category: ServiceCategory;
  status: boolean;
  description: string | null;
  slaHours: number | null;
  startingPrice: number | null;
  assignedRoleName: string | null;
  totalRequestsCount: number;
  revenueTotal: number;
  iconName: string | null;
  iconTone: string;
  isUrgent: boolean;
  microServicesCount: number;
};

export type MicroServiceItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  isActive: boolean;
  displayOrder: number;
};

export type CreateMicroServiceInput = {
  name: string;
  description?: string;
  price?: number;
  isActive?: boolean;
  displayOrder?: number;
};

export type ServiceDetail = {
  id: string;
  name: string;
  category: ServiceCategory;
  status: boolean;
  unitEligibility: string;
  processingTime: number | null;
  description: string | null;
  slaHours: number | null;
  startingPrice: number | null;
  assignedRoleId: string | null;
  assignedRoleName: string | null;
  isUrgent: boolean;
  iconName: string | null;
  iconTone: string;
  fields: ServiceField[];
  microServices: MicroServiceItem[];
  stats: {
    totalRequests: number;
    openRequests: number;
    resolvedThisMonth: number;
    avgResolutionHours: number;
    slaBreachRate: number;
    revenueTotal: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type ServiceStats = {
  totalServices: number;
  activeServices: number;
  totalRequests: number;
  openRequests: number;
  slaBreachedRequests: number;
  resolvedThisMonth: number;
  totalRevenue: number;
  requestsByCategory: Record<ServiceCategory, number>;
};

export type CreateServiceFieldInput = {
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  order?: number;
};

export type CreateServicePayload = {
  name: string;
  category: ServiceCategory;
  description?: string;
  slaHours?: number;
  assignedRoleId?: string;
  startingPrice?: number;
  isUrgent?: boolean;
  unitEligibility?: string;
  iconName?: string;
  iconTone?: string;
  fields?: CreateServiceFieldInput[];
  microServices?: CreateMicroServiceInput[];
};

export type UpdateServicePayload = Partial<CreateServicePayload>;

export type RequestFilters = {
  serviceId?: string;
  status?: ServiceRequestStatus;
  priority?: Priority;
  assignedToId?: string;
  unitId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  slaBreached?: boolean;
  search?: string;
};

export type ServiceRequestListItem = {
  id: string;
  requestNumber: string;
  serviceName: string;
  category: ServiceCategory;
  unitNumber: string;
  requesterName: string;
  assigneeName: string | null;
  status: ServiceRequestStatus;
  priority: Priority;
  slaStatus: ServiceRequestSlaStatus;
  slaDeadline: string | null;
  hoursRemaining: number | null;
  createdAt: string;
};

export type ServiceRequestComment = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export type ServiceRequestInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: string;
  dueDate: string;
};

export type DashboardRoleOption = {
  id: string;
  name: string;
};

export type AssigneeOption = {
  id: string;
  name: string;
};

export type ServiceRequestDetail = {
  id: string;
  requestNumber: string;
  status: ServiceRequestStatus;
  priority: Priority;
  description: string;
  createdAt: string;
  updatedAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  customerRating: number | null;
  internalNotes: string | null;
  service: {
    id: string;
    name: string;
    category: ServiceCategory;
    slaHours: number | null;
  };
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
  assignee: {
    id: string;
    name: string;
  } | null;
  fieldValues: Array<{
    fieldId: string;
    label: string;
    type: string;
    valueText: string | null;
    valueNumber: number | null;
    valueBool: boolean | null;
    valueDate: string | null;
    fileAttachmentId: string | null;
  }>;
  comments: ServiceRequestComment[];
  invoices: ServiceRequestInvoice[];
  sla: {
    status: ServiceRequestSlaStatus;
    deadline: string | null;
    hoursRemaining: number | null;
    hoursOverdue: number | null;
  };
};

export type AssignRequestPayload = {
  assignedToId: string;
};

export type UpdateRequestStatusPayload = {
  status: ServiceRequestStatus;
  notes?: string;
};

export type CreateRequestInvoicePayload = {
  amount: number;
  dueDate: string;
};

const servicesService = {
  async listServices(params: ServiceFilterParams = {}): Promise<ServiceListItem[]> {
    const response = await apiClient.get<ServiceListItem[]>('/services', {
      params,
    });
    return response.data;
  },

  async getServiceStats(): Promise<ServiceStats> {
    const response = await apiClient.get<ServiceStats>('/services/stats');
    return response.data;
  },

  async getServiceDetail(id: string): Promise<ServiceDetail> {
    const response = await apiClient.get<ServiceDetail>(`/services/${id}`);
    return response.data;
  },

  async createService(payload: CreateServicePayload): Promise<ServiceDetail> {
    const response = await apiClient.post<ServiceDetail>('/services', payload);
    return response.data;
  },

  async updateService(id: string, payload: UpdateServicePayload): Promise<ServiceDetail> {
    const response = await apiClient.patch<ServiceDetail>(`/services/${id}`, payload);
    return response.data;
  },

  async toggleService(id: string): Promise<{ id: string; status: boolean }> {
    const response = await apiClient.patch<{ id: string; status: boolean }>(`/services/${id}/toggle`);
    return response.data;
  },

  async listRequests(params: RequestFilters = {}): Promise<ServiceRequestListItem[]> {
    const response = await apiClient.get<ServiceRequestListItem[]>('/service-requests', {
      params,
    });
    return response.data;
  },

  async getRequestDetail(id: string): Promise<ServiceRequestDetail> {
    const response = await apiClient.get<ServiceRequestDetail>(`/service-requests/${id}`);
    return response.data;
  },

  async assignRequest(id: string, payload: AssignRequestPayload): Promise<ServiceRequestDetail> {
    const response = await apiClient.patch<ServiceRequestDetail>(`/service-requests/${id}/assign`, payload);
    return response.data;
  },

  async updateRequestStatus(
    id: string,
    payload: UpdateRequestStatusPayload,
  ): Promise<ServiceRequestDetail> {
    const response = await apiClient.patch<ServiceRequestDetail>(`/service-requests/${id}/status`, payload);
    return response.data;
  },

  async addInternalNote(id: string, note: string): Promise<ServiceRequestDetail> {
    const response = await apiClient.post<ServiceRequestDetail>(`/service-requests/${id}/note`, {
      note,
    });
    return response.data;
  },

  async submitRating(id: string, rating: number): Promise<ServiceRequestDetail> {
    const response = await apiClient.post<ServiceRequestDetail>(`/service-requests/${id}/rating`, {
      rating,
    });
    return response.data;
  },

  async createRequestInvoice(
    id: string,
    payload: CreateRequestInvoicePayload,
  ): Promise<{ id: string }> {
    const response = await apiClient.post<{ id: string }>(`/service-requests/${id}/invoices`, payload);
    return response.data;
  },

  async checkSlaBreaches(): Promise<number> {
    const response = await apiClient.post<{ count: number }>('/service-requests/check-sla');
    return response.data.count;
  },

  async listComments(id: string): Promise<ServiceRequestComment[]> {
    const response = await apiClient.get<ServiceRequestComment[]>(`/service-requests/${id}/comments`);
    return response.data;
  },

  async postComment(
    id: string,
    payload: { body: string; isInternal?: boolean },
  ): Promise<ServiceRequestComment> {
    const response = await apiClient.post<ServiceRequestComment>(`/service-requests/${id}/comments`, payload);
    return response.data;
  },

  async listAssignableRoles(): Promise<DashboardRoleOption[]> {
    const response = await apiClient.get<Array<{ id: string; name: string }>>('/admin/users/roles');
    return response.data.map((row) => ({ id: row.id, name: row.name }));
  },

  async listAssignees(): Promise<AssigneeOption[]> {
    const response = await apiClient.get<{
      items: Array<{ userId: string; name: string }>;
    }>('/users/system-users', {
      params: { page: 1, limit: 100 },
    });
    return response.data.items.map((row) => ({ id: row.userId, name: row.name }));
  },
};

export default servicesService;

