// src/events/listeners/notification.listener.ts

import { Injectable, Logger, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceCreatedEvent } from '../contracts/invoice-created.event';
import { IncidentCreatedEvent } from '../contracts/incident-created.event';
import { IncidentResolvedEvent } from '../contracts/incident-resolved.event';
import { BookingApprovedEvent } from '../contracts/booking-approved.event';
import { BookingCancelledEvent } from '../contracts/booking-cancelled.event';
import { ReferralCreatedEvent } from '../contracts/referral-created.event';
import { ReferralConvertedEvent } from '../contracts/referral-converted.event';
import { ViolationIssuedEvent } from '../contracts/violation-issued.event';
import { ServiceRequestCreatedEvent } from '../contracts/service-request-created.event';
import { ServiceRequestStatusChangedEvent } from '../contracts/service-request-status-changed.event';
import {
  NotificationType,
  Channel,
  Audience,
  InvoiceType,
  ServiceRequestStatus,
  ServiceCategory,
} from '@prisma/client';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
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
      const channels =
        payload.type === InvoiceType.FINE
          ? [Channel.IN_APP]
          : [Channel.IN_APP, Channel.PUSH, Channel.EMAIL];
      // Send payment reminder notification
      await this.notificationsService.sendNotification({
        type: NotificationType.PAYMENT_REMINDER,
        title: 'New Invoice Created',
        messageEn: `A new invoice of $${payload.amount} has been created for your unit. Due date: ${payload.dueDate.toDateString()}`,
        channels,
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.residentId] },
        payload: {
          route: '/payments',
          entityType: 'INVOICE',
          entityId: payload.invoiceId,
          eventKey: 'invoice.created',
          invoiceType: payload.type,
        },
      });

      this.logger.log(`Payment reminder sent for invoice ${payload.invoiceId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send notification for invoice ${payload.invoiceId}`,
        error,
      );
    }
  }

  @OnEvent('incident.created')
  async handleIncidentCreatedEvent(payload: IncidentCreatedEvent) {
    this.logger.log(`Handling incident created: ${payload.incidentNumber}`);

    try {
      // Send emergency alert to all users if high priority, otherwise to specific unit/block
      const audience =
        payload.priority === 'CRITICAL' || payload.priority === 'HIGH'
          ? Audience.ALL
          : payload.unitId
            ? Audience.SPECIFIC_UNITS
            : Audience.ALL;

      const audienceMeta =
        audience === Audience.SPECIFIC_UNITS
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

      this.logger.log(
        `Emergency alert sent for incident ${payload.incidentNumber}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send notification for incident ${payload.incidentId}`,
        error,
      );
    }
  }

  @OnEvent('incident.resolved')
  async handleIncidentResolvedEvent(payload: IncidentResolvedEvent) {
    this.logger.log(`Handling incident resolved: ${payload.incidentNumber}`);

    try {
      // Send resolution notification to affected users
      const audience = payload.unitId ? Audience.SPECIFIC_UNITS : Audience.ALL;
      const audienceMeta =
        audience === Audience.SPECIFIC_UNITS
          ? { unitIds: [payload.unitId] }
          : undefined;

      await this.notificationsService.sendNotification({
        type: NotificationType.MAINTENANCE_ALERT,
        title: 'Incident Resolved',
        messageEn: `The ${payload.type} incident (${payload.incidentNumber}) has been resolved. Response time: ${Math.floor(payload.responseTime / 60)} minutes.`,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: audience,
        audienceMeta,
      });

      this.logger.log(
        `Resolution notification sent for incident ${payload.incidentNumber}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send resolution notification for incident ${payload.incidentId}`,
        error,
      );
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
        channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.userId] },
        payload: {
          route: '/bookings',
          entityType: 'BOOKING',
          entityId: payload.bookingId,
          eventKey: 'booking.approved',
        },
      });

      this.logger.log(
        `Booking confirmation sent for booking ${payload.bookingId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send booking confirmation for booking ${payload.bookingId}`,
        error,
      );
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
        channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.userId] },
        payload: {
          route: '/bookings',
          entityType: 'BOOKING',
          entityId: payload.bookingId,
          eventKey: 'booking.cancelled',
        },
      });

      this.logger.log(
        `Booking cancellation notification sent for booking ${payload.bookingId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send booking cancellation notification for booking ${payload.bookingId}`,
        error,
      );
    }
  }

  @OnEvent('referral.created')
  async handleReferralCreatedEvent(payload: ReferralCreatedEvent) {
    this.logger.log(`Handling referral created: ${payload.referralId}`);

    try {
      // Notify referrer (confirmation)
      await this.notificationsService.sendNotification({
        type: NotificationType.EVENT_NOTIFICATION,
        title: 'Referral created',
        messageEn: `Your referral invitation for ${payload.friendFullName} (${payload.friendMobile}) has been created.`,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.referrerId] },
      });

      // If the invitee is already a user, notify them as well.
      if (payload.inviteeUserId) {
        await this.notificationsService.sendNotification({
          type: NotificationType.EVENT_NOTIFICATION,
          title: "You've been invited",
          messageEn: `${payload.referrerName} invited you to join the community.`,
          channels: [Channel.IN_APP, Channel.EMAIL],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds: [payload.inviteeUserId] },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send referral notifications for referral ${payload.referralId}`,
        error,
      );
    }
  }

  @OnEvent('referral.converted')
  async handleReferralConvertedEvent(payload: ReferralConvertedEvent) {
    this.logger.log(`Handling referral converted: ${payload.referralId}`);

    try {
      await this.notificationsService.sendNotification({
        type: NotificationType.EVENT_NOTIFICATION,
        title: 'Referral converted',
        messageEn: `${payload.convertedUserName} successfully signed up using your referral.`,
        channels: [Channel.IN_APP, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.referrerId] },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send referral converted notification for referral ${payload.referralId}`,
        error,
      );
    }
  }

  @OnEvent('violation.issued')
  async handleViolationIssuedEvent(payload: ViolationIssuedEvent) {
    this.logger.log(`Handling violation issued: ${payload.violationNumber}`);

    if (!payload.recipientUserIds || payload.recipientUserIds.length === 0) {
      this.logger.warn(
        `Violation ${payload.violationId} issued with no recipients. Skipping notification.`,
      );
      return;
    }

    try {
      await this.notificationsService.sendNotification({
        type: NotificationType.ANNOUNCEMENT,
        title: 'New violation issued',
        messageEn: `A violation (${payload.violationNumber}) has been issued: ${payload.type}. Fine amount: ${payload.fineAmount}.`,
        channels: [Channel.IN_APP, Channel.PUSH, Channel.EMAIL],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: payload.recipientUserIds },
        payload: {
          route: '/violations',
          entityType: 'VIOLATION',
          entityId: payload.violationId,
          eventKey: 'violation.issued',
          violationNumber: payload.violationNumber,
          fineAmount: payload.fineAmount,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send violation notification for violation ${payload.violationId}`,
        error,
      );
    }
  }

  @OnEvent('service_request.created')
  async handleServiceRequestCreated(payload: ServiceRequestCreatedEvent) {
    try {
      await this.notificationsService.sendNotification({
        type: NotificationType.MAINTENANCE_ALERT,
        title: 'Request submitted',
        messageEn: `Your request for ${payload.serviceName} has been submitted successfully.`,
        channels: [Channel.IN_APP],
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.createdById] },
        payload: {
          route:
            payload.serviceCategory === ServiceCategory.REQUESTS ||
            payload.serviceCategory === ServiceCategory.ADMIN
              ? '/requests'
              : '/services',
          entityType: 'SERVICE_REQUEST',
          entityId: payload.serviceRequestId,
          eventKey: 'service_request.created',
          serviceId: payload.serviceId,
          serviceCategory: payload.serviceCategory,
          status: payload.status,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send service request created notification for ${payload.serviceRequestId}`,
        error,
      );
    }

    try {
      const adminRecipients = await this.prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: {
                name: { in: ['SUPER_ADMIN', 'MANAGER'] },
              },
            },
          },
        },
        select: { id: true },
        take: 100,
      });

      const userIds = adminRecipients.map((u) => u.id).filter(Boolean);
      if (userIds.length > 0) {
        await this.notificationsService.sendNotification({
          type: NotificationType.MAINTENANCE_ALERT,
          title: 'New resident ticket submitted',
          messageEn: `${payload.serviceName} was submitted and is waiting for review.`,
          channels: [Channel.IN_APP],
          targetAudience: Audience.SPECIFIC_RESIDENCES,
          audienceMeta: { userIds },
          payload: {
            route: '/services',
            entityType: 'SERVICE_REQUEST',
            entityId: payload.serviceRequestId,
            eventKey: 'service_request.created.admin',
            serviceId: payload.serviceId,
            serviceCategory: payload.serviceCategory,
            unitId: payload.unitId,
            createdById: payload.createdById,
          },
        });
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send admin ticket notification for ${payload.serviceRequestId}`,
        error,
      );
    }
  }

  @OnEvent('service_request.status_changed')
  async handleServiceRequestStatusChanged(payload: ServiceRequestStatusChangedEvent) {
    if (payload.oldStatus === payload.newStatus) return;

    const pushStatuses = new Set<ServiceRequestStatus>([
      ServiceRequestStatus.IN_PROGRESS,
      ServiceRequestStatus.RESOLVED,
      ServiceRequestStatus.CLOSED,
    ]);

    try {
      const statusLabel = String(payload.newStatus).replace(/_/g, ' ').toLowerCase();
      const title =
        payload.newStatus === ServiceRequestStatus.IN_PROGRESS
          ? 'Request accepted'
          : payload.newStatus === ServiceRequestStatus.RESOLVED
            ? 'Request resolved'
            : payload.newStatus === ServiceRequestStatus.CLOSED
              ? 'Request closed'
              : 'Request updated';
      const channels = pushStatuses.has(payload.newStatus)
        ? [Channel.IN_APP, Channel.PUSH]
        : [Channel.IN_APP];

      await this.notificationsService.sendNotification({
        type: NotificationType.MAINTENANCE_ALERT,
        title,
        messageEn: `Your ${payload.serviceName} request is now ${statusLabel}.`,
        channels,
        targetAudience: Audience.SPECIFIC_RESIDENCES,
        audienceMeta: { userIds: [payload.createdById] },
        payload: {
          route:
            payload.serviceCategory === ServiceCategory.REQUESTS ||
            payload.serviceCategory === ServiceCategory.ADMIN
              ? '/requests'
              : '/services',
          entityType: 'SERVICE_REQUEST',
          entityId: payload.serviceRequestId,
          eventKey: 'service_request.status_changed',
          oldStatus: payload.oldStatus,
          newStatus: payload.newStatus,
          serviceId: payload.serviceId,
          serviceCategory: payload.serviceCategory,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send service request status notification for ${payload.serviceRequestId}`,
        error,
      );
    }
  }
}
