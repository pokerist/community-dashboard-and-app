import { ComplaintStatus, Priority } from "@prisma/client";
import apiClient from "./api-client";

export type ComplaintSlaStatus = "ON_TRACK" | "BREACHED" | "RESOLVED" | "NO_SLA";

export type ComplaintCategoryItem = {
  id: string;
  name: string;
  slaHours: number;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ComplaintListItem = {
  id: string;
  complaintNumber: string;
  title: string | null;
  categoryName: string | null;
  unitNumber: string | null;
  reporterName: string;
  assigneeName: string | null;
  priority: Priority;
  status: ComplaintStatus;
  slaStatus: ComplaintSlaStatus;
  hoursRemaining: number | null;
  createdAt: string;
};

export type ComplaintListResponse = {
  data: ComplaintListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ComplaintDetailComment = {
  id: string;
  body: string;
  isInternal: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ComplaintInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  type: string;
  status: string;
  dueDate: string;
};

export type ComplaintDetail = {
  id: string;
  complaintNumber: string;
  title: string | null;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  categoryId: string | null;
  categoryName: string | null;
  categorySlaHours: number | null;
  unitId: string | null;
  unitNumber: string | null;
  reporterId: string;
  reporterName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  slaDeadline: string | null;
  slaBreachedAt: string | null;
  hoursRemaining: number | null;
  hoursOverdue: number | null;
  createdAt: string;
  updatedAt: string;
  comments: ComplaintDetailComment[];
  invoices: ComplaintInvoice[];
};

export type ComplaintStats = {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  slaBreached: number;
  avgResolutionHours: number;
  byPriority: Record<Priority, number>;
  byCategory: Array<{
    categoryId: string | null;
    name: string;
    count: number;
  }>;
  byStatus: Record<ComplaintStatus, number>;
};

export type CreateComplaintPayload = {
  unitId: string;
  categoryId?: string;
  title?: string;
  description: string;
  priority?: Priority;
};

export type CreateComplaintCategoryPayload = {
  name: string;
  slaHours: number;
  description?: string;
};

export type UpdateComplaintCategoryPayload = Partial<CreateComplaintCategoryPayload>;

export type ListComplaintsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ComplaintStatus;
  categoryId?: string;
  priority?: Priority;
  assignedToId?: string;
  unitId?: string;
  reporterId?: string;
  dateFrom?: string;
  dateTo?: string;
  slaBreached?: boolean;
};

export type ComplaintUnitOption = {
  id: string;
  unitNumber: string;
};

export type ComplaintUserOption = {
  id: string;
  name: string;
};

type PagedResponse<T> = {
  data: T[];
};

function extractRows<T>(payload: T[] | PagedResponse<T>): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

const complaintsService = {
  async listCategories(includeInactive = false): Promise<ComplaintCategoryItem[]> {
    const response = await apiClient.get<ComplaintCategoryItem[]>("/complaint-categories", {
      params: { includeInactive },
    });
    return response.data;
  },

  async createCategory(payload: CreateComplaintCategoryPayload): Promise<ComplaintCategoryItem> {
    const response = await apiClient.post<ComplaintCategoryItem>("/complaint-categories", payload);
    return response.data;
  },

  async updateCategory(
    id: string,
    payload: UpdateComplaintCategoryPayload,
  ): Promise<ComplaintCategoryItem> {
    const response = await apiClient.patch<ComplaintCategoryItem>(`/complaint-categories/${id}`, payload);
    return response.data;
  },

  async toggleCategory(id: string): Promise<ComplaintCategoryItem> {
    const response = await apiClient.patch<ComplaintCategoryItem>(`/complaint-categories/${id}/toggle`);
    return response.data;
  },

  async reorderCategories(orderedIds: string[]): Promise<ComplaintCategoryItem[]> {
    const response = await apiClient.patch<ComplaintCategoryItem[]>("/complaint-categories/reorder", {
      orderedIds,
    });
    return response.data;
  },

  async listComplaints(params: ListComplaintsParams = {}): Promise<ComplaintListResponse> {
    const response = await apiClient.get<ComplaintListResponse>("/complaints", {
      params,
    });
    return response.data;
  },

  async getComplaintStats(): Promise<ComplaintStats> {
    const response = await apiClient.get<ComplaintStats>("/complaints/stats");
    return response.data;
  },

  async getComplaintDetail(id: string): Promise<ComplaintDetail> {
    const response = await apiClient.get<ComplaintDetail>(`/complaints/${id}`);
    return response.data;
  },

  async createComplaint(payload: CreateComplaintPayload): Promise<ComplaintDetail> {
    const response = await apiClient.post<ComplaintDetail>("/complaints", payload);
    return response.data;
  },

  async updateComplaint(
    id: string,
    payload: { categoryId?: string; title?: string; priority?: Priority },
  ): Promise<ComplaintDetail> {
    const response = await apiClient.patch<ComplaintDetail>(`/complaints/${id}`, payload);
    return response.data;
  },

  async assignComplaint(id: string, assignedToId: string): Promise<ComplaintDetail> {
    const response = await apiClient.patch<ComplaintDetail>(`/complaints/${id}/assign`, {
      assignedToId,
    });
    return response.data;
  },

  async updateComplaintStatus(
    id: string,
    status: ComplaintStatus,
    resolutionNotes?: string,
  ): Promise<ComplaintDetail> {
    const response = await apiClient.patch<ComplaintDetail>(`/complaints/${id}/status`, {
      status,
      resolutionNotes,
    });
    return response.data;
  },

  async addComment(
    id: string,
    payload: { body: string; isInternal?: boolean },
  ): Promise<ComplaintDetailComment> {
    const response = await apiClient.post<ComplaintDetailComment>(`/complaints/${id}/comments`, payload);
    return response.data;
  },

  async checkSlaBreaches(): Promise<{ breachCount: number }> {
    const response = await apiClient.post<{ breachCount: number }>("/complaints/check-sla");
    return response.data;
  },

  async listUnits(): Promise<ComplaintUnitOption[]> {
    const response = await apiClient.get<PagedResponse<{ id: string; unitNumber: string }> | { id: string; unitNumber: string }[]>("/units", {
      params: { page: 1, limit: 500 },
    });
    const rows = extractRows(response.data);
    return rows.map((unit) => ({
      id: unit.id,
      unitNumber: unit.unitNumber,
    }));
  },

  async listAssignableUsers(): Promise<ComplaintUserOption[]> {
    const response = await apiClient.get<PagedResponse<{
      id: string;
      nameEN: string | null;
      nameAR: string | null;
      email: string | null;
    }> | Array<{
      id: string;
      nameEN: string | null;
      nameAR: string | null;
      email: string | null;
    }>>("/admin/users", {
      params: { take: 500, skip: 0 },
    });
    const rows = extractRows(response.data);
    return rows.map((user) => ({
      id: user.id,
      name: user.nameEN ?? user.nameAR ?? user.email ?? user.id,
    }));
  },
};

export default complaintsService;
