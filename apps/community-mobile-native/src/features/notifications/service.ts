import { http } from '../../lib/http';
import type {
  DeviceTokenRegistrationResponse,
  NotificationChangesResponse,
  MobileNotificationRow,
  NotificationLogRow,
  NotificationsPage,
} from './types';

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function mapLog(log: any): NotificationLogRow {
  return {
    id: String(log?.id ?? ''),
    channel: String(log?.channel ?? 'IN_APP'),
    recipient: String(log?.recipient ?? ''),
    status: String(log?.status ?? 'UNKNOWN'),
    createdAt: log?.createdAt ?? null,
    updatedAt: log?.updatedAt ?? null,
  };
}

function mapNotification(row: any): MobileNotificationRow {
  const logs = Array.isArray(row?.logs) ? row.logs.map(mapLog) : [];
  const inAppLog = logs.find(
    (l: NotificationLogRow) => String(l.channel).toUpperCase() === 'IN_APP',
  );
  const inAppStatus = String(inAppLog?.status ?? '').toUpperCase();

  return {
    id: String(row?.id ?? ''),
    title: String(row?.title ?? 'Untitled'),
    type: String(row?.type ?? 'ANNOUNCEMENT'),
    messageEn: String(row?.messageEn ?? ''),
    messageAr: row?.messageAr ?? null,
    status: String(row?.status ?? 'UNKNOWN'),
    createdAt: row?.createdAt ?? null,
    sentAt: row?.sentAt ?? null,
    targetAudience: row?.targetAudience ? String(row.targetAudience) : undefined,
    payload:
      row && typeof row.payload === 'object' && row.payload
        ? (row.payload as Record<string, unknown>)
        : null,
    logs,
    isRead: inAppStatus === 'READ',
  };
}

export async function listMyNotifications(
  accessToken: string,
  params?: { page?: number; limit?: number },
): Promise<NotificationsPage> {
  const response = await http.get('/notifications/me', {
    headers: authHeaders(accessToken),
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    },
  });

  const raw = response.data ?? {};
  const rawRows = Array.isArray(raw.data) ? raw.data : [];
  const meta = raw.meta ?? {};

  return {
    data: rawRows.map(mapNotification),
    meta: {
      total: Number(meta.total ?? rawRows.length ?? 0),
      page: Number(meta.page ?? params?.page ?? 1),
      limit: Number(meta.limit ?? params?.limit ?? 20),
      totalPages: Number(meta.totalPages ?? 1),
    },
  };
}

export async function markNotificationAsRead(
  accessToken: string,
  notificationId: string,
): Promise<boolean> {
  const response = await http.patch(
    `/notifications/${notificationId}/read`,
    {},
    {
      headers: authHeaders(accessToken),
    },
  );

  return Boolean(response.data?.success ?? true);
}

export async function listMyNotificationChanges(
  accessToken: string,
  params?: { after?: string | null; limit?: number },
): Promise<NotificationChangesResponse> {
  const response = await http.get('/notifications/me/changes', {
    headers: authHeaders(accessToken),
    params: {
      ...(params?.after ? { after: params.after } : {}),
      limit: params?.limit ?? 50,
    },
  });

  const raw = response.data ?? {};
  const rawRows = Array.isArray(raw.data) ? raw.data : [];
  const meta = raw.meta ?? {};

  return {
    data: rawRows.map(mapNotification),
    meta: {
      limit: Number(meta.limit ?? (params?.limit ?? 50)),
      count: Number(meta.count ?? rawRows.length),
      nextCursor:
        typeof meta.nextCursor === 'string' || meta.nextCursor === null
          ? meta.nextCursor
          : null,
      serverTime:
        typeof meta.serverTime === 'string' || meta.serverTime === null
          ? meta.serverTime
          : null,
    },
  };
}

export async function registerPushDeviceToken(
  accessToken: string,
  payload: {
    token: string;
    platform: 'ANDROID' | 'IOS' | 'WEB';
    deviceId?: string;
    appVersion?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<DeviceTokenRegistrationResponse> {
  const response = await http.post('/notifications/device-tokens', payload, {
    headers: authHeaders(accessToken),
  });
  const row = response.data ?? {};
  return {
    id: String(row.id ?? ''),
    userId: row.userId ? String(row.userId) : undefined,
    token: row.token ? String(row.token) : undefined,
    platform: row.platform ? String(row.platform) : undefined,
    isActive: typeof row.isActive === 'boolean' ? row.isActive : undefined,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

export async function revokePushDeviceToken(
  accessToken: string,
  deviceTokenId: string,
): Promise<void> {
  await http.delete(`/notifications/device-tokens/${deviceTokenId}`, {
    headers: authHeaders(accessToken),
  });
}
