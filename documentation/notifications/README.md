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

1. **NotificationsService**: Core business logic for creating notifications, resolving recipients, and emitting events
2. **NotificationsController**: REST API endpoints for notification management
3. **NotificationDeliveryListener**: Event-driven handler for processing notification delivery asynchronously
4. **EmailService**: Provider-agnostic email delivery service using Nodemailer
5. **NotificationListener**: Event-driven handlers for business events that trigger notifications
6. **Channel Providers**: Abstractions for different communication channels (future extensions)

### Database Entities

- **Notification**: Main notification record with metadata, targeting, and status
- **NotificationLog**: Delivery tracking per recipient and channel

### Enums

- **NotificationType**: ANNOUNCEMENT, PAYMENT_REMINDER, MAINTENANCE_ALERT, EVENT_NOTIFICATION, EMERGENCY_ALERT
- **Channel**: IN_APP, EMAIL, SMS, PUSH
- **Audience**: ALL, SPECIFIC_RESIDENCES, SPECIFIC_UNITS, SPECIFIC_BLOCKS
- **NotificationStatus**: PENDING, SENT, FAILED, READ
- **NotificationLogStatus**: SENT, FAILED, DELIVERED, READ

### Notification Creation vs Delivery Responsibilities

#### Notification Creation (Synchronous)
- **Responsible**: `NotificationsService.sendNotification()`
- **Creates**: Notification record with PENDING status
- **Resolves**: Recipients based on audience targeting
- **Creates**: Initial notification logs for all recipient/channel combinations
- **Emits**: `notification.created` event for async delivery
- **Returns**: notificationId immediately (fast HTTP response)

#### Notification Delivery (Asynchronous)
- **Responsible**: `NotificationDeliveryListener.handleNotificationCreated()`
- **Triggered by**: `notification.created` event
- **Processes**: Each channel asynchronously (non-blocking)
- **Updates**: Notification status to SENT/FAILED
- **Updates**: Log status and provider responses
- **Handles**: Email sending via EmailService

#### Event Flow
1. Controller calls `sendNotification()` → Creates record, emits event
2. HTTP response returns immediately with notificationId
3. `NotificationDeliveryListener` processes event asynchronously
4. EmailService sends emails, updates logs and status

#### Failure Handling
- **Creation failures**: Synchronous, return error to controller
- **Delivery failures**: Asynchronous, update status to FAILED, persist error details
- **Partial failures**: If some channels fail, overall status is FAILED
- **Retries**: TODO - implement retry mechanism for transient failures

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

## Testing Guide

This section provides comprehensive testing steps for the new Notification Delivery Layer implementation.

### Prerequisites

1. **Database Setup**
   ```bash
   # Ensure database is running and migrations are applied
   npm run prisma:migrate
   npm run prisma:generate
   ```

2. **Environment Variables**
   ```env
   # Add to .env for email testing
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-test-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=noreply@alkarma.com
   ```

3. **Test Data**
   ```bash
   # Seed test users with email addresses
   npm run prisma:seed
   ```

### Manual Testing Steps

#### 1. Test Notification Creation (Synchronous)

**Objective**: Verify notification is created instantly and event is emitted.

**Steps**:
1. Start the application:
   ```bash
   npm run start:dev
   ```

2. Send a notification via API:
   ```bash
   curl -X POST http://localhost:3000/notifications \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "ANNOUNCEMENT",
       "title": "Test Notification",
       "messageEn": "This is a test message",
       "channels": ["IN_APP", "EMAIL"],
       "targetAudience": "SPECIFIC_RESIDENCES",
       "audienceMeta": {"userIds": ["test-user-id"]}
     }'
   ```

3. **Expected Results**:
   - ✅ HTTP response returns immediately with `notificationId`
   - ✅ Response time < 100ms
   - ✅ Database shows notification with `status: "PENDING"`
   - ✅ Notification logs created for each channel

#### 2. Test Asynchronous Delivery

**Objective**: Verify delivery happens asynchronously without blocking.

**Steps**:
1. Monitor application logs for delivery processing
2. Check database for status updates after ~2-3 seconds

**Expected Results**:
- ✅ Logs show: `"Processing delivery for notification ${id}"`
- ✅ Email sent successfully (check email inbox)
- ✅ Database notification `status` updated to `"SENT"`
- ✅ Notification logs updated with delivery details

#### 3. Test Email Delivery

**Objective**: Verify email sending functionality.

**Steps**:
1. Send notification with EMAIL channel
2. Check recipient's email inbox
3. Verify email content and formatting

**Expected Results**:
- ✅ Email received with correct subject and content
- ✅ HTML formatting preserved
- ✅ Sender shows as configured FROM_EMAIL
- ✅ Bilingual content (English + Arabic if provided)

#### 4. Test Status Lifecycle

**Objective**: Verify status transitions work correctly.

**Test Cases**:

**Successful Delivery**:
- Create notification → Status: PENDING
- After delivery → Status: SENT

**Failed Delivery**:
- Remove SMTP credentials temporarily
- Create notification → Status: PENDING
- After delivery attempt → Status: FAILED
- Check providerResponse contains error details

**Partial Failure**:
- Send to user with email + user without email
- Status should be FAILED (since some deliveries failed)

#### 5. Test Error Handling

**Objective**: Verify graceful error handling.

**Steps**:
1. **Invalid SMTP credentials**:
   - Set wrong SMTP_PASS
   - Send notification
   - Verify status becomes FAILED
   - Check error details in logs

2. **User without email**:
   - Send to user with null email
   - Verify EMAIL channel fails gracefully
   - Other channels still work

3. **Event emission failure**:
   - Temporarily disable event emitter
   - Verify notification still created but not delivered

#### 6. Test Integration with Existing Flows

**Objective**: Ensure existing event-triggered notifications still work.

**Steps**:
1. Trigger business event (e.g., create invoice)
2. Verify notification is created automatically
3. Check delivery processing

**Expected Results**:
- ✅ Event listeners still trigger notifications
- ✅ Delivery layer processes them asynchronously
- ✅ No breaking changes to existing functionality

### Automated Testing

#### Unit Tests

Create test files for each component:

**notifications.service.spec.ts**
```typescript
describe('NotificationsService', () => {
  it('should create notification and emit event', async () => {
    // Test notification creation
    // Test event emission
    // Verify no direct email sending
  });

  it('should resolve recipients correctly', async () => {
    // Test audience resolution logic
  });
});
```

**email.service.spec.ts**
```typescript
describe('EmailService', () => {
    it('should send email successfully', async () => {
      // Mock nodemailer
      // Test email sending
      // Verify transporter configuration
    });

    it('should handle send failures', async () => {
      // Test error scenarios
      // Verify proper error throwing
    });
});
```

**notification-delivery.listener.spec.ts**
```typescript
describe('NotificationDeliveryListener', () => {
  it('should process notification.created event', async () => {
    // Test event handling
    // Mock email service
    // Verify status updates
  });

  it('should handle delivery failures', async () => {
    // Test error scenarios
    // Verify FAILED status
    // Check error persistence
  });
});
```

#### Integration Tests

**notification-delivery.e2e-spec.ts**
```typescript
describe('Notification Delivery (e2e)', () => {
  it('should create and deliver notification end-to-end', async () => {
    // Create notification via API
    // Wait for async processing
    // Verify email sent
    // Check database state
  });

  it('should handle delivery failures gracefully', async () => {
    // Simulate email failure
    // Verify notification still exists
    // Check error handling
  });
});
```

#### E2E Test Commands

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e

# Run with coverage
npm run test:cov
```

### Performance Testing

#### Load Testing

**Objective**: Verify async delivery doesn't impact performance.

**Steps**:
1. Send 100 notifications simultaneously
2. Measure response times
3. Monitor memory usage
4. Check delivery processing time

**Expected Results**:
- ✅ All HTTP responses < 200ms
- ✅ No memory leaks
- ✅ Delivery processes in background without blocking

#### Database Performance

**Steps**:
1. Create notifications for large audience (1000+ users)
2. Monitor query performance
3. Check log creation efficiency

### Monitoring and Debugging

#### Logs to Monitor

**Application Logs**:
```
Processing delivery for notification xxx
Email sent successfully to user@domain.com
Delivery completed for notification xxx with status SENT
```

**Database Queries**:
```sql
-- Check notification status
SELECT id, status, sentAt FROM Notification WHERE id = 'xxx';

-- Check delivery logs
SELECT channel, recipient, status, providerResponse
FROM NotificationLog WHERE notificationId = 'xxx';
```

#### Common Issues and Solutions

**Event not processed**:
- Check EventEmitter2 is properly injected
- Verify event listener is registered in module

**Email not sent**:
- Verify SMTP credentials
- Check network connectivity
- Review email service logs

**Status not updated**:
- Check database transactions
- Verify listener has proper permissions
- Review error handling in listener

### Testing Checklist

- [ ] Notification creation returns immediately
- [ ] Event emission works
- [ ] Async delivery processes correctly
- [ ] Email sending with proper content
- [ ] Status transitions (PENDING → SENT/FAILED)
- [ ] Error handling and persistence
- [ ] Integration with existing event triggers
- [ ] Performance under load
- [ ] Database efficiency
- [ ] No breaking changes to existing API

This testing guide ensures the Notification Delivery Layer works reliably and maintains system performance while providing the requested asynchronous, event-driven delivery mechanism.

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
