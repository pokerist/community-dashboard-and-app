import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../prisma/prisma.service';

export type IntegrationProviderKey = 'smtp' | 'smsOtp' | 'fcm' | 's3';

type TestResult = {
  status: 'NOT_TESTED' | 'PASS' | 'FAIL';
  message: string;
  checkedAt: string | null;
  latencyMs: number | null;
};

type SystemIntegrationsState = {
  version: number;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    lastTest: TestResult | null;
  };
  smsOtp: {
    enabled: boolean;
    provider: 'FIREBASE_AUTH';
    firebaseProjectId: string;
    lastTest: TestResult | null;
  };
  fcm: {
    enabled: boolean;
    serviceAccountJson: string;
    projectId: string;
    clientEmail: string;
    privateKey: string;
    lastTest: TestResult | null;
  };
  s3: {
    enabled: boolean;
    provider: 'LOCAL' | 'S3' | 'SUPABASE';
    bucket: string;
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    lastTest: TestResult | null;
  };
};

type ResolvedIntegrationsState = SystemIntegrationsState & {
  smtp: SystemIntegrationsState['smtp'] & { configured: boolean };
  smsOtp: SystemIntegrationsState['smsOtp'] & { configured: boolean };
  fcm: SystemIntegrationsState['fcm'] & { configured: boolean };
  s3: SystemIntegrationsState['s3'] & { configured: boolean };
};

type IntegrationCapabilities = {
  push: boolean;
  smsOtp: boolean;
  smtpMail: boolean;
  s3Storage: boolean;
};

type SmsOtpDiagnostics = {
  ready: boolean;
  reasonCode:
    | 'READY'
    | 'FIREBASE_AUTH_DISABLED'
    | 'FIREBASE_SERVICE_ACCOUNT_JSON_INVALID'
    | 'FIREBASE_CREDENTIALS_INCOMPLETE';
  smsOtpEnabled: boolean;
  smsOtpConfigured: boolean;
  fcmConfigured: boolean;
};

type RawIntegrationsMetadata = {
  hasIntegrationsRow: boolean;
  hasExplicitSmsOtpEnabled: boolean;
};

type PrismaLikeClient = PrismaService | Prisma.TransactionClient;

const INTEGRATIONS_SECTION = 'integrations';
const CACHE_TTL_MS = 60_000;
const ENCRYPTED_PREFIX = 'enc:v1:';

@Injectable()
export class IntegrationConfigService {
  private readonly logger = new Logger(IntegrationConfigService.name);

  private cache:
    | {
        expiresAt: number;
        raw: SystemIntegrationsState;
        resolved: ResolvedIntegrationsState;
        rawMeta: RawIntegrationsMetadata;
      }
    | null = null;
  private lastRawMeta: RawIntegrationsMetadata = {
    hasIntegrationsRow: false,
    hasExplicitSmsOtpEnabled: false,
  };

  private readonly defaults: SystemIntegrationsState = {
    version: 1,
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      fromEmail: '',
      fromName: '',
      lastTest: null,
    },
    smsOtp: {
      enabled: false,
      provider: 'FIREBASE_AUTH',
      firebaseProjectId: '',
      lastTest: null,
    },
    fcm: {
      enabled: false,
      serviceAccountJson: '',
      projectId: '',
      clientEmail: '',
      privateKey: '',
      lastTest: null,
    },
    s3: {
      enabled: false,
      provider: 'LOCAL',
      bucket: '',
      region: '',
      endpoint: '',
      accessKeyId: '',
      secretAccessKey: '',
      forcePathStyle: true,
      supabaseUrl: '',
      supabaseServiceRoleKey: '',
      lastTest: null,
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  invalidateCache() {
    this.cache = null;
  }

  async getMobileCapabilities(): Promise<IntegrationCapabilities> {
    const resolved = await this.getResolvedIntegrations();
    return {
      push: resolved.fcm.enabled && resolved.fcm.configured,
      smsOtp: resolved.smsOtp.enabled && resolved.smsOtp.configured,
      smtpMail: resolved.smtp.enabled && resolved.smtp.configured,
      s3Storage:
        resolved.s3.enabled &&
        resolved.s3.provider === 'S3' &&
        resolved.s3.configured,
    };
  }

  async getAdminIntegrations() {
    const resolved = await this.getResolvedIntegrations();
    const capabilities = await this.getMobileCapabilities();
    return {
      data: {
        version: resolved.version,
        smtp: {
          ...resolved.smtp,
          password: this.maskSecret(resolved.smtp.password),
        },
        smsOtp: {
          ...resolved.smsOtp,
        },
        fcm: {
          ...resolved.fcm,
          serviceAccountJson: this.maskSecret(resolved.fcm.serviceAccountJson),
          privateKey: this.maskSecret(resolved.fcm.privateKey),
        },
        s3: {
          ...resolved.s3,
          secretAccessKey: this.maskSecret(resolved.s3.secretAccessKey),
          supabaseServiceRoleKey: this.maskSecret(
            resolved.s3.supabaseServiceRoleKey,
          ),
        },
      },
      meta: {
        capabilities,
        cacheTtlMs: CACHE_TTL_MS,
      },
    };
  }

  async getResolvedIntegrations(forceRefresh = false): Promise<ResolvedIntegrationsState> {
    const now = Date.now();
    if (!forceRefresh && this.cache && this.cache.expiresAt > now) {
      return this.cache.resolved;
    }

    const raw = await this.getRawState(forceRefresh);
    const resolved = this.resolveWithEnvFallback(raw);
    this.cache = {
      raw,
      resolved,
      rawMeta: this.lastRawMeta,
      expiresAt: now + CACHE_TTL_MS,
    };
    return resolved;
  }

  async getSmsOtpDiagnostics(): Promise<SmsOtpDiagnostics> {
    const resolved = await this.getResolvedIntegrations();
    return this.buildSmsOtpDiagnostics(resolved);
  }

  async updateProvider(
    provider: string,
    patch: Record<string, unknown>,
    actorUserId?: string | null,
  ) {
    const key = this.normalizeProvider(provider);
    const raw = await this.getRawState(true);
    const next = this.applyProviderPatch(raw, key, patch);
    this.validateRaw(next);

    const encrypted = this.encryptSensitive(next);
    await this.upsertRaw(this.prisma, encrypted, actorUserId);
    this.invalidateCache();

    const resolved = await this.getResolvedIntegrations(true);
    return {
      provider: key,
      data: this.maskProviderSecrets(key, resolved[key]),
    };
  }

  async testProvider(
    provider: string,
    overrides: Record<string, unknown> = {},
  ) {
    const key = this.normalizeProvider(provider);
    const raw = await this.getRawState(true);
    const candidate = this.resolveWithEnvFallback(
      this.applyProviderPatch(raw, key, overrides),
    );

    const startedAt = Date.now();
    let result: TestResult;

    try {
      switch (key) {
        case 'smtp':
          result = await this.testSmtp(candidate.smtp);
          break;
        case 'smsOtp':
          result = await this.testSms(candidate.smsOtp);
          break;
        case 'fcm':
          result = await this.testFcm(candidate.fcm);
          break;
        case 's3':
          result = await this.testStorage(candidate.s3);
          break;
        default:
          throw new ServiceUnavailableException('Unsupported provider');
      }
    } catch (error) {
      result = {
        status: 'FAIL',
        message: error instanceof Error ? error.message : 'Test failed',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      };
    }

    const withTest = this.applyProviderPatch(raw, key, {
      lastTest: result,
    }) as SystemIntegrationsState;
    await this.upsertRaw(this.prisma, this.encryptSensitive(withTest), null);
    this.invalidateCache();

    return {
      provider: key,
      ...result,
    };
  }

  async getStorageRuntimeConfig() {
    const resolved = await this.getResolvedIntegrations();
    return resolved.s3;
  }

  private normalizeProvider(provider: string): IntegrationProviderKey {
    const normalized = String(provider ?? '').trim();
    if (
      normalized === 'smtp' ||
      normalized === 'smsOtp' ||
      normalized === 'fcm' ||
      normalized === 's3'
    ) {
      return normalized;
    }
    throw new BadRequestException(
      'Unsupported provider. Allowed: smtp, smsOtp, fcm, s3',
    );
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private mergeRaw(
    current: SystemIntegrationsState,
    incoming: Partial<SystemIntegrationsState>,
  ): SystemIntegrationsState {
    return {
      version: Number(incoming.version ?? current.version ?? 1),
      smtp: {
        ...current.smtp,
        ...(incoming.smtp ?? {}),
      },
      smsOtp: {
        ...current.smsOtp,
        ...(incoming.smsOtp ?? {}),
      },
      fcm: {
        ...current.fcm,
        ...(incoming.fcm ?? {}),
      },
      s3: {
        ...current.s3,
        ...(incoming.s3 ?? {}),
      },
    };
  }

  private decodeState(raw: unknown): SystemIntegrationsState {
    if (!this.isObject(raw)) return this.defaults;
    const merged = this.mergeRaw(this.defaults, raw as Partial<SystemIntegrationsState>);
    return this.decryptSensitive(merged);
  }

  private async getRawState(forceRefresh = false): Promise<SystemIntegrationsState> {
    const now = Date.now();
    if (!forceRefresh && this.cache && this.cache.expiresAt > now) {
      this.lastRawMeta = this.cache.rawMeta;
      return this.cache.raw;
    }

    const row = await this.prisma.systemSetting.findUnique({
      where: { section: INTEGRATIONS_SECTION },
    });
    this.lastRawMeta = this.extractRawMetadata(row?.value);
    return this.decodeState(row?.value);
  }

  private async upsertRaw(
    client: PrismaLikeClient,
    raw: SystemIntegrationsState,
    actorUserId?: string | null,
  ) {
    const payload = raw as unknown as Prisma.InputJsonValue;
    await client.systemSetting.upsert({
      where: { section: INTEGRATIONS_SECTION },
      create: {
        section: INTEGRATIONS_SECTION,
        value: payload,
        updatedById: actorUserId ?? null,
      },
      update: {
        value: payload,
        updatedById: actorUserId ?? null,
      },
    });
  }

  private readEnvBool(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (typeof raw !== 'string') return fallback;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return fallback;
  }

  private readOptionalEnvBool(name: string): boolean | null {
    const raw = process.env[name];
    if (typeof raw !== 'string') return null;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    return null;
  }

  private readEnvNumber(name: string, fallback: number): number {
    const raw = Number(process.env[name]);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  }

  private resolveWithEnvFallback(
    raw: SystemIntegrationsState,
  ): ResolvedIntegrationsState {
    const smtp = {
      ...raw.smtp,
      host: raw.smtp.host || process.env.SMTP_HOST || '',
      port: Number(raw.smtp.port || this.readEnvNumber('SMTP_PORT', 587)),
      secure:
        raw.smtp.secure ??
        this.readEnvBool(
          'SMTP_SECURE',
          Number(raw.smtp.port || this.readEnvNumber('SMTP_PORT', 587)) === 465,
        ),
      username: raw.smtp.username || process.env.SMTP_USER || '',
      password: raw.smtp.password || process.env.SMTP_PASS || '',
      fromEmail: raw.smtp.fromEmail || process.env.FROM_EMAIL || '',
      fromName: raw.smtp.fromName || process.env.FROM_NAME || '',
    };
    const smtpConfigured = Boolean(
      smtp.host &&
        smtp.port &&
        smtp.username &&
        smtp.password &&
        smtp.fromEmail,
    );

    const fcm = {
      ...raw.fcm,
      serviceAccountJson:
        raw.fcm.serviceAccountJson || process.env.FCM_SERVICE_ACCOUNT_JSON || '',
      projectId: raw.fcm.projectId || process.env.FCM_PROJECT_ID || '',
      clientEmail: raw.fcm.clientEmail || process.env.FCM_CLIENT_EMAIL || '',
      privateKey:
        (raw.fcm.privateKey || process.env.FCM_PRIVATE_KEY || '').replace(
          /\\n/g,
          '\n',
        ),
    };
    const fcmConfigured = this.isFcmConfigValid(fcm);

    const smsOtp = {
      ...raw.smsOtp,
      provider: 'FIREBASE_AUTH' as const,
      firebaseProjectId:
        raw.smsOtp.firebaseProjectId || fcm.projectId || process.env.FCM_PROJECT_ID || '',
      enabled: this.resolveSmsOtpEnabled(raw, fcmConfigured),
    };
    const smsConfigured = fcmConfigured;

    const s3 = {
      ...raw.s3,
      provider: (raw.s3.provider || process.env.STORAGE_PROVIDER || 'LOCAL')
        .toString()
        .toUpperCase() as 'LOCAL' | 'S3' | 'SUPABASE',
      bucket: raw.s3.bucket || process.env.S3_BUCKET || '',
      region: raw.s3.region || process.env.S3_REGION || '',
      endpoint: raw.s3.endpoint || process.env.S3_ENDPOINT || '',
      accessKeyId: raw.s3.accessKeyId || process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey:
        raw.s3.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle:
        raw.s3.forcePathStyle ??
        this.readEnvBool('S3_FORCE_PATH_STYLE', true),
      supabaseUrl: raw.s3.supabaseUrl || process.env.SUPABASE_URL || '',
      supabaseServiceRoleKey:
        raw.s3.supabaseServiceRoleKey ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        '',
    };

    const s3Configured =
      s3.provider === 'LOCAL'
        ? true
        : s3.provider === 'SUPABASE'
          ? Boolean(s3.supabaseUrl && s3.supabaseServiceRoleKey)
          : Boolean(
              s3.bucket && s3.region && s3.accessKeyId && s3.secretAccessKey,
            );

    return {
      version: raw.version || 1,
      smtp: { ...smtp, configured: smtpConfigured },
      smsOtp: { ...smsOtp, configured: smsConfigured },
      fcm: { ...fcm, configured: fcmConfigured },
      s3: { ...s3, configured: s3Configured },
    };
  }

  private resolveSmsOtpEnabled(
    raw: SystemIntegrationsState,
    fcmConfigured: boolean,
  ): boolean {
    const envOverride = this.readOptionalEnvBool('SMS_OTP_ENABLED');
    if (envOverride !== null) return envOverride;
    if (this.lastRawMeta.hasExplicitSmsOtpEnabled) {
      return raw.smsOtp.enabled;
    }
    // Auto-enable Firebase OTP from valid FCM env/config when no explicit DB override exists.
    return raw.smsOtp.enabled || fcmConfigured;
  }

  private extractRawMetadata(value: unknown): RawIntegrationsMetadata {
    if (!this.isObject(value)) {
      return {
        hasIntegrationsRow: false,
        hasExplicitSmsOtpEnabled: false,
      };
    }
    const smsOtpValue = (value as Record<string, unknown>).smsOtp;
    const smsOtpEnabledExplicit =
      this.isObject(smsOtpValue) &&
      Object.prototype.hasOwnProperty.call(smsOtpValue, 'enabled');
    return {
      hasIntegrationsRow: true,
      hasExplicitSmsOtpEnabled: smsOtpEnabledExplicit,
    };
  }

  private buildSmsOtpDiagnostics(
    resolved: ResolvedIntegrationsState,
  ): SmsOtpDiagnostics {
    const diagnostics: SmsOtpDiagnostics = {
      ready: false,
      reasonCode: 'FIREBASE_CREDENTIALS_INCOMPLETE',
      smsOtpEnabled: resolved.smsOtp.enabled,
      smsOtpConfigured: resolved.smsOtp.configured,
      fcmConfigured: resolved.fcm.configured,
    };

    if (!resolved.smsOtp.enabled) {
      diagnostics.reasonCode = 'FIREBASE_AUTH_DISABLED';
      return diagnostics;
    }

    if (!resolved.smsOtp.configured) {
      if (resolved.fcm.serviceAccountJson) {
        try {
          JSON.parse(resolved.fcm.serviceAccountJson);
        } catch {
          diagnostics.reasonCode = 'FIREBASE_SERVICE_ACCOUNT_JSON_INVALID';
          return diagnostics;
        }
      }
      diagnostics.reasonCode = 'FIREBASE_CREDENTIALS_INCOMPLETE';
      return diagnostics;
    }

    diagnostics.ready = true;
    diagnostics.reasonCode = 'READY';
    return diagnostics;
  }

  private applyProviderPatch(
    raw: SystemIntegrationsState,
    provider: IntegrationProviderKey,
    patch: Record<string, unknown>,
  ): SystemIntegrationsState {
    const safePatch = this.isObject(patch) ? patch : {};
    const next = this.mergeRaw(raw, {});

    switch (provider) {
      case 'smtp':
        next.smtp = {
          ...next.smtp,
          ...this.pickAllowed(safePatch, [
            'enabled',
            'host',
            'port',
            'secure',
            'username',
            'password',
            'fromEmail',
            'fromName',
            'lastTest',
          ]),
        } as SystemIntegrationsState['smtp'];
        if (this.isMaskedValue(String(next.smtp.password ?? ''))) {
          next.smtp.password = raw.smtp.password;
        }
        break;
      case 'smsOtp':
        next.smsOtp = {
          ...next.smsOtp,
          ...this.pickAllowed(safePatch, [
            'enabled',
            'provider',
            'firebaseProjectId',
            'lastTest',
          ]),
          provider: 'FIREBASE_AUTH',
        } as SystemIntegrationsState['smsOtp'];
        break;
      case 'fcm':
        next.fcm = {
          ...next.fcm,
          ...this.pickAllowed(safePatch, [
            'enabled',
            'serviceAccountJson',
            'projectId',
            'clientEmail',
            'privateKey',
            'lastTest',
          ]),
        } as SystemIntegrationsState['fcm'];
        if (this.isMaskedValue(String(next.fcm.serviceAccountJson ?? ''))) {
          next.fcm.serviceAccountJson = raw.fcm.serviceAccountJson;
        }
        if (this.isMaskedValue(String(next.fcm.privateKey ?? ''))) {
          next.fcm.privateKey = raw.fcm.privateKey;
        }
        break;
      case 's3':
        next.s3 = {
          ...next.s3,
          ...this.pickAllowed(safePatch, [
            'enabled',
            'provider',
            'bucket',
            'region',
            'endpoint',
            'accessKeyId',
            'secretAccessKey',
            'forcePathStyle',
            'supabaseUrl',
            'supabaseServiceRoleKey',
            'lastTest',
          ]),
        } as SystemIntegrationsState['s3'];
        next.s3.provider = String(next.s3.provider || 'LOCAL').toUpperCase() as
          | 'LOCAL'
          | 'S3'
          | 'SUPABASE';
        if (this.isMaskedValue(String(next.s3.secretAccessKey ?? ''))) {
          next.s3.secretAccessKey = raw.s3.secretAccessKey;
        }
        if (this.isMaskedValue(String(next.s3.supabaseServiceRoleKey ?? ''))) {
          next.s3.supabaseServiceRoleKey = raw.s3.supabaseServiceRoleKey;
        }
        break;
      default:
        break;
    }

    return next;
  }

  private pickAllowed(
    source: Record<string, unknown>,
    allowed: string[],
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        out[key] = source[key];
      }
    }
    return out;
  }

  private validateRaw(raw: SystemIntegrationsState) {
    if (raw.smtp.port && (!Number.isFinite(raw.smtp.port) || raw.smtp.port <= 0)) {
      throw new BadRequestException('smtp.port must be a positive number');
    }
    if (!['LOCAL', 'S3', 'SUPABASE'].includes(raw.s3.provider)) {
      throw new BadRequestException('s3.provider must be LOCAL, S3 or SUPABASE');
    }
  }

  private getEncryptionKey(): Buffer | null {
    const secret = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
    if (!secret) return null;
    return crypto.createHash('sha256').update(secret).digest();
  }

  private encryptValue(value: string): string {
    if (!value || value.startsWith(ENCRYPTED_PREFIX)) return value;
    const key = this.getEncryptionKey();
    if (!key) return value;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptValue(value: string): string {
    if (!value || !value.startsWith(ENCRYPTED_PREFIX)) return value;
    const key = this.getEncryptionKey();
    if (!key) {
      this.logger.warn(
        'Encrypted integration value found but SETTINGS_ENCRYPTION_KEY is missing.',
      );
      return '';
    }

    try {
      const payload = value.slice(ENCRYPTED_PREFIX.length);
      const [ivB64, tagB64, dataB64] = payload.split(':');
      const iv = Buffer.from(ivB64, 'base64');
      const tag = Buffer.from(tagB64, 'base64');
      const encrypted = Buffer.from(dataB64, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
        'utf8',
      );
    } catch (error) {
      this.logger.error(
        `Failed to decrypt integration value: ${error instanceof Error ? error.message : String(error)}`,
      );
      return '';
    }
  }

  private encryptSensitive(raw: SystemIntegrationsState): SystemIntegrationsState {
    return {
      ...raw,
      smtp: {
        ...raw.smtp,
        password: this.encryptValue(raw.smtp.password),
      },
      smsOtp: {
        ...raw.smsOtp,
      },
      fcm: {
        ...raw.fcm,
        serviceAccountJson: this.encryptValue(raw.fcm.serviceAccountJson),
        privateKey: this.encryptValue(raw.fcm.privateKey),
      },
      s3: {
        ...raw.s3,
        secretAccessKey: this.encryptValue(raw.s3.secretAccessKey),
        supabaseServiceRoleKey: this.encryptValue(raw.s3.supabaseServiceRoleKey),
      },
    };
  }

  private decryptSensitive(raw: SystemIntegrationsState): SystemIntegrationsState {
    return {
      ...raw,
      smtp: {
        ...raw.smtp,
        password: this.decryptValue(raw.smtp.password),
      },
      smsOtp: {
        ...raw.smsOtp,
      },
      fcm: {
        ...raw.fcm,
        serviceAccountJson: this.decryptValue(raw.fcm.serviceAccountJson),
        privateKey: this.decryptValue(raw.fcm.privateKey),
      },
      s3: {
        ...raw.s3,
        secretAccessKey: this.decryptValue(raw.s3.secretAccessKey),
        supabaseServiceRoleKey: this.decryptValue(raw.s3.supabaseServiceRoleKey),
      },
    };
  }

  private maskSecret(value: string): string {
    if (!value) return '';
    return '********';
  }

  private maskProviderSecrets(
    provider: IntegrationProviderKey,
    providerState: any,
  ) {
    if (provider === 'smtp') {
      return {
        ...providerState,
        password: this.maskSecret(String(providerState.password ?? '')),
      };
    }
    if (provider === 'smsOtp') {
      return providerState;
    }
    if (provider === 'fcm') {
      return {
        ...providerState,
        serviceAccountJson: this.maskSecret(
          String(providerState.serviceAccountJson ?? ''),
        ),
        privateKey: this.maskSecret(String(providerState.privateKey ?? '')),
      };
    }
    return {
      ...providerState,
      secretAccessKey: this.maskSecret(
        String(providerState.secretAccessKey ?? ''),
      ),
      supabaseServiceRoleKey: this.maskSecret(
        String(providerState.supabaseServiceRoleKey ?? ''),
      ),
    };
  }

  private isMaskedValue(value: string): boolean {
    if (!value) return false;
    return /^\*{4,}$/.test(value.trim());
  }

  private isFcmConfigValid(
    fcm: Pick<
      ResolvedIntegrationsState['fcm'],
      'serviceAccountJson' | 'projectId' | 'clientEmail' | 'privateKey'
    >,
  ) {
    if (fcm.serviceAccountJson) {
      try {
        const parsed = JSON.parse(fcm.serviceAccountJson);
        return Boolean(
          parsed?.project_id && parsed?.client_email && parsed?.private_key,
        );
      } catch {
        return false;
      }
    }
    return Boolean(fcm.projectId && fcm.clientEmail && fcm.privateKey);
  }

  private async testSmtp(smtp: ResolvedIntegrationsState['smtp']): Promise<TestResult> {
    if (!smtp.configured) {
      return {
        status: 'FAIL',
        message: 'SMTP config is incomplete',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
      };
    }

    const started = Date.now();
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    await transporter.verify();

    return {
      status: 'PASS',
      message: 'SMTP connection verified successfully',
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
  }

  private async testSms(
    smsOtp: ResolvedIntegrationsState['smsOtp'],
  ): Promise<TestResult> {
    if (!smsOtp.configured) {
      return {
        status: 'FAIL',
        message: 'Firebase OTP config is incomplete',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
      };
    }
    return {
      status: 'PASS',
      message:
        'Firebase Auth OTP verification is ready (using FCM service account settings).',
      checkedAt: new Date().toISOString(),
      latencyMs: 1,
    };
  }

  private async testFcm(
    fcm: ResolvedIntegrationsState['fcm'],
  ): Promise<TestResult> {
    if (!fcm.configured) {
      return {
        status: 'FAIL',
        message: 'FCM config is incomplete or invalid',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
      };
    }
    return {
      status: 'PASS',
      message:
        'FCM config looks valid. Token delivery can be tested from notifications center.',
      checkedAt: new Date().toISOString(),
      latencyMs: 1,
    };
  }

  private async testStorage(
    s3: ResolvedIntegrationsState['s3'],
  ): Promise<TestResult> {
    if (!s3.enabled || s3.provider === 'LOCAL') {
      return {
        status: 'PASS',
        message: 'Local storage fallback is active',
        checkedAt: new Date().toISOString(),
        latencyMs: 1,
      };
    }
    if (!s3.configured) {
      return {
        status: 'FAIL',
        message: `${s3.provider} storage config is incomplete`,
        checkedAt: new Date().toISOString(),
        latencyMs: null,
      };
    }

    return {
      status: 'PASS',
      message: `${s3.provider} storage config looks valid`,
      checkedAt: new Date().toISOString(),
      latencyMs: 1,
    };
  }
}
