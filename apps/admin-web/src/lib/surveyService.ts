import { SurveyFieldType, SurveyStatus, SurveyTarget } from '@prisma/client';
import apiClient from './api-client';

export type SurveyStats = {
  total: number;
  active: number;
  draft: number;
  closed: number;
  totalResponses: number;
  avgResponseRate: number;
};

export type SurveyListItem = {
  id: string;
  title: string;
  status: SurveyStatus;
  targetType: SurveyTarget;
  questionCount: number;
  responseCount: number;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
};

export type SurveyListResponse = {
  data: SurveyListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type SurveyQuestion = {
  id: string;
  text: string;
  type: SurveyFieldType;
  options: { choices?: string[] } | null;
  required: boolean;
  displayOrder: number;
};

export type SurveyQuestionAnalytics =
  | {
      questionId: string;
      questionText: string;
      type: SurveyFieldType.TEXT;
      required: boolean;
      displayOrder: number;
      answerCount: number;
      textAnswers: string[];
      totalTextAnswers: number;
    }
  | {
      questionId: string;
      questionText: string;
      type: SurveyFieldType.MULTIPLE_CHOICE;
      required: boolean;
      displayOrder: number;
      answerCount: number;
      options: Array<{
        choice: string;
        count: number;
        percentage: number;
      }>;
    }
  | {
      questionId: string;
      questionText: string;
      type: SurveyFieldType.RATING;
      required: boolean;
      displayOrder: number;
      answerCount: number;
      avg: number;
      distribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
      };
    }
  | {
      questionId: string;
      questionText: string;
      type: SurveyFieldType.YES_NO;
      required: boolean;
      displayOrder: number;
      answerCount: number;
      yes: number;
      no: number;
      yesPercentage: number;
    };

export type SurveyAnalytics = {
  totalResponses: number;
  completionRate: number;
  questions: SurveyQuestionAnalytics[];
};

export type SurveyDetail = {
  id: string;
  title: string;
  description: string | null;
  targetType: SurveyTarget;
  targetMeta: {
    communityIds?: string[];
    unitIds?: string[];
  } | null;
  status: SurveyStatus;
  publishedAt: string | null;
  closedAt: string | null;
  notificationId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
  responseCount: number;
  analytics: SurveyAnalytics;
};

export type CreateSurveyPayload = {
  title: string;
  description?: string;
  targetType?: SurveyTarget;
  targetMeta?: {
    communityIds?: string[];
    unitIds?: string[];
  };
  questions: Array<{
    text: string;
    type: SurveyFieldType;
    options?: {
      choices: string[];
    };
    required?: boolean;
    displayOrder?: number;
  }>;
};

export type UpdateSurveyPayload = {
  title?: string;
  description?: string;
  targetType?: SurveyTarget;
  targetMeta?: {
    communityIds?: string[];
    unitIds?: string[];
  };
  questions?: Array<{
    id?: string;
    text: string;
    type: SurveyFieldType;
    options?: {
      choices: string[];
    };
    required?: boolean;
    displayOrder?: number;
  }>;
};

export type SurveyFilters = {
  status?: SurveyStatus;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type CommunityOption = {
  id: string;
  name: string;
};

export type UnitOption = {
  id: string;
  unitNumber: string;
  block: string | null;
};

type DataEnvelope<T> = {
  data?: T[];
};

function extractRows<T>(payload: T[] | DataEnvelope<T>): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

const surveyService = {
  async getSurveyStats(): Promise<SurveyStats> {
    const response = await apiClient.get<SurveyStats>('/surveys/stats');
    return response.data;
  },

  async listSurveys(filters: SurveyFilters = {}): Promise<SurveyListResponse> {
    const response = await apiClient.get<SurveyListResponse>('/surveys', { params: filters });
    return response.data;
  },

  async getSurveyDetail(id: string): Promise<SurveyDetail> {
    const response = await apiClient.get<SurveyDetail>(`/surveys/${id}`);
    return response.data;
  },

  async getSurveyAnalytics(id: string): Promise<SurveyAnalytics> {
    const response = await apiClient.get<SurveyAnalytics>(`/surveys/${id}/analytics`);
    return response.data;
  },

  async createSurvey(payload: CreateSurveyPayload): Promise<SurveyDetail> {
    const response = await apiClient.post<SurveyDetail>('/surveys', payload);
    return response.data;
  },

  async updateSurvey(id: string, payload: UpdateSurveyPayload): Promise<SurveyDetail> {
    const response = await apiClient.patch<SurveyDetail>(`/surveys/${id}`, payload);
    return response.data;
  },

  async publishSurvey(id: string): Promise<SurveyDetail> {
    const response = await apiClient.post<SurveyDetail>(`/surveys/${id}/publish`);
    return response.data;
  },

  async closeSurvey(id: string): Promise<SurveyDetail> {
    const response = await apiClient.post<SurveyDetail>(`/surveys/${id}/close`);
    return response.data;
  },

  async deleteSurvey(id: string): Promise<{ success: true }> {
    const response = await apiClient.delete<{ success: true }>(`/surveys/${id}`);
    return response.data;
  },

  async submitSurveyResponse(
    id: string,
    answers: Array<{
      questionId: string;
      valueText?: string;
      valueNumber?: number;
      valueChoice?: string;
    }>,
  ): Promise<{
    id: string;
    surveyId: string;
    userId: string;
    submittedAt: string;
    answerCount: number;
  }> {
    const response = await apiClient.post<{
      id: string;
      surveyId: string;
      userId: string;
      submittedAt: string;
      answerCount: number;
    }>(`/surveys/${id}/respond`, { answers });
    return response.data;
  },

  async listCommunityOptions(): Promise<CommunityOption[]> {
    const response = await apiClient.get<Array<{ id: string; name: string }> | DataEnvelope<{ id: string; name: string }>>('/communities', {
      params: { page: 1, limit: 500 },
    });

    return extractRows(response.data).map((row) => ({
      id: row.id,
      name: row.name,
    }));
  },

  async listUnitOptions(): Promise<UnitOption[]> {
    const response = await apiClient.get<
      Array<{ id: string; unitNumber: string; block: string | null }> |
      DataEnvelope<{ id: string; unitNumber: string; block: string | null }>
    >('/units', {
      params: { page: 1, limit: 500 },
    });

    return extractRows(response.data).map((row) => ({
      id: row.id,
      unitNumber: row.unitNumber,
      block: row.block,
    }));
  },
};

export default surveyService;
