import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Audience, Channel, NotificationType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ResolveFireEvacuationDto } from './dto/resolve-fire-evacuation.dto';
import { TriggerFireEvacuationDto } from './dto/trigger-fire-evacuation.dto';

type FireEvacuationRecipient = {
  userId: string;
  name: string;
};

type FireEvacuationAck = {
  userId: string;
  at: string;
};

type FireEvacuationState = {
  active: boolean;
  titleEn: string;
  messageEn: string;
  messageAr: string;
  triggeredAt: string | null;
  triggeredById: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNote: string | null;
  recipients: FireEvacuationRecipient[];
  acknowledged: FireEvacuationAck[];
};

@Injectable()
export class FireEvacuationService {
  private readonly logger = new Logger(FireEvacuationService.name);
  private readonly settingsSection = 'fire_evacuation';

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async trigger(dto: TriggerFireEvacuationDto, actorUserId?: string) {
    const recipients = await this.resolveRecipients();
    if (recipients.length === 0) {
      throw new BadRequestException(
        'No active resident recipients found for fire evacuation.',
      );
    }

    const nowIso = new Date().toISOString();
    const titleEn = dto.titleEn?.trim() || 'Fire Evacuation Alert';
    const messageEn =
      dto.messageEn?.trim() ||
      'Emergency alarm triggered. Please evacuate immediately and confirm once you are safe.';
    const messageAr =
      dto.messageAr?.trim() ||
      'تم إطلاق إنذار حريق. يرجى الإخلاء فورًا وتأكيد الوصول إلى مكان آمن.';

    const nextState: FireEvacuationState = {
      active: true,
      titleEn,
      messageEn,
      messageAr,
      triggeredAt: nowIso,
      triggeredById: actorUserId ?? null,
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
      recipients,
      acknowledged: [],
    };

    await this.saveState(nextState, actorUserId);

    try {
      await this.notificationsService.sendNotification(
        {
          type: NotificationType.EMERGENCY_ALERT,
          title: titleEn,
          messageEn,
          messageAr,
          channels: [Channel.IN_APP, Channel.PUSH],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: {
            userIds: recipients.map((recipient) => recipient.userId),
          },
          payload: {
            route: '/fire-evacuation',
            entityType: 'FIRE_EVACUATION',
            entityId: 'ACTIVE_DRILL',
            eventKey: 'fire_evacuation.triggered',
            playAlarm: true,
            triggeredAt: nowIso,
          },
        },
        actorUserId,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to dispatch fire evacuation push/in-app notification: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.toAdminView(nextState);
  }

  async resolve(dto: ResolveFireEvacuationDto, actorUserId?: string) {
    const current = await this.getState();
    if (!current.active) {
      return this.toAdminView(current);
    }

    const nextState: FireEvacuationState = {
      ...current,
      active: false,
      resolvedAt: new Date().toISOString(),
      resolvedById: actorUserId ?? null,
      resolutionNote: dto.note?.trim() || null,
    };

    await this.saveState(nextState, actorUserId);

    const recipientIds = nextState.recipients.map((recipient) => recipient.userId);
    if (recipientIds.length > 0) {
      try {
        await this.notificationsService.sendNotification(
          {
            type: NotificationType.EMERGENCY_ALERT,
            title: 'All Clear',
            messageEn:
              'Fire evacuation drill has been closed. Thank you for your response.',
            messageAr:
              'تم إغلاق إنذار الإخلاء. شكرًا لتعاونكم.',
            channels: [Channel.IN_APP, Channel.PUSH],
            targetAudience: Audience.SPECIFIC_RESIDENCES,
            audienceMeta: {
              userIds: recipientIds,
            },
            payload: {
              route: '/notifications',
              entityType: 'FIRE_EVACUATION',
              entityId: 'ACTIVE_DRILL',
              eventKey: 'fire_evacuation.resolved',
            },
          },
          actorUserId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to dispatch fire evacuation resolution notification: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return this.toAdminView(nextState);
  }

  async acknowledge(userId: string) {
    const current = await this.getState();
    if (!current.active) {
      return this.toResidentView(current, userId);
    }

    const isRecipient = current.recipients.some((recipient) => recipient.userId === userId);
    if (!isRecipient) {
      throw new ForbiddenException(
        'Current user is not targeted by the active fire evacuation alert.',
      );
    }

    const alreadyAcked = current.acknowledged.some((row) => row.userId === userId);
    if (alreadyAcked) {
      return this.toResidentView(current, userId);
    }

    const nextState: FireEvacuationState = {
      ...current,
      acknowledged: [
        ...current.acknowledged,
        {
          userId,
          at: new Date().toISOString(),
        },
      ],
    };

    await this.saveState(nextState, userId);
    return this.toResidentView(nextState, userId);
  }

  async getAdminStatus() {
    const state = await this.getState();
    return this.toAdminView(state);
  }

  async getMyStatus(userId: string) {
    const state = await this.getState();
    return this.toResidentView(state, userId);
  }

  private defaultState(): FireEvacuationState {
    return {
      active: false,
      titleEn: 'Fire Evacuation Alert',
      messageEn:
        'Emergency alarm triggered. Please evacuate immediately and confirm once you are safe.',
      messageAr:
        'تم إطلاق إنذار حريق. يرجى الإخلاء فورًا وتأكيد الوصول إلى مكان آمن.',
      triggeredAt: null,
      triggeredById: null,
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
      recipients: [],
      acknowledged: [],
    };
  }

  private async resolveRecipients(): Promise<FireEvacuationRecipient[]> {
    const rows = await this.prisma.unitAccess.findMany({
      where: {
        status: 'ACTIVE',
        user: {
          userStatus: 'ACTIVE',
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            nameEN: true,
            nameAR: true,
            email: true,
          },
        },
      },
    });

    const byUser = new Map<string, FireEvacuationRecipient>();
    for (const row of rows) {
      if (!row.userId) continue;
      if (!byUser.has(row.userId)) {
        const name =
          row.user.nameEN?.trim() ||
          row.user.nameAR?.trim() ||
          row.user.email?.trim() ||
          `User ${row.userId.slice(0, 8)}`;
        byUser.set(row.userId, {
          userId: row.userId,
          name,
        });
      }
    }
    return Array.from(byUser.values());
  }

  private sanitizeState(raw: unknown): FireEvacuationState {
    const fallback = this.defaultState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return fallback;
    }

    const record = raw as Record<string, unknown>;
    const recipientsRaw = Array.isArray(record.recipients) ? record.recipients : [];
    const acknowledgedRaw = Array.isArray(record.acknowledged)
      ? record.acknowledged
      : [];

    const recipients = recipientsRaw
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        const userId = String(row.userId ?? '').trim();
        if (!userId) return null;
        const name = String(row.name ?? '').trim() || `User ${userId.slice(0, 8)}`;
        return { userId, name } satisfies FireEvacuationRecipient;
      })
      .filter((row): row is FireEvacuationRecipient => Boolean(row));

    const acknowledged = acknowledgedRaw
      .map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        const userId = String(row.userId ?? '').trim();
        const at = String(row.at ?? '').trim();
        if (!userId || !at) return null;
        return { userId, at } satisfies FireEvacuationAck;
      })
      .filter((row): row is FireEvacuationAck => Boolean(row));

    return {
      active: record.active === true,
      titleEn: String(record.titleEn ?? fallback.titleEn).trim() || fallback.titleEn,
      messageEn:
        String(record.messageEn ?? fallback.messageEn).trim() || fallback.messageEn,
      messageAr:
        String(record.messageAr ?? fallback.messageAr).trim() || fallback.messageAr,
      triggeredAt: record.triggeredAt ? String(record.triggeredAt) : null,
      triggeredById: record.triggeredById ? String(record.triggeredById) : null,
      resolvedAt: record.resolvedAt ? String(record.resolvedAt) : null,
      resolvedById: record.resolvedById ? String(record.resolvedById) : null,
      resolutionNote: record.resolutionNote ? String(record.resolutionNote) : null,
      recipients,
      acknowledged,
    };
  }

  private async getState(): Promise<FireEvacuationState> {
    const row = await this.prisma.systemSetting.findUnique({
      where: {
        section: this.settingsSection,
      },
    });
    return this.sanitizeState(row?.value);
  }

  private async saveState(state: FireEvacuationState, actorUserId?: string | null) {
    await this.prisma.systemSetting.upsert({
      where: {
        section: this.settingsSection,
      },
      create: {
        section: this.settingsSection,
        value: state,
        updatedById: actorUserId ?? null,
      },
      update: {
        value: state,
        updatedById: actorUserId ?? null,
      },
    });
  }

  private toAdminView(state: FireEvacuationState) {
    const acknowledgedSet = new Set(state.acknowledged.map((row) => row.userId));
    const acknowledgedByUser = new Map(state.acknowledged.map((row) => [row.userId, row.at]));
    const acknowledgedRecipients = state.recipients
      .filter((recipient) => acknowledgedSet.has(recipient.userId))
      .map((recipient) => ({
        ...recipient,
        acknowledgedAt: acknowledgedByUser.get(recipient.userId) ?? null,
      }));
    const pendingRecipients = state.recipients
      .filter((recipient) => !acknowledgedSet.has(recipient.userId))
      .map((recipient) => ({
        ...recipient,
      }));

    return {
      active: state.active,
      titleEn: state.titleEn,
      messageEn: state.messageEn,
      messageAr: state.messageAr,
      triggeredAt: state.triggeredAt,
      triggeredById: state.triggeredById,
      resolvedAt: state.resolvedAt,
      resolvedById: state.resolvedById,
      resolutionNote: state.resolutionNote,
      counters: {
        totalRecipients: state.recipients.length,
        acknowledged: acknowledgedRecipients.length,
        pending: pendingRecipients.length,
      },
      recipients: state.recipients,
      acknowledgedRecipients,
      pendingRecipients,
      updatedAt: new Date().toISOString(),
    };
  }

  private toResidentView(state: FireEvacuationState, userId: string) {
    const recipient = state.recipients.find((row) => row.userId === userId);
    const ack = state.acknowledged.find((row) => row.userId === userId);
    const acknowledgedSet = new Set(state.acknowledged.map((row) => row.userId));
    const pendingCount = state.recipients.filter(
      (row) => !acknowledgedSet.has(row.userId),
    ).length;

    return {
      active: state.active && Boolean(recipient),
      targeted: Boolean(recipient),
      titleEn: state.titleEn,
      messageEn: state.messageEn,
      messageAr: state.messageAr,
      triggeredAt: state.triggeredAt,
      resolvedAt: state.resolvedAt,
      acknowledged: Boolean(ack),
      acknowledgedAt: ack?.at ?? null,
      counters: {
        totalRecipients: state.recipients.length,
        pending: pendingCount,
      },
    };
  }
}
