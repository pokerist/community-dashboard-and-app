import { Injectable, Logger } from '@nestjs/common';
import { IntegrationConfigService } from '../../system-settings/integration-config.service';

type SendSmsInput = {
  to: string;
  body: string;
};

@Injectable()
export class SmsProviderService {
  private readonly logger = new Logger(SmsProviderService.name);
  constructor(
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  private get config() {
    return {
      sid: process.env.TWILIO_ACCOUNT_SID?.trim(),
      token: process.env.TWILIO_AUTH_TOKEN?.trim(),
      from: process.env.TWILIO_PHONE_NUMBER?.trim(),
      mockMode:
        (process.env.TWILIO_MOCK_MODE ?? '').trim().toLowerCase() === 'true',
    };
  }

  isConfigured(): boolean {
    const cfg = this.config;
    return Boolean(cfg.sid && cfg.token && cfg.from);
  }

  getStatus() {
    const cfg = this.config;
    return {
      provider: 'twilio',
      configured: this.isConfigured(),
      mockMode: cfg.mockMode || !this.isConfigured(),
      from: cfg.from ?? null,
      accountSidLast4: cfg.sid ? cfg.sid.slice(-4) : null,
    };
  }

  async sendSms(input: SendSmsInput): Promise<Record<string, unknown>> {
    const runtime = await this.integrationConfigService.getResolvedIntegrations();
    const cfg = {
      sid: runtime.smsOtp.accountSid,
      token: runtime.smsOtp.authToken,
      from: runtime.smsOtp.fromNumber,
      enabled: runtime.smsOtp.enabled,
      configured: runtime.smsOtp.configured,
      mockMode:
        (process.env.TWILIO_MOCK_MODE ?? '').trim().toLowerCase() === 'true',
    };
    const useMock = cfg.mockMode || !cfg.enabled || !cfg.configured;

    if (useMock) {
      this.logger.log(`[TWILIO:MOCK] SMS to ${input.to}`);
      return {
        provider: 'twilio',
        mock: true,
        to: input.to,
        sid: `mock-sms-${Date.now()}`,
      };
    }

    const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString('base64');
    const form = new URLSearchParams();
    form.set('To', input.to);
    form.set('From', cfg.from!);
    form.set('Body', input.body);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );

    const rawText = await response.text();
    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = { raw: rawText };
    }

    if (!response.ok) {
      const message =
        parsed?.message ||
        `Twilio request failed with status ${response.status}`;
      throw new Error(message);
    }

    return {
      provider: 'twilio',
      mock: false,
      sid: parsed?.sid ?? null,
      status: parsed?.status ?? null,
      to: parsed?.to ?? input.to,
    };
  }
}
