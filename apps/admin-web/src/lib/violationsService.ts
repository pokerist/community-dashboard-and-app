import { ViolationActionStatus, ViolationActionType, ViolationStatus } from "@prisma/client";
import apiClient from "./api-client";

export type ViolationCategoryItem = {
  id: string;
  name: string;
  defaultFineAmount: number;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ViolationListItem = {
  id: string;
  violationNumber: string;
  categoryName: string | null;
  unitNumber: string;
  residentName: string | null;
  issuerName: string | null;
  fineAmount: number;
  status: ViolationStatus;
  hasAppeal: boolean;
  appealStatus: string | null;
  createdAt: string;
};

export type ViolationListResponse = {
  data: ViolationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ViolationPhotoEvidence = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  url: string | null;
};

export type ViolationActionRequestItem = {
  id: string;
  type: ViolationActionType;
  status: ViolationActionStatus;
  note: string | null;
  attachmentIds: string[];
  rejectionReason: string | null;
  requestedById: string;
  requestedByName: string;
  reviewedById: string | null;
  reviewedByName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type ViolationInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  type: string;
  status: string;
  dueDate: string;
};

export type ViolationDetail = {
  id: string;
  violationNumber: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryDescription: string | null;
  description: string;
  fineAmount: number;
  status: ViolationStatus;
  appealStatus: string | null;
  appealDeadline: string | null;
  closedAt: string | null;
  unitId: string;
  unitNumber: string;
  residentId: string | null;
  residentName: string | null;
  issuerId: string | null;
  issuerName: string | null;
  createdAt: string;
  updatedAt: string;
  photoEvidence: ViolationPhotoEvidence[];
  actionRequests: ViolationActionRequestItem[];
  invoices: ViolationInvoice[];
};

export type ViolationAppealQueueItem = {
  actionRequestId: string;
  violationId: string;
  violationNumber: string;
  categoryName: string | null;
  unitNumber: string;
  residentName: string | null;
  fineAmount: number;
  appealNote: string | null;
  submittedAt: string;
  status: ViolationActionStatus;
};

export type ViolationAppealQueueResponse = {
  data: ViolationAppealQueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ViolationStats = {
  total: number;
  pending: number;
  paid: number;
  appealed: number;
  cancelled: number;
  pendingAppeals: number;
  totalFinesIssued: number;
  totalFinesCollected: number;
  byCategory: Array<{
    categoryId: string | null;
    name: string;
    count: number;
    totalFines: number;
  }>;
};

export type ListViolationsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ViolationStatus;
  categoryId?: string;
  unitId?: string;
  residentId?: string;
  issuedById?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAppeal?: boolean;
};

export type ListAppealsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: ViolationActionStatus;
  dateFrom?: string;
  dateTo?: string;
};

export type CreateViolationPayload = {
  unitId: string;
  residentId?: string;
  categoryId?: string;
  description: string;
  fineAmount?: number;
  photoEvidenceIds?: string[];
};

export type UpdateViolationPayload = {
  description?: string;
  fineAmount?: number;
  categoryId?: string;
  photoEvidenceIds?: string[];
};

export type CreateViolationCategoryPayload = {
  name: string;
  defaultFineAmount: number;
  description?: string;
};

export type UpdateViolationCategoryPayload = Partial<CreateViolationCategoryPayload>;

const violationsService = {
  async listCategories(includeInactive = false): Promise<ViolationCategoryItem[]> {
    const response = await apiClient.get<ViolationCategoryItem[]>("/violation-categories", {
      params: { includeInactive },
    });
    return response.data;
  },

  async createCategory(payload: CreateViolationCategoryPayload): Promise<ViolationCategoryItem> {
    const response = await apiClient.post<ViolationCategoryItem>("/violation-categories", payload);
    return response.data;
  },

  async updateCategory(
    id: string,
    payload: UpdateViolationCategoryPayload,
  ): Promise<ViolationCategoryItem> {
    const response = await apiClient.patch<ViolationCategoryItem>(`/violation-categories/${id}`, payload);
    return response.data;
  },

  async toggleCategory(id: string): Promise<ViolationCategoryItem> {
    const response = await apiClient.patch<ViolationCategoryItem>(`/violation-categories/${id}/toggle`);
    return response.data;
  },

  async reorderCategories(orderedIds: string[]): Promise<ViolationCategoryItem[]> {
    const response = await apiClient.patch<ViolationCategoryItem[]>("/violation-categories/reorder", {
      orderedIds,
    });
    return response.data;
  },

  async listViolations(params: ListViolationsParams = {}): Promise<ViolationListResponse> {
    const response = await apiClient.get<ViolationListResponse>("/violations", { params });
    return response.data;
  },

  async getViolationStats(): Promise<ViolationStats> {
    const response = await apiClient.get<ViolationStats>("/violations/stats");
    return response.data;
  },

  async listAppealRequests(params: ListAppealsParams = {}): Promise<ViolationAppealQueueResponse> {
    const response = await apiClient.get<ViolationAppealQueueResponse>("/violations/appeals", {
      params,
    });
    return response.data;
  },

  async getViolationDetail(id: string): Promise<ViolationDetail> {
    const response = await apiClient.get<ViolationDetail>(`/violations/${id}`);
    return response.data;
  },

  async createViolation(payload: CreateViolationPayload): Promise<ViolationDetail> {
    const response = await apiClient.post<ViolationDetail>("/violations", payload);
    return response.data;
  },

  async updateViolation(id: string, payload: UpdateViolationPayload): Promise<ViolationDetail> {
    const response = await apiClient.patch<ViolationDetail>(`/violations/${id}`, payload);
    return response.data;
  },

  async cancelViolation(id: string): Promise<ViolationDetail> {
    const response = await apiClient.patch<ViolationDetail>(`/violations/${id}/cancel`);
    return response.data;
  },

  async markAsPaid(id: string): Promise<ViolationDetail> {
    const response = await apiClient.patch<ViolationDetail>(`/violations/${id}/pay`);
    return response.data;
  },

  async reviewAppeal(actionRequestId: string, approved: boolean, reason?: string): Promise<ViolationDetail> {
    const response = await apiClient.post<ViolationDetail>(`/violations/appeals/${actionRequestId}/review`, {
      approved,
      reason,
    });
    return response.data;
  },

  async reviewFixSubmission(
    actionRequestId: string,
    approved: boolean,
    reason?: string,
  ): Promise<ViolationDetail> {
    const response = await apiClient.post<ViolationDetail>(`/violations/fixes/${actionRequestId}/review`, {
      approved,
      reason,
    });
    return response.data;
  },
};

export default violationsService;
