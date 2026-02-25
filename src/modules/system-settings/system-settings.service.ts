import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateSystemSettingsBackupDto,
  ImportSystemSettingsSnapshotDto,
  ListSystemSettingsBackupsDto,
  TestCrmConnectionDto,
  UpdateBrandSettingsDto,
  UpdateBackupSettingsDto,
  UpdateCrmSettingsDto,
  UpdateGeneralSettingsDto,
  UpdateNotificationSettingsDto,
  UpdateSecuritySettingsDto,
} from './dto/system-settings.dto';

type SystemSettingsState = {
  general: {
    companyName: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    defaultLanguage: string;
  };
  notifications: {
    emailFrom: string;
    smsSender: string;
    pushTopic: string;
    emailTemplate: string;
    smsTemplate: string;
    enableEmail: boolean;
    enableSms: boolean;
    enablePush: boolean;
    enableInApp: boolean;
  };
  security: {
    enforce2fa: boolean;
    autoLogoutEnabled: boolean;
    sessionTimeoutMinutes: number;
    rateLimitEnabled: boolean;
    rateLimitPerMinute: number;
    minPasswordLength: number;
  };
  backup: {
    autoBackups: boolean;
    backupTime: string;
    retentionDays: number;
  };
  crm: {
    baseUrl: string;
    authToken: string;
    autoSyncResidents: boolean;
    autoSyncPayments: boolean;
    autoSyncServiceRequests: boolean;
    syncIntervalMinutes: number;
  };
  brand: {
    companyName: string;
    appDisplayName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logoFileId: string;
    tagline: string;
    supportEmail: string;
    supportPhone: string;
  };
};

type SectionKey = keyof SystemSettingsState;
type PrismaLikeClient = PrismaService | Prisma.TransactionClient;

const SETTINGS_SECTIONS: SectionKey[] = [
  'general',
  'notifications',
  'security',
  'backup',
  'crm',
  'brand',
];

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly defaults: SystemSettingsState = {
    general: {
      companyName: 'SSS Community',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      dateFormat: 'DD/MM/YYYY',
      defaultLanguage: 'English',
    },
    notifications: {
      emailFrom: 'noreply@alkarma.com',
      smsSender: 'AlKarma',
      pushTopic: 'community-updates',
      emailTemplate:
        'Dear {resident_name},\n\n{message}\n\nRegards,\nAl Karma Team',
      smsTemplate: '{message} - Al Karma',
      enableEmail: true,
      enableSms: false,
      enablePush: false,
      enableInApp: true,
    },
    security: {
      enforce2fa: true,
      autoLogoutEnabled: true,
      sessionTimeoutMinutes: 30,
      rateLimitEnabled: true,
      rateLimitPerMinute: 100,
      minPasswordLength: 8,
    },
    backup: {
      autoBackups: false,
      backupTime: '02:00',
      retentionDays: 30,
    },
    crm: {
      baseUrl: '',
      authToken: '',
      autoSyncResidents: true,
      autoSyncPayments: true,
      autoSyncServiceRequests: false,
      syncIntervalMinutes: 15,
    },
    brand: {
      companyName: 'SSS Community',
      appDisplayName: 'SSS Community',
      primaryColor: '#2A3E35',
      secondaryColor: '#C9A961',
      accentColor: '#0B5FFF',
      logoFileId: '',
      tagline: 'Smart Living',
      supportEmail: '',
      supportPhone: '',
    },
  };

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private mergeWithDefaults(raw: unknown): SystemSettingsState {
    const incoming = this.isObject(raw) ? raw : {};
    return {
      general: {
        ...this.defaults.general,
        ...(this.isObject(incoming.general) ? incoming.general : {}),
      },
      notifications: {
        ...this.defaults.notifications,
        ...(this.isObject(incoming.notifications) ? incoming.notifications : {}),
      },
      security: {
        ...this.defaults.security,
        ...(this.isObject(incoming.security) ? incoming.security : {}),
      },
      backup: {
        ...this.defaults.backup,
        ...(this.isObject(incoming.backup) ? incoming.backup : {}),
      },
      crm: {
        ...this.defaults.crm,
        ...(this.isObject(incoming.crm) ? incoming.crm : {}),
      },
      brand: {
        ...this.defaults.brand,
        ...(this.isObject(incoming.brand) ? incoming.brand : {}),
      },
    };
  }

  private normalizeSectionValue<K extends SectionKey>(
    section: K,
    value: unknown,
  ): SystemSettingsState[K] {
    const merged = this.mergeWithDefaults({ [section]: value });
    return merged[section];
  }

  private async upsertSection<K extends SectionKey>(
    client: PrismaLikeClient,
    section: K,
    value: SystemSettingsState[K],
    actorUserId?: string | null,
  ) {
    const payload = value as unknown as Prisma.InputJsonValue;
    return client.systemSetting.upsert({
      where: { section },
      create: {
        section,
        value: payload,
        updatedById: actorUserId ?? null,
      },
      update: {
        value: payload,
        updatedById: actorUserId ?? null,
      },
    });
  }

  private validateSection<K extends SectionKey>(
    section: K,
    value: SystemSettingsState[K],
  ) {
    if (section === 'backup') {
      const backup = value as SystemSettingsState['backup'];
      if (!/^\d{2}:\d{2}$/.test(String(backup.backupTime || ''))) {
        throw new BadRequestException('backupTime must be in HH:MM format');
      }
    }

    if (section === 'crm') {
      const crm = value as SystemSettingsState['crm'];
      if (crm.baseUrl) {
        try {
          new URL(crm.baseUrl);
        } catch {
          throw new BadRequestException('crm.baseUrl must be a valid URL');
        }
      }
    }

    if (section === 'brand') {
      const brand = value as SystemSettingsState['brand'];
      const colorFields: Array<keyof SystemSettingsState['brand']> = [
        'primaryColor',
        'secondaryColor',
        'accentColor',
      ];
      for (const field of colorFields) {
        const raw = String(brand[field] ?? '').trim();
        if (!/^#[0-9A-Fa-f]{6}$/.test(raw)) {
          throw new BadRequestException(`${String(field)} must be a HEX color (#RRGGBB)`);
        }
      }
      if (brand.logoFileId && !/^[0-9a-fA-F-]{8,}$/.test(String(brand.logoFileId))) {
        throw new BadRequestException('brand.logoFileId looks invalid');
      }
    }
  }

  async getSettings() {
    const rows = await this.prisma.systemSetting.findMany();

    const bySection = new Map<string, (typeof rows)[number]>();
    for (const row of rows) bySection.set(row.section, row);

    const data = {
      ...this.defaults,
    } as SystemSettingsState;

    for (const section of SETTINGS_SECTIONS) {
      const row = bySection.get(section);
      if (!row) continue;
      (data as Record<string, unknown>)[section] = this.normalizeSectionValue(
        section,
        row.value,
      ) as unknown;
    }

    return {
      data,
      meta: {
        sections: SETTINGS_SECTIONS,
        updatedAtBySection: Object.fromEntries(
          SETTINGS_SECTIONS.map((section) => [
            section,
            bySection.get(section)?.updatedAt?.toISOString?.() ??
              bySection.get(section)?.updatedAt ??
              null,
          ]),
        ),
      },
    };
  }

  async updateGeneral(
    dto: UpdateGeneralSettingsDto,
    actorUserId?: string | null,
  ) {
    return this.updateSection('general', dto, actorUserId);
  }

  async updateNotifications(
    dto: UpdateNotificationSettingsDto,
    actorUserId?: string | null,
  ) {
    return this.updateSection('notifications', dto, actorUserId);
  }

  async updateSecurity(
    dto: UpdateSecuritySettingsDto,
    actorUserId?: string | null,
  ) {
    return this.updateSection('security', dto, actorUserId);
  }

  async updateBackup(
    dto: UpdateBackupSettingsDto,
    actorUserId?: string | null,
  ) {
    return this.updateSection('backup', dto, actorUserId);
  }

  async updateCrm(dto: UpdateCrmSettingsDto, actorUserId?: string | null) {
    return this.updateSection('crm', dto, actorUserId);
  }

  async updateBrand(dto: UpdateBrandSettingsDto, actorUserId?: string | null) {
    return this.updateSection('brand', dto, actorUserId);
  }

  async getMobileAppConfig(baseUrl?: string) {
    const settings = await this.getSettings();
    const brand = settings.data.brand;
    const normalizedBase = String(baseUrl ?? '').replace(/\/+$/, '');
    const logoPath = brand.logoFileId
      ? `/files/public/brand-logo/${brand.logoFileId}`
      : null;
    return {
      brand: {
        companyName: brand.companyName || settings.data.general.companyName,
        appDisplayName:
          brand.appDisplayName || brand.companyName || settings.data.general.companyName,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        accentColor: brand.accentColor,
        tagline: brand.tagline || '',
        supportEmail: brand.supportEmail || '',
        supportPhone: brand.supportPhone || '',
        logoFileId: brand.logoFileId || null,
        logoPath,
        logoUrl: logoPath && normalizedBase ? `${normalizedBase}${logoPath}` : null,
      },
      meta: {
        version: 1,
        updatedAt: settings.meta.updatedAtBySection?.brand ?? null,
      },
    };
  }

  private async updateSection<K extends SectionKey>(
    section: K,
    patch: Partial<SystemSettingsState[K]>,
    actorUserId?: string | null,
  ) {
    if (!patch || Object.keys(patch).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    const current = (await this.getSettings()).data[section];
    const next = {
      ...current,
      ...(patch as object),
    } as SystemSettingsState[K];

    this.validateSection(section, next);

    const row = await this.upsertSection(this.prisma, section, next, actorUserId);
    return {
      section,
      data: next,
      meta: {
        updatedAt: row.updatedAt,
        updatedById: row.updatedById,
      },
    };
  }

  async testCrmConnection(dto: TestCrmConnectionDto) {
    const current = (await this.getSettings()).data.crm;
    const baseUrl = (dto.baseUrl ?? current.baseUrl ?? '').trim();
    const authToken = (dto.authToken ?? current.authToken ?? '').trim();

    if (!baseUrl) {
      throw new BadRequestException('CRM baseUrl is required');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(baseUrl);
    } catch {
      throw new BadRequestException('CRM baseUrl must be a valid URL');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const checkedAt = new Date().toISOString();

    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`,
            }
          : undefined,
        signal: controller.signal,
      });

      return {
        ok: response.ok,
        statusCode: response.status,
        statusText: response.statusText,
        checkedAt,
        url: parsedUrl.toString(),
      };
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'CRM connection test failed';
      return {
        ok: false,
        statusCode: null,
        statusText: null,
        checkedAt,
        url: parsedUrl.toString(),
        error: msg,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async createBackup(
    dto: CreateSystemSettingsBackupDto,
    actorUserId?: string | null,
  ) {
    const snapshot = (await this.getSettings()).data as unknown as Prisma.InputJsonValue;
    const created = await this.prisma.systemSettingsBackupSnapshot.create({
      data: {
        label:
          dto.label?.trim() ||
          `System settings backup ${new Date().toISOString().slice(0, 19)}`,
        snapshot,
        createdById: actorUserId ?? null,
      },
    });

    return {
      success: true,
      data: {
        id: created.id,
        label: created.label,
        createdAt: created.createdAt,
      },
    };
  }

  async listBackupHistory(query: ListSystemSettingsBackupsDto) {
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const rows = await this.prisma.systemSettingsBackupSnapshot.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        label: true,
        createdAt: true,
        createdById: true,
        restoredAt: true,
        restoredById: true,
      },
    });

    return {
      data: rows,
      meta: {
        limit,
        count: rows.length,
      },
    };
  }

  async restoreBackup(backupId: string, actorUserId?: string | null) {
    const backup = await this.prisma.systemSettingsBackupSnapshot.findUnique({
      where: { id: backupId },
    });
    if (!backup) throw new NotFoundException('Backup snapshot not found');

    const merged = this.mergeWithDefaults(backup.snapshot);

    await this.prisma.$transaction(async (tx) => {
      for (const section of SETTINGS_SECTIONS) {
        this.validateSection(section, merged[section]);
        await this.upsertSection(tx, section, merged[section], actorUserId);
      }

      await tx.systemSettingsBackupSnapshot.update({
        where: { id: backupId },
        data: {
          restoredAt: new Date(),
          restoredById: actorUserId ?? null,
        },
      });
    });

    return {
      success: true,
      backupId,
      data: (await this.getSettings()).data,
    };
  }

  async importSnapshot(
    dto: ImportSystemSettingsSnapshotDto,
    actorUserId?: string | null,
  ) {
    const merged = this.mergeWithDefaults(dto.snapshot);
    await this.prisma.$transaction(async (tx) => {
      for (const section of SETTINGS_SECTIONS) {
        this.validateSection(section, merged[section]);
        await this.upsertSection(tx, section, merged[section], actorUserId);
      }
    });

    return {
      success: true,
      data: merged,
    };
  }
}
