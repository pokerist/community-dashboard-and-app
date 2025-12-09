// src/events/listeners/notification.listener.ts

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InvoiceCreatedEvent } from '../contracts/invoice-created.event';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  // This method runs whenever an 'invoice.created' event is emitted
  @OnEvent('invoice.created')
  handleInvoiceCreatedEvent(payload: InvoiceCreatedEvent) {
    this.logger.log(
      `Handling new invoice for Unit ${payload.unitId}: $${payload.amount}`,
    );

    // 1. Check if residentId exists
    if (payload.residentId) {
      // 2. Call NotificationService to send a push/email (TODO: Implement NotificationService)
      // Example: this.notificationService.sendPaymentReminder(payload.residentId, payload.invoiceId);
    } else {
      this.logger.warn(
        `Invoice ${payload.invoiceId} created without a linked resident. Skipping notification.`,
      );
    }

    // Alhaitham Rule: This listener doesn't need to know HOW the invoice was created.
  }
}
