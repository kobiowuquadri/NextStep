import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { CONFIG, type AppConfig } from '../config.js';

/**
 * Sends transactional email when SMTP is configured. Without SMTP:
 * development logs the reset link so the flow can be tested locally;
 * production logs only that delivery is not configured (never the token).
 */
@Injectable()
export class MailerService {
  private readonly log = new Logger('Mailer');
  private readonly transport: Transporter | null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.transport = config.SMTP_HOST
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT ?? 587,
          secure: (config.SMTP_PORT ?? 587) === 465,
          auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
        })
      : null;
  }

  get configured() {
    return this.transport !== null;
  }

  async sendPasswordReset(to: string, link: string): Promise<void> {
    if (!this.transport) {
      if (this.config.NODE_ENV === 'development') this.log.warn(`SMTP not configured. Development-only reset link: ${link}`);
      else this.log.warn('Password reset requested but SMTP is not configured; no email was sent.');
      return;
    }
    await this.transport.sendMail({
      from: this.config.MAIL_FROM,
      to,
      subject: 'Reset your NextStep password',
      text: `Someone asked to reset the password for your NextStep account.\n\nIf it was you, open this link within 30 minutes:\n${link}\n\nIf it wasn't you, ignore this email — your password stays the same.`,
    });
  }
}
