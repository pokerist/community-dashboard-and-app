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
}
