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

  isConfigured(): boolean {
    return false;
  }

  getStatus() {
    return {
      provider: 'firebase_auth_only',
      configured: false,
      mockMode: true,
      from: null,
      accountSidLast4: null,
    };
  }

  async sendSms(input: SendSmsInput): Promise<Record<string, unknown>> {
    await this.integrationConfigService.getResolvedIntegrations();
    this.logger.warn(
      `SMS send requested for ${input.to}, but SMS transport is disabled (Firebase OTP only mode).`,
    );

    return {
      provider: 'firebase_auth_only',
      mock: true,
      to: input.to,
      sid: `disabled-sms-${Date.now()}`,
      status: 'SKIPPED',
      reason: 'SMS_TRANSPORT_DISABLED_USE_FIREBASE_OTP',
    };
  }
}
