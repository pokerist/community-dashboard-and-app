import type { MobileNotificationRow } from './types';

const PERSONAL_ENTITY_TYPES = new Set([
  'INVOICE',
  'VIOLATION',
  'SERVICE_REQUEST',
  'BOOKING',
  'COMPLAINT',
  'ACCESS_QR',
  'ACCESS_QRCODE',
  'QR_CODE',
  'QR',
]);

const COMMUNITY_NOTIFICATION_TYPES = new Set([
  'ANNOUNCEMENT',
  'EVENT_NOTIFICATION',
  'MAINTENANCE_ALERT',
  'EMERGENCY_ALERT',
]);

export function humanizeToken(value?: string | null) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatNotificationDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function formatNotificationRelativeTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatNotificationDateTime(value);
}

export function isPersonalNotification(item: {
  type?: string | null;
  targetAudience?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  const payloadEntityType = String(item.payload?.entityType ?? '').toUpperCase();
  if (PERSONAL_ENTITY_TYPES.has(payloadEntityType)) return true;

  const audience = String(item.targetAudience ?? '').toUpperCase();
  if (audience === 'SPECIFIC_RESIDENCES') return true;

  const rawType = String(item.type ?? '').toUpperCase();
  return /(INVOICE|VIOLATION|SERVICE|BOOKING|COMPLAINT|ACCESS|QR)/.test(rawType);
}

export function isCommunityUpdateNotification(item: MobileNotificationRow) {
  if (isPersonalNotification(item)) return false;
  const rawType = String(item.type ?? '').toUpperCase();
  if (COMMUNITY_NOTIFICATION_TYPES.has(rawType)) return true;
  const audience = String(item.targetAudience ?? '').toUpperCase();
  return audience !== 'SPECIFIC_RESIDENCES';
}

export function communityUpdateTitle(item: Pick<MobileNotificationRow, 'title' | 'type'>) {
  const title = String(item.title ?? '').trim();
  if (title) return title;
  return 'Community Update';
}

export function notificationTypeLabel(item: MobileNotificationRow) {
  const payloadType = String(item.payload?.entityType ?? '').toUpperCase();
  const rawType = String(item.type ?? '').toUpperCase();
  if (payloadType === 'INVOICE' || rawType.includes('INVOICE') || rawType.includes('PAYMENT')) {
    return 'Payments';
  }
  if (payloadType === 'VIOLATION' || rawType.includes('VIOLATION')) {
    return 'Violations';
  }
  if (payloadType === 'SERVICE_REQUEST' || rawType.includes('SERVICE')) {
    return 'Service Requests';
  }
  if (payloadType === 'COMPLAINT' || rawType.includes('COMPLAINT')) {
    return 'Complaints';
  }
  if (rawType.includes('BOOKING')) {
    return 'Bookings';
  }
  if (
    payloadType === 'ACCESS_QR' ||
    payloadType === 'ACCESS_QRCODE' ||
    payloadType === 'QR_CODE' ||
    rawType.includes('ACCESS') ||
    rawType.includes('QR')
  ) {
    return 'Access QR';
  }
  if (rawType.includes('INCIDENT') || rawType.includes('SECURITY')) {
    return 'Security';
  }
  if (isCommunityUpdateNotification(item)) {
    return 'Community Update';
  }
  return humanizeToken(item.type) || 'Notification';
}
