import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { IntegrationConfigService } from '../system-settings/integration-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly integrationConfigService: IntegrationConfigService,
  ) {}

  isConfigured(): boolean {
    const resendKey = (process.env.RESEND_API_KEY ?? '').trim();
    if (resendKey) return true;

    return Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.FROM_EMAIL,
    );
  }

  isMockMode(): boolean {
    const explicit = (process.env.EMAIL_MOCK_MODE ?? '').trim().toLowerCase();
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return !this.isConfigured();
  }

  async sendEmail(
    subject: string,
    recipient: string,
    content: string,
  ): Promise<void> {
    try {
      const resendApiKey = (process.env.RESEND_API_KEY ?? '').trim();
      if (resendApiKey) {
        await this.sendWithResend(resendApiKey, subject, recipient, content);
        return;
      }

      const integrations =
        await this.integrationConfigService.getResolvedIntegrations();
      const smtp = integrations.smtp;
      const explicitMock = (process.env.EMAIL_MOCK_MODE ?? '')
        .trim()
        .toLowerCase();
      const useMock =
        explicitMock === 'true' ||
        !smtp.enabled ||
        !smtp.configured ||
        (explicitMock !== 'false' && !smtp.configured);

      if (useMock) {
        this.logger.log(
          `[SMTP:MOCK] Email to ${recipient} | subject="${subject}"`,
        );
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.username,
          pass: smtp.password,
        },
      });

      const mailOptions = {
        from: smtp.fromEmail,
        to: recipient,
        subject,
        html: content,
      };

      this.logger.log(
        `[SMTP] Attempting send to ${recipient} | subject="${subject}"`,
      );

      const info = await transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${recipient}: ${info.messageId}`,
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to send email to ${recipient}`, error as any);
      throw error;
    }
  }

  private async sendWithResend(
    apiKey: string,
    subject: string,
    recipient: string,
    content: string,
  ) {
    const fromEmail =
      (process.env.RESEND_FROM_EMAIL ?? '').trim() ||
      (process.env.FROM_EMAIL ?? '').trim() ||
      'onboarding@resend.dev';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html: content,
      }),
    });

    const raw = await response.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = { raw };
    }

    if (!response.ok) {
      const msg =
        parsed?.message ||
        parsed?.error ||
        `Resend request failed with status ${response.status}`;
      throw new Error(msg);
    }

    this.logger.log(
      `[RESEND] Email sent to ${recipient} | id=${String(parsed?.id ?? 'n/a')}`,
    );
  }
}
