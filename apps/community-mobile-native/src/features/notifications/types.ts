export type NotificationLogRow = {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type MobileNotificationRow = {
  id: string;
  title: string;
  type: string;
  messageEn: string;
  messageAr?: string | null;
  status: string;
  createdAt?: string | null;
  sentAt?: string | null;
  targetAudience?: string;
  payload?: {
    route?: string;
    entityType?: string;
    entityId?: string;
    eventKey?: string;
    [key: string]: unknown;
  } | null;
  logs: NotificationLogRow[];
  isRead: boolean;
};

export type NotificationsPage = {
  data: MobileNotificationRow[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type NotificationChangesResponse = {
  data: MobileNotificationRow[];
  meta: {
    limit: number;
    count: number;
    nextCursor: string | null;
    serverTime?: string | null;
  };
};

export type DeviceTokenRegistrationResponse = {
  id: string;
  userId?: string;
  token?: string;
  platform?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};
