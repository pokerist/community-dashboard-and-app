import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PendingRegistrationApprovedEvent } from '../contracts/pending-registration-approved.event';

@Injectable()
export class PendingRegistrationApprovedListener {
  @OnEvent('pending.registration.approved')
  async handle(event: PendingRegistrationApprovedEvent) {
    // TODO: Implement side effects
    // - Send welcome email to user
    // - Send notification to admin
    // - Sync with gate access
    // - Send SMS/WhatsApp
    console.log(`Pending registration ${event.pendingId} approved by ${event.approvedBy}, user ${event.userId} created`);
  }
}