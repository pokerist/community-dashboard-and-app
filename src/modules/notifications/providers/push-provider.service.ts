import { Injectable, Logger } from '@nestjs/common';
import { createSign } from 'crypto';
import { IntegrationConfigService } from '../../system-settings/integration-config.service';

type SendPushInput = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

type FcmServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

@Injectable()
export class PushProviderService {
  private readonly logger = new Logger(PushProviderService.name);
  private accessTokenCache:
    | { token: string; expiresAtEpochMs: number }
    | null = null;

  constructor(
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  private getServiceAccount(): FcmServiceAccount | null {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key ?? '').replace(/\\n/g, '\n'),
        };
      } catch (error) {
        this.logger.warn(
          `Failed to parse FCM_SERVICE_ACCOUNT_JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const projectId = process.env.FCM_PROJECT_ID?.trim();
    const clientEmail = process.env.FCM_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) return null;

    return { projectId, clientEmail, privateKey };
  }

  isConfigured(): boolean {
    return !!this.getServiceAccount();
  }

  private isMockMode(): boolean {
    const explicit = (process.env.FCM_MOCK_MODE ?? '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return !this.isConfigured();
  }

  getStatus() {
    const sa = this.getServiceAccount();
    return {
      provider: 'fcm',
      configured: !!sa,
      mockMode: this.isMockMode(),
      projectId: sa?.projectId ?? null,
      clientEmail: sa?.clientEmail ?? null,
    };
  }

  async sendPush(input: SendPushInput): Promise<Record<string, unknown>> {
    const runtime = await this.integrationConfigService.getResolvedIntegrations();
    const runtimeSa = this.getServiceAccountFromRuntime(runtime.fcm);
    const explicitMock = (process.env.FCM_MOCK_MODE ?? '').trim().toLowerCase();
    const useMock =
      explicitMock === 'true' ||
      !runtime.fcm.enabled ||
      !runtime.fcm.configured;

    if (useMock) {
      this.logger.log(`[FCM:MOCK] Push to token=${input.token.slice(0, 12)}...`);
      return {
        provider: 'fcm',
        mock: true,
        messageId: `mock-fcm-${Date.now()}`,
      };
    }

    const sa = runtimeSa ?? this.getServiceAccount();
    if (!sa) {
      throw new Error('FCM provider is not configured');
    }

    const accessToken = await this.getGoogleAccessToken(sa);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: input.token,
            notification: {
              title: input.title,
              body: input.body,
            },
            data: input.data,
          },
        }),
      },
    );

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok) {
      const errMessage =
        parsed?.error?.message ||
        parsed?.error?.status ||
        `FCM request failed with status ${response.status}`;
      throw new Error(errMessage);
    }

    return {
      provider: 'fcm',
      mock: false,
      messageId: parsed?.name ?? null,
    };
  }

  private async getGoogleAccessToken(sa: FcmServiceAccount): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      this.accessTokenCache &&
      this.accessTokenCache.expiresAtEpochMs > Date.now() + 60_000
    ) {
      return this.accessTokenCache.token;
    }

    const header = this.base64UrlEncode(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    );
    const claimSet = this.base64UrlEncode(
      JSON.stringify({
        iss: sa.clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: nowSec,
        exp: nowSec + 3600,
      }),
    );

    const unsignedJwt = `${header}.${claimSet}`;
    const signer = createSign('RSA-SHA256');
    signer.update(unsignedJwt);
    signer.end();
    const signature = signer.sign(sa.privateKey);
    const assertion = `${unsignedJwt}.${this.base64UrlEncode(signature)}`;

    const form = new URLSearchParams();
    form.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    form.set('assertion', assertion);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok || !parsed?.access_token) {
      throw new Error(
        parsed?.error_description ||
          parsed?.error ||
          `Failed to obtain Google OAuth token (${response.status})`,
      );
    }

    this.accessTokenCache = {
      token: parsed.access_token,
      expiresAtEpochMs: Date.now() + Number(parsed.expires_in ?? 3600) * 1000,
    };

    return this.accessTokenCache.token;
  }

  private base64UrlEncode(input: string | Buffer): string {
    return Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private getServiceAccountFromRuntime(fcm: {
    serviceAccountJson?: string;
    projectId?: string;
    clientEmail?: string;
    privateKey?: string;
  }): FcmServiceAccount | null {
    const raw = String(fcm.serviceAccountJson ?? '').trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: String(parsed.private_key ?? '').replace(/\\n/g, '\n'),
        };
      } catch (error) {
        this.logger.warn(
          `Failed to parse runtime FCM service account JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const projectId = String(fcm.projectId ?? '').trim();
    const clientEmail = String(fcm.clientEmail ?? '').trim();
    const privateKey = String(fcm.privateKey ?? '').replace(/\\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) return null;
    return { projectId, clientEmail, privateKey };
  }
}
