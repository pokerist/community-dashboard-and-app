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
  UpdateMobileAccessSettingsDto,
  UpdateOnboardingSettingsDto,
  UpdateOffersSettingsDto,
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
  onboarding: {
    enabled: boolean;
    slides: Array<{
      title: string;
      subtitle: string;
      description: string;
      imageUrl: string;
    }>;
  };
  offers: {
    enabled: boolean;
    banners: Array<{
      id: string;
      title: string;
      subtitle: string;
      description: string;
      imageUrl: string;
      imageFileId: string;
      linkUrl: string;
      priority: number;
      active: boolean;
      startAt: string;
      endAt: string;
    }>;
  };
  mobileAccess: {
    owner: Record<string, boolean>;
    tenant: Record<string, boolean>;
    family: Record<string, boolean>;
    authorized: Record<string, boolean>;
    contractor: Record<string, boolean>;
    preDeliveryOwner: Record<string, boolean>;
    resident: Record<string, boolean>;
  };
  integrations: Record<string, unknown>;
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
  'onboarding',
  'offers',
  'mobileAccess',
  'integrations',
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
    onboarding: {
      enabled: true,
      slides: [
        {
          title: 'Welcome to SSS Community',
          subtitle: 'SMART LIVING',
          description:
            'Experience premium community living with services, payments, bookings, and access control in one app.',
          imageUrl:
            'https://images.unsplash.com/photo-1560613654-ea1945efc370?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        },
        {
          title: 'Manage Your Property',
          subtitle: 'ALL IN ONE',
          description:
            'Track requests, payments, visitors, and updates from your management team with a modern mobile experience.',
          imageUrl:
            'https://images.unsplash.com/photo-1643892605308-70a6559cfd0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        },
        {
          title: 'Secure & Connected',
          subtitle: 'ALWAYS INFORMED',
          description:
            'Receive verified notifications, generate QR access, and stay connected to all important community updates.',
          imageUrl:
            'https://images.unsplash.com/photo-1633194883650-df448a10d554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        },
      ],
    },
    offers: {
      enabled: false,
      banners: [],
    },
    mobileAccess: {
      owner: {
        canUseServices: true,
        canUseBookings: true,
        canUseComplaints: true,
        canUseQr: true,
        canViewFinance: true,
        canManageHousehold: true,
        canUseDiscover: true,
        canUseHelpCenter: true,
        canUseUtilities: true,
      },
      tenant: {
        canUseServices: true,
        canUseBookings: true,
        canUseComplaints: true,
        canUseQr: true,
        canViewFinance: true,
        canManageHousehold: true,
        canUseDiscover: true,
        canUseHelpCenter: true,
        canUseUtilities: true,
      },
      family: {
        canUseServices: true,
        canUseBookings: true,
        canUseComplaints: true,
        canUseQr: false,
        canViewFinance: false,
        canManageHousehold: false,
        canUseDiscover: true,
        canUseHelpCenter: true,
        canUseUtilities: false,
      },
      authorized: {
        canUseServices: true,
        canUseBookings: true,
        canUseComplaints: true,
        canUseQr: true,
        canViewFinance: false,
        canManageHousehold: false,
        canUseDiscover: true,
        canUseHelpCenter: true,
        canUseUtilities: false,
      },
      contractor: {
        canUseServices: false,
        canUseBookings: false,
        canUseComplaints: false,
        canUseQr: true,
        canViewFinance: false,
        canManageHousehold: false,
        canUseDiscover: false,
        canUseHelpCenter: true,
        canUseUtilities: false,
      },
      preDeliveryOwner: {
        canUseServices: false,
        canUseBookings: false,
        canUseComplaints: true,
        canUseQr: false,
        canViewFinance: true,
        canManageHousehold: false,
        canUseDiscover: true,
        canUseHelpCenter: true,
        canUseUtilities: true,
      },
      resident: {
        canUseServices: true,
        canUseBookings: true,
        canUseComplaints: true,
        canUseQr: true,
        canViewFinance: true,
        canManageHousehold: false,
        canUseDiscover: true,
        canUseHelpCenter: true,
        canUseUtilities: true,
      },
    },
    integrations: {
      version: 1,
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
        ...(this.isObject(incoming.notifications)
          ? incoming.notifications
          : {}),
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
      onboarding: {
        ...this.defaults.onboarding,
        ...(this.isObject(incoming.onboarding) ? incoming.onboarding : {}),
      },
      offers: {
        ...this.defaults.offers,
        ...(this.isObject(incoming.offers) ? incoming.offers : {}),
      },
      mobileAccess: {
        ...this.defaults.mobileAccess,
        ...(this.isObject(incoming.mobileAccess) ? incoming.mobileAccess : {}),
      },
      integrations: this.isObject(incoming.integrations)
        ? incoming.integrations
        : this.defaults.integrations,
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
          throw new BadRequestException(
            `${String(field)} must be a HEX color (#RRGGBB)`,
          );
        }
      }
      if (
        brand.logoFileId &&
        !/^[0-9a-fA-F-]{8,}$/.test(String(brand.logoFileId))
      ) {
        throw new BadRequestException('brand.logoFileId looks invalid');
      }
    }

    if (section === 'onboarding') {
      const onboarding = value as SystemSettingsState['onboarding'];
      if (!Array.isArray(onboarding.slides) || onboarding.slides.length === 0) {
        throw new BadRequestException(
          'onboarding.slides must include at least one slide',
        );
      }
      if (onboarding.slides.length > 8) {
        throw new BadRequestException(
          'onboarding.slides cannot exceed 8 slides',
        );
      }
      for (let i = 0; i < onboarding.slides.length; i += 1) {
        const slide = onboarding.slides[i] as any;
        if (!String(slide?.title ?? '').trim()) {
          throw new BadRequestException(
            `onboarding.slides[${i}].title is required`,
          );
        }
        if (slide?.imageUrl) {
          try {
            new URL(String(slide.imageUrl));
          } catch {
            throw new BadRequestException(
              `onboarding.slides[${i}].imageUrl must be a valid URL`,
            );
          }
        }
      }
    }

    if (section === 'offers') {
      const offers = value as SystemSettingsState['offers'];
      if (!Array.isArray(offers.banners)) {
        throw new BadRequestException('offers.banners must be an array');
      }
      if (offers.banners.length > 20) {
        throw new BadRequestException('offers.banners cannot exceed 20 items');
      }
      for (let i = 0; i < offers.banners.length; i += 1) {
        const banner = offers.banners[i] as any;
        const title = String(banner?.title ?? '').trim();
        if (!title) {
          throw new BadRequestException(
            `offers.banners[${i}].title is required`,
          );
        }
        const imageUrl = String(banner?.imageUrl ?? '').trim();
        const imageFileId = String(banner?.imageFileId ?? '').trim();
        if (!imageUrl && !imageFileId) {
          throw new BadRequestException(
            `offers.banners[${i}] must include imageUrl or imageFileId`,
          );
        }
        if (imageUrl) {
          try {
            new URL(imageUrl);
          } catch {
            throw new BadRequestException(
              `offers.banners[${i}].imageUrl must be a valid URL`,
            );
          }
        }
        const linkUrl = String(banner?.linkUrl ?? '').trim();
        if (linkUrl) {
          try {
            new URL(linkUrl);
          } catch {
            throw new BadRequestException(
              `offers.banners[${i}].linkUrl must be a valid URL`,
            );
          }
        }
        const startAt = String(banner?.startAt ?? '').trim();
        const endAt = String(banner?.endAt ?? '').trim();
        const parsedStart = startAt ? Date.parse(startAt) : NaN;
        const parsedEnd = endAt ? Date.parse(endAt) : NaN;
        if (startAt && Number.isNaN(parsedStart)) {
          throw new BadRequestException(
            `offers.banners[${i}].startAt must be a valid ISO datetime`,
          );
        }
        if (endAt && Number.isNaN(parsedEnd)) {
          throw new BadRequestException(
            `offers.banners[${i}].endAt must be a valid ISO datetime`,
          );
        }
        if (
          startAt &&
          endAt &&
          Number.isFinite(parsedStart) &&
          Number.isFinite(parsedEnd) &&
          parsedEnd < parsedStart
        ) {
          throw new BadRequestException(
            `offers.banners[${i}].endAt must be greater than or equal to startAt`,
          );
        }
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

  async updateOnboarding(
    dto: UpdateOnboardingSettingsDto,
    actorUserId?: string | null,
  ) {
    const normalized: Partial<SystemSettingsState['onboarding']> = {
      ...(typeof dto.enabled === 'boolean' ? { enabled: dto.enabled } : {}),
      ...(Array.isArray(dto.slides)
        ? {
            slides: dto.slides.map((slide) => ({
              title: String(slide.title ?? '').trim(),
              subtitle: String(slide.subtitle ?? '').trim(),
              description: String(slide.description ?? '').trim(),
              imageUrl: String(slide.imageUrl ?? '').trim(),
            })),
          }
        : {}),
    };
    return this.updateSection('onboarding', normalized, actorUserId);
  }

  async updateOffers(
    dto: UpdateOffersSettingsDto,
    actorUserId?: string | null,
  ) {
    const normalized: Partial<SystemSettingsState['offers']> = {
      ...(typeof dto.enabled === 'boolean' ? { enabled: dto.enabled } : {}),
      ...(Array.isArray(dto.banners)
        ? {
            banners: dto.banners.map((banner, idx) => ({
              id:
                String(banner.id ?? '').trim() ||
                `offer-${Date.now()}-${idx + 1}`,
              title: String(banner.title ?? '').trim(),
              subtitle: String(banner.subtitle ?? '').trim(),
              description: String(banner.description ?? '').trim(),
              imageUrl: String(banner.imageUrl ?? '').trim(),
              imageFileId: String(banner.imageFileId ?? '').trim(),
              linkUrl: String(banner.linkUrl ?? '').trim(),
              priority:
                typeof banner.priority === 'number' &&
                Number.isFinite(banner.priority)
                  ? banner.priority
                  : idx + 1,
              active: banner.active !== false,
              startAt: String(banner.startAt ?? '').trim(),
              endAt: String(banner.endAt ?? '').trim(),
            })),
          }
        : {}),
    };
    return this.updateSection('offers', normalized, actorUserId);
  }

  async updateMobileAccess(
    dto: UpdateMobileAccessSettingsDto,
    actorUserId?: string | null,
  ) {
    const toRecord = (value: unknown): Record<string, boolean> | undefined => {
      if (!this.isObject(value)) return undefined;
      const entries = Object.entries(value).filter(
        ([, v]) => typeof v === 'boolean',
      );
      if (entries.length === 0) return undefined;
      return Object.fromEntries(entries) as Record<string, boolean>;
    };

    const normalized: Partial<SystemSettingsState['mobileAccess']> = {};
    const owner = toRecord(dto.owner);
    const tenant = toRecord(dto.tenant);
    const family = toRecord(dto.family);
    const authorized = toRecord(dto.authorized);
    const contractor = toRecord(dto.contractor);
    const preDeliveryOwner = toRecord(dto.preDeliveryOwner);
    const resident = toRecord(dto.resident);

    if (owner) normalized.owner = owner;
    if (tenant) normalized.tenant = tenant;
    if (family) normalized.family = family;
    if (authorized) normalized.authorized = authorized;
    if (contractor) normalized.contractor = contractor;
    if (preDeliveryOwner) normalized.preDeliveryOwner = preDeliveryOwner;
    if (resident) normalized.resident = resident;

    return this.updateSection('mobileAccess', normalized, actorUserId);
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
          brand.appDisplayName ||
          brand.companyName ||
          settings.data.general.companyName,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        accentColor: brand.accentColor,
        tagline: brand.tagline || '',
        supportEmail: brand.supportEmail || '',
        supportPhone: brand.supportPhone || '',
        logoFileId: brand.logoFileId || null,
        logoPath,
        logoUrl:
          logoPath && normalizedBase ? `${normalizedBase}${logoPath}` : null,
      },
      onboarding: settings.data.onboarding,
      offers: settings.data.offers,
      mobileAccess: settings.data.mobileAccess,
      meta: {
        version: 1,
        updatedAt: settings.meta.updatedAtBySection?.brand ?? null,
        onboardingUpdatedAt:
          settings.meta.updatedAtBySection?.onboarding ?? null,
        offersUpdatedAt: settings.meta.updatedAtBySection?.offers ?? null,
        mobileAccessUpdatedAt:
          settings.meta.updatedAtBySection?.mobileAccess ?? null,
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

    const row = await this.upsertSection(
      this.prisma,
      section,
      next,
      actorUserId,
    );
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
    const snapshot = (await this.getSettings())
      .data as unknown as Prisma.InputJsonValue;
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
    const requestedLimit = query.limit && query.limit > 0 ? query.limit : 20;
    const limit = Math.min(requestedLimit, 100);
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

  // ============= Departments Management =============
  async listDepartments(query: any) {
    const activeOnly = query.activeOnly === true;
    const search = query.search
      ? String(query.search).trim().toLowerCase()
      : '';
    const limit = Math.min(
      query.limit ? Math.max(1, Number(query.limit)) : 50,
      500,
    );

    const departments = await this.prisma.department.findMany({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        staffMembers: {
          where: { isActive: true },
          select: {
            id: true,
            userId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return {
      data: departments,
      meta: { count: departments.length, limit },
    };
  }

  async createDepartment(dto: any, actorUserId?: string | null) {
    const existingName = await this.prisma.department.findUnique({
      where: { name: dto.name },
    });
    if (existingName) {
      throw new BadRequestException(
        `Department with name "${dto.name}" already exists`,
      );
    }

    const existingCode = await this.prisma.department.findUnique({
      where: { code: dto.code },
    });
    if (existingCode) {
      throw new BadRequestException(
        `Department with code "${dto.code}" already exists`,
      );
    }

    const created = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description ? dto.description.trim() : null,
        isActive: true,
      },
      include: {
        staffMembers: {
          where: { isActive: true },
          select: { id: true, userId: true },
        },
      },
    });

    return {
      success: true,
      data: created,
    };
  }

  async updateDepartment(id: string, dto: any, actorUserId?: string | null) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (dto.name && dto.name !== dept.name) {
      const existing = await this.prisma.department.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(
          `Department with name "${dto.name}" already exists`,
        );
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ? dto.description.trim() : null }
          : {}),
        ...(typeof dto.isActive === 'boolean'
          ? { isActive: dto.isActive }
          : {}),
      },
      include: {
        staffMembers: {
          where: { isActive: true },
          select: { id: true, userId: true },
        },
      },
    });

    return {
      success: true,
      data: updated,
    };
  }

  async deleteDepartment(id: string, actorUserId?: string | null) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { staffMembers: { where: { isActive: true } } },
    });

    if (!dept) {
      throw new NotFoundException('Department not found');
    }

    if (dept.staffMembers.length > 0) {
      throw new BadRequestException(
        `Cannot delete department with ${dept.staffMembers.length} active staff members. Please reassign them first.`,
      );
    }

    await this.prisma.department.delete({ where: { id } });

    return {
      success: true,
      message: 'Department deleted',
    };
  }

  // ============= System Users Management =============
  async listSystemUsers(query: any) {
    const activeOnly = query.activeOnly === true;
    const search = query.search
      ? String(query.search).trim().toLowerCase()
      : '';
    const limit = Math.min(
      query.limit ? Math.max(1, Number(query.limit)) : 50,
      500,
    );
    const offset = query.offset ? Math.max(0, Number(query.offset)) : 0;

    const [users, total] = await Promise.all([
      this.prisma.admin.findMany({
        where: {
          ...(activeOnly ? { isActive: true } : {}),
          ...(search
            ? {
                OR: [
                  { email: { contains: search, mode: 'insensitive' } },
                  {
                    firstName: { contains: search, mode: 'insensitive' },
                  } as any,
                  {
                    lastName: { contains: search, mode: 'insensitive' },
                  } as any,
                ],
              }
            : {}),
        },
        select: {
          id: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          role: { select: { id: true, name: true } },
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.admin.count({
        where: {
          ...(activeOnly ? { isActive: true } : {}),
          ...(search
            ? {
                OR: [
                  { email: { contains: search, mode: 'insensitive' } } as any,
                  {
                    firstName: { contains: search, mode: 'insensitive' },
                  } as any,
                  {
                    lastName: { contains: search, mode: 'insensitive' },
                  } as any,
                ],
              }
            : {}),
        },
      }),
    ]);

    return {
      data: users,
      meta: { count: users.length, total, limit, offset },
    };
  }

  async createSystemUser(dto: any, actorUserId?: string | null) {
    const existing = await this.prisma.admin.findFirst({
      where: { user: { email: dto.email } },
    });
    if (existing) {
      throw new BadRequestException(
        `User with email "${dto.email}" already exists`,
      );
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException('Invalid roleId');
      }
    }

    // TODO: Hash password using bcrypt in production
    const created = await this.prisma.admin.create({
      data: {
        user: {
          create: {
            email: dto.email.trim().toLowerCase(),
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            password: dto.password, // In production, use bcrypt.hash()
          },
        },
        roleId: dto.roleId || null,
        isActive: dto.isActive !== false,
      },
      select: {
        id: true,
        user: { select: { email: true, firstName: true, lastName: true } },
        role: { select: { id: true, name: true } },
        isActive: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: {
        ...created,
        email: created.user.email,
        firstName: created.user.firstName,
        lastName: created.user.lastName,
      },
    };
  }

  async updateSystemUser(id: string, dto: any, actorUserId?: string | null) {
    const user = await this.prisma.admin.findUnique({
      where: { id },
      select: { id: true, roleId: true, user: { select: { id: true } } },
    });
    if (!user) {
      throw new NotFoundException('System user not found');
    }

    if (dto.roleId && dto.roleId !== user.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
      });
      if (!role) {
        throw new BadRequestException('Invalid roleId');
      }
    }

    const userUpdateData: Record<string, any> = {};
    if (dto.firstName) userUpdateData.firstName = dto.firstName.trim();
    if (dto.lastName) userUpdateData.lastName = dto.lastName.trim();

    const updated = await this.prisma.admin.update({
      where: { id },
      data: {
        ...(Object.keys(userUpdateData).length > 0
          ? {
              user: {
                update: userUpdateData,
              },
            }
          : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(typeof dto.isActive === 'boolean'
          ? { isActive: dto.isActive }
          : {}),
      },
      select: {
        id: true,
        user: { select: { email: true, firstName: true, lastName: true } },
        role: { select: { id: true, name: true } },
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: {
        ...updated,
        email: updated.user.email,
        firstName: updated.user.firstName,
        lastName: updated.user.lastName,
      },
    };
  }

  async deactivateSystemUser(id: string, actorUserId?: string | null) {
    const user = await this.prisma.admin.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('System user not found');
    }

    if (id === actorUserId) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data: {},
      select: { id: true, user: { select: { email: true } } },
    });

    return {
      success: true,
      data: { id: updated.id, email: updated.user.email },
    };
  }

  // ============= Roles & Permissions Management =============
  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        permissions: {
          select: { permission: true },
        },
        admins: { select: { id: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      data: roles.map((role) => ({
        ...role,
        permissionCodes: role.permissions.map((p) => p.permission),
      })),
    };
  }

  async createRole(dto: any, actorUserId?: string | null) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `Role with name "${dto.name}" already exists`,
      );
    }

    const permissionCodes = Array.isArray(dto.permissionCodes)
      ? dto.permissionCodes
      : [];

    const created = await this.prisma.role.create({
      data: {
        name: dto.name.trim(),
        description: dto.description ? dto.description.trim() : null,
        permissions: {
          create: permissionCodes.map((code: string) => ({
            permission: code,
          })),
        },
      },
      include: {
        permissions: { select: { permission: true } },
      },
    });

    return {
      success: true,
      data: {
        ...created,
        permissionCodes: created.permissions.map((p) => p.permission),
      },
    };
  }

  async updateRole(id: string, dto: any, actorUserId?: string | null) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissionCodes = Array.isArray(dto.permissionCodes)
      ? dto.permissionCodes
      : [];

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ? dto.description.trim() : null }
          : {}),
        ...(permissionCodes.length > 0
          ? {
              permissions: {
                deleteMany: { roleId: id },
                create: permissionCodes.map((code: string) => ({
                  permission: code,
                })),
              },
            }
          : {}),
      },
      include: {
        permissions: { select: { permission: true } },
      },
    });

    return {
      success: true,
      data: {
        ...updated,
        permissionCodes: updated.permissions.map((p) => p.permission),
      },
    };
  }

  async deleteRole(id: string, actorUserId?: string | null) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        users: {
          select: { userId: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.users.length > 0) {
      throw new BadRequestException(
        `Cannot delete role with ${role.users.length} assigned users. Please reassign them first.`,
      );
    }

    await this.prisma.role.delete({ where: { id } });

    return {
      success: true,
      message: 'Role deleted',
    };
  }

  async listPermissions() {
    // Get all available permissions from the system
    // This would typically be defined in a permissions configuration
    const allPermissions = [
      // Admin permissions
      {
        code: 'admin.view',
        module: 'admin',
        description: 'View admin settings',
      },
      {
        code: 'admin.update',
        module: 'admin',
        description: 'Update admin settings',
      },
      {
        code: 'admin.delete',
        module: 'admin',
        description: 'Delete admin resources',
      },

      // User permissions
      { code: 'user.view', module: 'users', description: 'View users' },
      { code: 'user.create', module: 'users', description: 'Create users' },
      { code: 'user.update', module: 'users', description: 'Update users' },
      { code: 'user.delete', module: 'users', description: 'Delete users' },

      // Dashboard permissions
      {
        code: 'dashboard.view',
        module: 'dashboard',
        description: 'View dashboard',
      },
      {
        code: 'dashboard.export',
        module: 'dashboard',
        description: 'Export dashboard data',
      },

      // Reports permissions
      { code: 'reports.view', module: 'reports', description: 'View reports' },
      {
        code: 'reports.create',
        module: 'reports',
        description: 'Create reports',
      },
      {
        code: 'reports.schedule',
        module: 'reports',
        description: 'Schedule reports',
      },

      // Communities permissions
      {
        code: 'communities.view',
        module: 'communities',
        description: 'View communities',
      },
      {
        code: 'communities.manage',
        module: 'communities',
        description: 'Manage communities',
      },
    ];

    return {
      data: allPermissions,
      groupedByModule: allPermissions.reduce(
        (acc, p) => {
          const key = p.module;
          if (!acc[key]) acc[key] = [];
          acc[key].push(p);
          return acc;
        },
        {} as Record<string, typeof allPermissions>,
      ),
    };
  }
}
