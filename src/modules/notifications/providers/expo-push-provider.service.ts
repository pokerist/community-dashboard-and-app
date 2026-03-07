import { Injectable, Logger } from '@nestjs/common';

type SendExpoPushInput = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class ExpoPushProviderService {
  private readonly logger = new Logger(ExpoPushProviderService.name);

  private get config() {
    return {
      accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN?.trim(),
      mockMode:
        (process.env.EXPO_PUSH_MOCK_MODE ?? '').trim().toLowerCase() === 'true',
    };
  }

  isConfigured(): boolean {
    // Expo push can work without access token in many dev/demo setups.
    return true;
  }

  private isMockMode() {
    return this.config.mockMode;
  }

  getStatus() {
    const cfg = this.config;
    return {
      provider: 'expo',
      configured: true,
      mockMode: this.isMockMode(),
      hasAccessToken: Boolean(cfg.accessToken),
    };
  }

  async sendPush(input: SendExpoPushInput): Promise<Record<string, unknown>> {
    if (this.isMockMode()) {
      this.logger.log(`[EXPO:MOCK] Push to token=${input.token.slice(0, 16)}...`);
      return {
        provider: 'expo',
        mock: true,
        ticketId: `mock-expo-${Date.now()}`,
        status: 'ok',
      };
    }

    const cfg = this.config;
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(cfg.accessToken
          ? { Authorization: `Bearer ${cfg.accessToken}` }
          : {}),
      },
      body: JSON.stringify({
        to: input.token,
        title: input.title,
        body: input.body,
        data: input.data,
        sound: 'default',
      }),
    });

    const text = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      const json = text ? (JSON.parse(text) as unknown) : null;
      parsed =
        json && typeof json === 'object' && !Array.isArray(json)
          ? (json as Record<string, unknown>)
          : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok) {
      const errors = Array.isArray(parsed?.errors)
        ? (parsed.errors as unknown[])
        : [];
      const firstError =
        errors.length > 0 && errors[0] && typeof errors[0] === 'object'
          ? (errors[0] as Record<string, unknown>)
          : null;
      throw new Error(
        (firstError && typeof firstError.message === 'string'
          ? firstError.message
          : null) ||
          (parsed && typeof parsed.message === 'string' ? parsed.message : null) ||
          `Expo push request failed with status ${response.status}`,
      );
    }

    const dataValue = Array.isArray(parsed?.data)
      ? parsed.data[0]
      : parsed?.data;
    const data =
      dataValue && typeof dataValue === 'object'
        ? (dataValue as Record<string, unknown>)
        : null;
    if (
      data &&
      typeof data.status === 'string' &&
      data.status.toLowerCase() === 'error'
    ) {
      throw new Error(
        typeof data.message === 'string'
          ? data.message
          : 'Expo push ticket error',
      );
    }

    return {
      provider: 'expo',
      mock: false,
      ticketId: data?.id ?? null,
      status: data?.status ?? 'ok',
      details: data?.details ?? null,
    };
  }
}
