# Notification Delivery Layer - Testing Guide

## Quick Start Testing Commands

### 1. Setup
```bash
# Install dependencies
npm install

# Setup database
npm run prisma:migrate
npm run prisma:generate

# Start application
npm run start:dev
```

### 2. Test Notification Creation
```bash
# Send test notification
curl -X POST http://localhost:3000/notifications \
  -H "Authorization: Bearer YOUR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ANNOUNCEMENT",
    "title": "Test Delivery",
    "messageEn": "Testing async delivery",
    "channels": ["IN_APP", "EMAIL"],
    "targetAudience": "SPECIFIC_RESIDENCES",
    "audienceMeta": {"userIds": ["user-id-with-email"]}
  }'
```

### 3. Verify Results
```sql
-- Check notification status
SELECT id, status, sentAt FROM Notification ORDER BY createdAt DESC LIMIT 1;

-- Check delivery logs
SELECT channel, recipient, status, providerResponse, createdAt
FROM NotificationLog
WHERE notificationId = 'your-notification-id'
ORDER BY createdAt DESC;
```

## Test Scenarios

### ✅ Success Path
1. Send notification → Immediate response
2. Check logs: "Processing delivery for notification xxx"
3. Check email inbox
4. Verify database: status = "SENT"

### ❌ Failure Path
1. Remove SMTP credentials from .env
2. Send notification
3. Check logs: "Failed to send email to xxx"
4. Verify database: status = "FAILED", providerResponse has error

### 🔄 Status Transitions
- **PENDING** → Notification created, event emitted
- **SENT** → All deliveries successful
- **FAILED** → Any delivery failed
- **READ** → User marked as read

## Debugging Queries

```sql
-- Recent notifications with status
SELECT id, title, status, sentAt, createdAt
FROM Notification
ORDER BY createdAt DESC LIMIT 5;

-- Failed deliveries
SELECT n.title, nl.channel, nl.recipient, nl.status, nl.providerResponse
FROM Notification n
JOIN NotificationLog nl ON n.id = nl.notificationId
WHERE n.status = 'FAILED'
ORDER BY nl.createdAt DESC;

-- Delivery performance
SELECT
  COUNT(*) as total_notifications,
  AVG(EXTRACT(EPOCH FROM (sentAt - createdAt))) as avg_delivery_time_seconds
FROM Notification
WHERE status IN ('SENT', 'FAILED')
AND createdAt > NOW() - INTERVAL '1 hour';
```

## Load Testing

```bash
# Send multiple notifications
for i in {1..10}; do
  curl -X POST http://localhost:3000/notifications \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"ANNOUNCEMENT\",\"title\":\"Load Test $i\",\"messageEn\":\"Test\",\"channels\":[\"IN_APP\"],\"targetAudience\":\"ALL\"}" &
done
```

## Integration Testing

### Test with Business Events
1. Create an invoice (should trigger notification)
2. Verify notification created automatically
3. Check delivery processing in logs

### Test Scheduling
1. Send notification with `scheduledAt` in future
2. Verify notification created but not delivered immediately
3. Wait for scheduled time, check delivery

## Environment Setup for Testing

### .env Configuration
```env
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"

# Email (use test credentials)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=test@example.com
SMTP_PASS=test-password
FROM_EMAIL=noreply@test.com

# JWT (for API testing)
JWT_SECRET=test-secret-key
```

### Test User Setup
```sql
-- Insert test user with email
INSERT INTO User (id, email, nameEN, userStatus)
VALUES ('test-user-id', 'test@example.com', 'Test User', 'ACTIVE');

-- Insert test resident
INSERT INTO Resident (id, userId, nationalId)
VALUES ('test-resident-id', 'test-user-id', '123456789');
```

## Automated Test Examples

### Unit Test: Email Service
```typescript
it('should send email', async () => {
  jest.spyOn(transporter, 'sendMail').mockResolvedValue({ messageId: '123' });

  await emailService.sendEmail('Subject', 'to@example.com', '<p>Content</p>');

  expect(transporter.sendMail).toHaveBeenCalledWith({
    from: 'noreply@alkarma.com',
    to: 'to@example.com',
    subject: 'Subject',
    html: '<p>Content</p>'
  });
});
```

### E2E Test: Full Flow
```typescript
it('should create and deliver notification', async () => {
  const response = await request(app.getHttpServer())
    .post('/notifications')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      type: 'ANNOUNCEMENT',
      title: 'E2E Test',
      messageEn: 'Test message',
      channels: ['IN_APP'],
      targetAudience: 'ALL'
    });

  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('notificationId');

  // Wait for async processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Verify delivery
  const notification = await prisma.notification.findUnique({
    where: { id: response.body.notificationId }
  });
  expect(notification.status).toBe('SENT');
});
```

## Common Issues & Solutions

### Email Not Sent
- ✅ Check SMTP credentials
- ✅ Verify user has email address
- ✅ Check network connectivity
- ✅ Review transporter logs

### Event Not Processed
- ✅ Verify EventEmitter2 injection
- ✅ Check listener registration in module
- ✅ Confirm event name matches

### Status Not Updated
- ✅ Check database permissions
- ✅ Verify transaction handling
- ✅ Review error logging

### Performance Issues
- ✅ Monitor event queue
- ✅ Check database connection pool
- ✅ Review async processing

## Testing Checklist

- [ ] Fast notification creation (< 100ms response)
- [ ] Event emission without blocking
- [ ] Asynchronous email delivery
- [ ] Proper status transitions
- [ ] Error handling and persistence
- [ ] Integration with existing events
- [ ] Load testing under concurrent requests
- [ ] Database query performance
- [ ] Memory usage monitoring
- [ ] No breaking changes to existing API

## Monitoring Commands

```bash
# Monitor application logs
npm run start:dev

# Check database state
npm run prisma:studio

# Performance monitoring
# Use application metrics/logging
```

This testing guide provides everything needed to validate the Notification Delivery Layer implementation works correctly and maintains system reliability.
