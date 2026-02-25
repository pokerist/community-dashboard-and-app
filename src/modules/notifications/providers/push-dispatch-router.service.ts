import { Injectable } from '@nestjs/common';
import { ExpoPushProviderService } from './expo-push-provider.service';
import { PushProviderService } from './push-provider.service';

type SendPushInput = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class PushDispatchRouterService {
  constructor(
    private readonly fcmProvider: PushProviderService,
    private readonly expoProvider: ExpoPushProviderService,
  ) {}

  getStatus() {
    return {
      router: 'auto',
      expo: this.expoProvider.getStatus(),
      fcm: this.fcmProvider.getStatus(),
    };
  }

  private isExpoToken(token: string): boolean {
    return (
      token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[')
    );
  }

  async sendPush(input: SendPushInput): Promise<Record<string, unknown>> {
    if (this.isExpoToken(input.token)) {
      return this.expoProvider.sendPush(input);
    }
    return this.fcmProvider.sendPush(input);
  }
}
