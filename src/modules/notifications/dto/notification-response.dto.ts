import {
  Audience,
  Channel,
  NotificationLogStatus,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';

export class NotificationStatsResponseDto {
  totalSent!: number;
  deliveredToday!: number;
  failedToday!: number;
  activeDeviceTokens!: number;
  byChannel!: Record<Channel, number>;
  byType!: Record<NotificationType, number>;
}

export class NotificationListItemDto {
  id!: string;
  title!: string;
  type!: NotificationType;
  channels!: Channel[];
  targetAudience!: Audience;
  sentAt!: Date | null;
  deliveredCount!: number;
  failedCount!: number;
  status!: NotificationStatus;
  communityId!: string | null;
  createdAt!: Date;
}

export class NotificationListResponseDto {
  data!: NotificationListItemDto[];
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class NotificationLogItemDto {
  id!: string;
  channel!: Channel;
  recipient!: string;
  status!: NotificationLogStatus;
  providerResponse!: Record<string, unknown> | null;
  createdAt!: Date;
}

export class NotificationDeliveryBreakdownDto {
  channel!: Channel;
  attempted!: number;
  delivered!: number;
  failed!: number;
  pending!: number;
  read!: number;
}

export class NotificationDetailResponseDto {
  id!: string;
  title!: string;
  titleAr!: string | null;
  type!: NotificationType;
  channels!: Channel[];
  status!: NotificationStatus;
  communityId!: string | null;
  targetAudience!: Audience;
  audienceMeta!: Record<string, unknown> | null;
  messageEn!: string;
  messageAr!: string | null;
  scheduledAt!: Date | null;
  sentAt!: Date | null;
  sentCount!: number;
  deliveredCount!: number;
  failedCount!: number;
  readCount!: number;
  openedCount!: number;
  createdAt!: Date;
  logs!: NotificationLogItemDto[];
  logsMeta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  deliveryBreakdown!: NotificationDeliveryBreakdownDto[];
}

export class SendNotificationResponseDto {
  notificationId!: string;
}

export class ResendFailedResponseDto {
  success!: boolean;
  notificationId!: string;
  message?: string;
  attempted!: number;
  sent!: number;
  failed!: number;
  byChannel!: Record<string, { attempted: number; sent: number; failed: number }>;
  failureReasons!: Record<string, number>;
}
