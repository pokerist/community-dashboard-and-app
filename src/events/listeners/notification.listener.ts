// src/events/listeners/notification.listener.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { InvoiceCreatedEvent } from '../contracts/invoice-created.event';
import { IncidentCreatedEvent } from '../contracts/incident-created.event';
import { IncidentResolvedEvent } from '../contracts/incident-resolved.event';
import { BookingApprovedEvent } from '../contracts/booking-approved.event';
import { BookingCancelledEvent } from '../contracts/booking-cancelled.event';
import { NotificationType, Channel, Audience } from '@prisma/client';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  // This method runs whenever an 'invoice.created' event is emitted
  @OnEvent('invoice.created')
  async handleInvoiceCreatedEvent(payload: InvoiceCreatedEvent) {
    this.logger.log(
      `Handling new invoice for Unit ${payload.unitId}: $${payload.amount}`,
    );

    // Check if residentId exists
    if (!payload.residentId) {
      this.logger.warn(
        `Invoice ${payload.invoiceId} created without a linked resident. Skipping notification.`,
      );
      return;
    }

    try {
      // Send payment reminder notification
      await this.notificationsService.sendNotification({
        type: NotificationType.PAYMENT_REMINDER,
        title: 'New Invoice Created',
        messageEn: `A new invoice of $${payload.amount} has been created for your unit. Due date: ${payload.dueDate.toDateString()}`,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.residentId] },
      });

      this.logger.log(`Payment reminder sent for invoice ${payload.invoiceId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for invoice ${payload.invoiceId}`, error);
    }
  }

  @OnEvent('incident.created')
  async handleIncidentCreatedEvent(payload: IncidentCreatedEvent) {
    this.logger.log(`Handling incident created: ${payload.incidentNumber}`);

    try {
      // Send emergency alert to all users if high priority, otherwise to specific unit/block
      const audience = payload.priority === 'CRITICAL' || payload.priority === 'HIGH'
        ? Audience.ALL
        : payload.unitId
          ? Audience.SPECIFIC_UNITS
          : Audience.ALL;

      const audienceMeta = audience === Audience.SPECIFIC_UNITS
        ? { unitIds: [payload.unitId] }
        : undefined;

      await this.notificationsService.sendNotification({
        type: NotificationType.EMERGENCY_ALERT,
        title: 'New Incident Reported',
        messageEn: `A new ${payload.type} incident has been reported${payload.unitId ? ' in your area' : ''}. Incident ID: ${payload.incidentNumber}`,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: audience,
        audienceMeta,
      });

      this.logger.log(`Emergency alert sent for incident ${payload.incidentNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send notification for incident ${payload.incidentId}`, error);
    }
  }

  @OnEvent('incident.resolved')
  async handleIncidentResolvedEvent(payload: IncidentResolvedEvent) {
    this.logger.log(`Handling incident resolved: ${payload.incidentNumber}`);

    try {
      // Send resolution notification to affected users
      const audience = payload.unitId ? Audience.SPECIFIC_UNITS : Audience.ALL;
      const audienceMeta = audience === Audience.SPECIFIC_UNITS
        ? { unitIds: [payload.unitId] }
        : undefined;

      await this.notificationsService.sendNotification({
        type: NotificationType.MAINTENANCE_ALERT,
        title: 'Incident Resolved',
        messageEn: `The ${payload.type} incident (${payload.incidentNumber}) has been resolved. Response time: ${Math.floor(payload.responseTime / 60)} minutes.`,
        channels: [Channel.IN_APP],
        targetAudience: audience,
        audienceMeta,
      });

      this.logger.log(`Resolution notification sent for incident ${payload.incidentNumber}`);
    } catch (error) {
      this.logger.error(`Failed to send resolution notification for incident ${payload.incidentId}`, error);
    }
  }

  @OnEvent('booking.approved')
  async handleBookingApprovedEvent(payload: BookingApprovedEvent) {
    this.logger.log(`Handling booking approved: ${payload.bookingId}`);

    try {
      // Send booking confirmation to the user
      await this.notificationsService.sendNotification({
        type: NotificationType.EVENT_NOTIFICATION,
        title: 'Booking Confirmed',
        messageEn: `Your booking for ${payload.facilityName} on ${payload.date.toDateString()} from ${payload.startTime} to ${payload.endTime} has been approved.`,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.userId] },
      });

      this.logger.log(`Booking confirmation sent for booking ${payload.bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation for booking ${payload.bookingId}`, error);
    }
  }

  @OnEvent('booking.cancelled')
  async handleBookingCancelledEvent(payload: BookingCancelledEvent) {
    this.logger.log(`Handling booking cancelled: ${payload.bookingId}`);

    try {
      // Send booking cancellation notification to the user
      await this.notificationsService.sendNotification({
        type: NotificationType.EVENT_NOTIFICATION,
        title: 'Booking Cancelled',
        messageEn: `Your booking for ${payload.facilityName} on ${payload.date.toDateString()} from ${payload.startTime} to ${payload.endTime} has been cancelled.`,
        channels: [Channel.IN_APP],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.userId] },
      });

      this.logger.log(`Booking cancellation notification sent for booking ${payload.bookingId}`);
    } catch (error) {
      this.logger.error(`Failed to send booking cancellation notification for booking ${payload.bookingId}`, error);
    }
  }
}
