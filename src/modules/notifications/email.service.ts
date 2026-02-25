import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (this.isConfigured() && !this.isMockMode()) {
      // Provider-agnostic configuration - can be replaced with any email provider
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

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
      if (this.isMockMode() || !this.transporter) {
        this.logger.log(
          `[SMTP:MOCK] Email to ${recipient} | subject="${subject}"`,
        );
        return;
      }

      const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: recipient,
        subject,
        html: content,
      };

      this.logger.log(
        `[SMTP] Attempting send to ${recipient} | subject="${subject}"`,
      );

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to ${recipient}: ${info.messageId}`,
      );
    } catch (error: unknown) {
      this.logger.error(`Failed to send email to ${recipient}`, error as any);
      throw error;
    }
  }
}
