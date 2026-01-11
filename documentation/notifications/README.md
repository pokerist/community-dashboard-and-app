# Notifications Module

## Overview

The Notifications module provides a centralized, event-driven notification system for the Community Dashboard. It supports multiple communication channels (in-app, email, SMS, push) and dynamic audience targeting, ensuring consistent and reliable communication across all system modules.

## Key Features

- **Centralized Notification Service**: Single point of control for all notifications
- **Multi-Channel Support**: In-app, email, SMS, and push notifications
- **Dynamic Audience Resolution**: Target users by residence, units, blocks, or all users
- **Event-Driven Architecture**: Automatic notifications triggered by business events
- **Comprehensive Logging**: Track delivery status and provider responses
- **Admin Tools**: View notification statistics and resend failed messages
- **User Preferences**: Opt-out options per notification type (future enhancement)

## Architecture

### Components

1. **NotificationsService**: Core business logic for sending notifications and resolving recipients
2. **NotificationsController**: REST API endpoints for notification management
3. **NotificationListener**: Event-driven handlers for business events
4. **Channel Providers**: Abstractions for different communication channels

### Database Entities

- **Notification**: Main notification record with metadata and targeting
- **NotificationLog**: Delivery tracking per recipient and channel

### Enums

- **NotificationType**: ANNOUNCEMENT, PAYMENT_REMINDER, MAINTENANCE_ALERT, EVENT_NOTIFICATION, EMERGENCY_ALERT
- **Channel**: IN_APP, EMAIL, SMS, PUSH
- **Audience**: ALL, SPECIFIC_RESIDENCES, SPECIFIC_UNITS, SPECIFIC_BLOCKS
- **NotificationLogStatus**: SENT, FAILED, DELIVERED, READ

## API Endpoints

### POST /notifications
Send a new notification (Admin only).

**Request Body:**
```json
{
  "type": "PAYMENT_REMINDER",
  "title": "Invoice Due",
  "messageEn": "Your invoice is due",
  "channels": ["IN_APP", "EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": { "userIds": ["user-id-1"] },
  "scheduledAt": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "notificationId": "notification-uuid"
}
```

### GET /notifications
Get user's notifications with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "notification-uuid",
      "title": "Invoice Due",
      "messageEn": "Your invoice is due",
      "type": "PAYMENT_REMINDER",
      "createdAt": "2024-01-10T09:00:00Z",
      "logs": [
        {
          "status": "DELIVERED",
          "channel": "IN_APP"
        }
      ],
      "sender": {
        "nameEN": "Admin User"
      }
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

### PATCH /notifications/:id/read
Mark notification as read.

**Response:**
```json
{
  "success": true
}
```

### GET /notifications/admin/all
Get all notifications (Admin only).

### POST /notifications/admin/resend/:id
Resend failed notification (Admin only).

## Business Logic

### Audience Resolution

The system supports flexible audience targeting:

- **ALL**: All active users
- **SPECIFIC_RESIDENCES**: Explicit list of user IDs
- **SPECIFIC_UNITS**: All residents of specified units
- **SPECIFIC_BLOCKS**: All residents in specified blocks

### Channel Dispatch

Each notification is dispatched to multiple channels simultaneously:

- **IN_APP**: Stored in notification system, marked as delivered immediately
- **EMAIL**: Sent via email provider (Nodemailer placeholder)
- **SMS**: Sent via SMS provider (placeholder)
- **PUSH**: Mobile push notifications (placeholder)

### Event-Driven Triggers

Notifications are automatically triggered by business events:

#### Invoice Events
- **invoice.created**: Payment reminders for new invoices

#### Incident Events
- **incident.created**: Emergency alerts for new incidents
- **incident.resolved**: Resolution notifications

#### Booking Events
- **booking.approved**: Booking confirmations
- **booking.cancelled**: Cancellation notifications

## Security

### Permissions
- `notification.create`: Send notifications (Admin only)
- `notification.view_own`: View personal notifications
- `notification.view_all`: View all notifications (Admin)
- `notification.manage`: Resend notifications (Admin)

### Authentication
All endpoints require JWT authentication. User context is used for personal notifications.

## Integration Points

### With Other Modules
- **Invoices**: Automatic payment reminders
- **Incidents**: Emergency and resolution alerts
- **Bookings**: Confirmation and cancellation notices
- **Auth**: User permissions and context

### External Services
- **Email Provider**: SMTP or transactional email service
- **SMS Provider**: SMS gateway service
- **Push Provider**: Firebase Cloud Messaging or similar

## Configuration

### Environment Variables
```env
# Email Configuration (for future implementation)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=password

# SMS Configuration (for future implementation)
SMS_API_KEY=api-key
SMS_API_SECRET=api-secret
```

### Channel Providers

The system is designed with provider abstractions for easy integration:

```typescript
interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>;
}

interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}
```

## Performance Considerations

### Batch Processing
- Recipients are resolved in single queries
- Channel dispatch uses Promise.allSettled for parallel processing
- Rate limiting prevents system overload

### Database Optimization
- Efficient audience resolution queries
- Indexed notification logs
- Paginated API responses

### Error Handling
- Graceful failure handling per channel
- Comprehensive logging for debugging
- Retry mechanisms for transient failures

## Monitoring and Analytics

### Delivery Tracking
Each notification dispatch creates detailed logs including:
- Delivery status per recipient/channel
- Provider response data
- Timestamp and error details

### Admin Dashboard
- Notification delivery statistics
- Failure rate monitoring
- Resend capabilities for failed deliveries

## Future Enhancements

### User Preferences
Allow users to opt-out of specific notification types or channels:
- Per-user notification preferences
- Channel-specific opt-outs
- Quiet hours settings

### Advanced Scheduling
- Cron-based recurring notifications
- Time-zone aware scheduling
- A/B testing for notification content

### Rich Media
- HTML email templates
- Push notification images
- In-app notification attachments

## Testing

### Unit Tests
- NotificationService methods
- Audience resolution logic
- Channel dispatch handlers
- Event listener responses

### Integration Tests
- End-to-end notification flows
- Event-driven notification triggers
- Multi-channel delivery verification

### Performance Tests
- High-volume notification scenarios
- Database query performance
- External provider rate limiting

## Best Practices

1. **Event-Driven Design**: Keep notification logic separate from business logic
2. **Provider Abstraction**: Use interfaces for easy provider swapping
3. **Graceful Degradation**: Continue operation when channels fail
4. **Comprehensive Logging**: Track all delivery attempts and outcomes
5. **User-Centric**: Respect user preferences and time zones
6. **Performance First**: Optimize for high-volume scenarios

## Troubleshooting

### Common Issues

**High Failure Rates**
- Check provider credentials
- Verify user contact information
- Review rate limiting settings

**Slow Performance**
- Monitor database query performance
- Check external provider response times
- Review batch processing configuration

**Missing Notifications**
- Verify event emission
- Check audience resolution logic
- Review user permissions and status

This notification system provides a robust, scalable foundation for all communication needs in the Community Dashboard, ensuring residents stay informed about important events and updates.
