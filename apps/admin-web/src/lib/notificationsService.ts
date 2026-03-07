import apiClient from './api-client';

export type NotificationChannel = 'PUSH' | 'SMS' | 'IN_APP' | 'EMAIL' | 'WHATSAPP';
export type NotificationAudience =
  | 'ALL'
  | 'SPECIFIC_RESIDENCES'
  | 'SPECIFIC_BLOCKS'
  | 'SPECIFIC_UNITS';
export type NotificationType =
  | 'ANNOUNCEMENT'
  | 'PAYMENT_REMINDER'
  | 'MAINTENANCE_ALERT'
  | 'EVENT_NOTIFICATION'
  | 'EMERGENCY_ALERT'
  | 'OTP';
export type NotificationStatus = 'SCHEDULED' | 'PENDING' | 'SENT' | 'FAILED' | 'READ';
export type NotificationLogStatus = 'SENT' | 'PENDING' | 'FAILED' | 'DELIVERED' | 'READ';

export type NotificationStats = {
  totalSent: number;
  deliveredToday: number;
  failedToday: number;
  activeDeviceTokens: number;
  byChannel: Record<NotificationChannel, number>;
  byType: Record<NotificationType, number>;
};

export type NotificationListItem = {
  id: string;
  title: string;
  type: NotificationType;
  channels: NotificationChannel[];
  targetAudience: NotificationAudience;
  sentAt: string | null;
  deliveredCount: number;
  failedCount: number;
  status: NotificationStatus;
  communityId: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  data: NotificationListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type NotificationLogItem = {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationLogStatus;
  providerResponse: Record<string, unknown> | null;
  createdAt: string;
};

export type NotificationDeliveryBreakdown = {
  channel: NotificationChannel;
  attempted: number;
  delivered: number;
  failed: number;
  pending: number;
  read: number;
};

export type NotificationDetail = {
  id: string;
  title: string;
  titleAr: string | null;
  type: NotificationType;
  channels: NotificationChannel[];
  status: NotificationStatus;
  communityId: string | null;
  targetAudience: NotificationAudience;
  audienceMeta: Record<string, unknown> | null;
  messageEn: string;
  messageAr: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  openedCount: number;
  createdAt: string;
  logs: NotificationLogItem[];
  logsMeta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  deliveryBreakdown: NotificationDeliveryBreakdown[];
};

export type NotificationTemplate = {
  id: string;
  name: string;
  type: NotificationType;
  titleEn: string;
  titleAr: string | null;
  messageEn: string;
  messageAr: string | null;
  channels: NotificationChannel[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SendNotificationPayload = {
  type: NotificationType;
  title: string;
  titleAr?: string;
  messageEn: string;
  messageAr?: string;
  channels: NotificationChannel[];
  targetAudience: NotificationAudience;
  audienceMeta?: Record<string, unknown>;
  communityId?: string;
  payload?: Record<string, unknown>;
  scheduledAt?: string;
};

export type ScheduleNotificationPayload = Omit<SendNotificationPayload, 'scheduledAt'> & {
  scheduledAt: string;
};

export type ListNotificationsParams = {
  page?: number;
  type?: NotificationType;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  communityId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateRange?: string;
};

export type CreateNotificationTemplatePayload = {
  name: string;
  type: NotificationType;
  titleEn: string;
  titleAr?: string;
  messageEn: string;
  messageAr?: string;
  channels: NotificationChannel[];
  isActive?: boolean;
};

export type UpdateNotificationTemplatePayload = Partial<CreateNotificationTemplatePayload>;

export type ResendFailedResponse = {
  success: boolean;
  notificationId: string;
  message?: string;
  attempted: number;
  sent: number;
  failed: number;
  byChannel: Record<string, { attempted: number; sent: number; failed: number }>;
  failureReasons: Record<string, number>;
};

const notificationsService = {
  async listLegacyAdmin(params?: {
    page?: number;
    limit?: number;
  }): Promise<NotificationListResponse> {
    const response = await apiClient.get<NotificationListResponse>(
      '/notifications/admin/all',
      { params },
    );
    return response.data;
  },

  async getStats(): Promise<NotificationStats> {
    const response = await apiClient.get<NotificationStats>('/notifications/stats');
    return response.data;
  },

  async list(params: ListNotificationsParams): Promise<NotificationListResponse> {
    const response = await apiClient.get<NotificationListResponse>('/notifications', {
      params,
    });
    return response.data;
  },

  async getDetail(
    notificationId: string,
    params?: { page?: number; limit?: number },
  ): Promise<NotificationDetail> {
    const response = await apiClient.get<NotificationDetail>(
      `/notifications/${notificationId}`,
      { params },
    );
    return response.data;
  },

  async send(payload: SendNotificationPayload): Promise<{ notificationId: string }> {
    const response = await apiClient.post<{ notificationId: string }>(
      '/notifications/send',
      payload,
    );
    return response.data;
  },

  async schedule(payload: ScheduleNotificationPayload): Promise<{ notificationId: string }> {
    const response = await apiClient.post<{ notificationId: string }>(
      '/notifications/schedule',
      payload,
    );
    return response.data;
  },

  async cancelScheduled(
    notificationId: string,
  ): Promise<{ success: true; notificationId: string }> {
    const response = await apiClient.patch<{ success: true; notificationId: string }>(
      `/notifications/${notificationId}/cancel`,
    );
    return response.data;
  },

  async resendFailed(notificationId: string): Promise<ResendFailedResponse> {
    const response = await apiClient.post<ResendFailedResponse>(
      `/notifications/${notificationId}/resend-failed`,
    );
    return response.data;
  },

  async listTemplates(): Promise<NotificationTemplate[]> {
    const response = await apiClient.get<NotificationTemplate[]>(
      '/notifications/templates',
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async createTemplate(
    payload: CreateNotificationTemplatePayload,
  ): Promise<NotificationTemplate> {
    const response = await apiClient.post<NotificationTemplate>(
      '/notifications/templates',
      payload,
    );
    return response.data;
  },

  async updateTemplate(
    templateId: string,
    payload: UpdateNotificationTemplatePayload,
  ): Promise<NotificationTemplate> {
    const response = await apiClient.patch<NotificationTemplate>(
      `/notifications/templates/${templateId}`,
      payload,
    );
    return response.data;
  },

  async toggleTemplate(templateId: string): Promise<NotificationTemplate> {
    const response = await apiClient.patch<NotificationTemplate>(
      `/notifications/templates/${templateId}/toggle`,
    );
    return response.data;
  },
};

export default notificationsService;
