import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { AccessGrantPermission, QRType } from '@prisma/client';
import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import QRCode from 'qrcode';

export type HikCentralCreateQrRequest = {
  unitId: string;
  type: QRType;
  validFrom: Date;
  validTo: Date;
  visitorName?: string;
  permissions: AccessGrantPermission[];
  gates: string[];
  notes?: string;
};

export type HikCentralCreateQrResponse = {
  qrId: string;
  qrImageBase64: string;
  raw?: unknown;
};

@Injectable()
export class HikCentralQrService {
  private readonly logger = new Logger(HikCentralQrService.name);

  async createQrCode(
    request: HikCentralCreateQrRequest,
  ): Promise<HikCentralCreateQrResponse> {
    const baseUrl = process.env.HIKCENTRAL_BASE_URL;
    const mockMode =
      (process.env.HIKCENTRAL_MOCK ?? '').toLowerCase() === 'true' || !baseUrl;

    if (mockMode) {
      const fakeQrId = `mock-${randomUUID()}`;
      const payload = [
        `QR:${fakeQrId}`,
        `UNIT:${request.unitId}`,
        `TYPE:${request.type}`,
        `VALID_TO:${dayjs(request.validTo).toISOString()}`,
      ].join('|');
      const dataUrl = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 512,
      });
      const fakeQrBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      return { qrId: fakeQrId, qrImageBase64: fakeQrBase64 };
    }

    const endpoint = process.env.HIKCENTRAL_QR_CREATE_PATH || '/qr-codes';
    const url = `${baseUrl}${endpoint}`;

    const apiKey = process.env.HIKCENTRAL_API_KEY;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          unitId: request.unitId,
          type: request.type,
          validFrom: request.validFrom.toISOString(),
          validTo: request.validTo.toISOString(),
          visitorName: request.visitorName,
          permissions: request.permissions,
          gates: request.gates,
          notes: request.notes,
        }),
      });
    } catch (err: unknown) {
      this.logger.error('HikCentral QR create request failed', err as any);
      throw new BadGatewayException('HikCentral API request failed');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(
        `HikCentral QR create failed (${response.status})`,
        text,
      );
      throw new BadGatewayException('HikCentral API failure');
    }

    let json: any;
    try {
      json = await response.json();
    } catch (err: unknown) {
      this.logger.error('HikCentral returned non-JSON response', err as any);
      throw new BadGatewayException('HikCentral returned invalid response');
    }

    const qrId = json?.qrId ?? json?.id ?? json?.data?.qrId;
    const qrImageBase64 = json?.qrImageBase64 ?? json?.data?.qrImageBase64;

    if (!qrId || !qrImageBase64) {
      this.logger.error('HikCentral response missing qrId/qrImageBase64', json);
      throw new BadGatewayException('HikCentral returned invalid QR payload');
    }

    return { qrId, qrImageBase64, raw: json };
  }
}
