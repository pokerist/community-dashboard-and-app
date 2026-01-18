# Postman Testing Guide - Notification Delivery Layer

This guide provides step-by-step instructions for testing the new Notification Delivery Layer using Postman.

## Prerequisites

### 1. Setup Environment
```bash
# Start the application
npm run start:dev

# Ensure database is ready
npm run prisma:migrate
npm run prisma:generate
```

### 2. Create Test Data
```sql
-- Insert test users in Prisma Studio or via seed
INSERT INTO "User" (id, email, "nameEN", "userStatus") VALUES
('test-user-1', 'test1@example.com', 'Test User 1', 'ACTIVE'),
('test-user-2', 'test2@example.com', 'Test User 2', 'ACTIVE'),
('test-user-no-email', NULL, 'User No Email', 'ACTIVE');
```

### 3. Get Admin JWT Token
```bash
# Login as admin to get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

## Postman Setup

### 1. Create New Collection
1. Open Postman
2. Click "New" → "Collection"
3. Name: "Notification Delivery Tests"
4. Add description: "Testing the new async notification delivery layer"

### 2. Set Environment Variables
1. Click "Environments" (left sidebar)
2. Create "Notification Testing" environment
3. Add variables:
   - `base_url`: `http://localhost:3000`
   - `admin_token`: `YOUR_JWT_TOKEN_HERE`
   - `test_user_id`: `test-user-1`
   - `notification_id`: (leave empty, will be set during tests)

## Test Cases

## Test Case 1: Basic Notification Creation (Success Path)

### Step 1: Create Notification
**Method:** POST  
**URL:** `{{base_url}}/notifications`  
**Headers:**
```
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "type": "ANNOUNCEMENT",
  "title": "Test Notification - Success",
  "messageEn": "This notification should be delivered successfully",
  "channels": ["IN_APP", "EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": {
    "userIds": ["{{test_user_id}}"]
  }
}
```

**Expected Response:**
```json
{
  "notificationId": "uuid-here"
}
```

**Response Code:** 201  
**Response Time:** < 200ms (fast creation)

### Step 2: Verify Immediate Response
- ✅ Response returns immediately
- ✅ No blocking on email sending
- ✅ Copy `notificationId` to environment variable

### Step 3: Check Database Status (via Prisma Studio)
```sql
SELECT id, title, status, sentAt, createdAt
FROM "Notification"
WHERE id = 'your-notification-id'
ORDER BY createdAt DESC LIMIT 1;
```
**Expected:** status = "PENDING"

### Step 4: Wait for Async Processing (2-3 seconds)
Monitor application logs for:
```
Processing delivery for notification xxx
Email sent successfully to test1@example.com
Delivery completed for notification xxx with status SENT
```

### Step 5: Verify Final Status
```sql
SELECT id, status, sentAt FROM "Notification" WHERE id = 'your-notification-id';
```
**Expected:** status = "SENT", sentAt has timestamp

### Step 6: Check Email Delivery Logs
```sql
SELECT channel, recipient, status, providerResponse, createdAt
FROM "NotificationLog"
WHERE notificationId = 'your-notification-id'
ORDER BY createdAt DESC;
```
**Expected:**
- IN_APP: recipient = userId, status = "DELIVERED"
- EMAIL: recipient = email, status = "SENT"

---

## Test Case 2: Email Delivery Verification

### Step 1: Send Notification with Email
**Method:** POST  
**URL:** `{{base_url}}/notifications`  

**Body:**
```json
{
  "type": "PAYMENT_REMINDER",
  "title": "Payment Due",
  "messageEn": "Your payment is due",
  "messageAr": "مستحق الدفع الخاص بك",
  "channels": ["EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": {
    "userIds": ["{{test_user_id}}"]
  }
}
```

### Step 2: Check Email Inbox
- ✅ Email received at test1@example.com
- ✅ Subject: "Payment Due"
- ✅ HTML content with both English and Arabic
- ✅ Sender: noreply@alkarma.com

### Step 3: Verify Email Log
```sql
SELECT * FROM "NotificationLog"
WHERE channel = 'EMAIL' AND notificationId = 'latest-id'
```
**Expected:** status = "SENT", recipient = "test1@example.com"

---

## Test Case 3: Error Handling - SMTP Failure

### Step 1: Temporarily Break SMTP
Update `.env`:
```
SMTP_PASS=wrong-password
```

### Step 2: Send Notification
**Method:** POST  
**URL:** `{{base_url}}/notifications`  

**Body:**
```json
{
  "type": "ANNOUNCEMENT",
  "title": "SMTP Test",
  "messageEn": "Testing SMTP failure",
  "channels": ["EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": {
    "userIds": ["{{test_user_id}}"]
  }
}
```

### Step 3: Check Logs
Application logs should show:
```
Failed to send email to test1@example.com
Delivery completed for notification xxx with status FAILED
```

### Step 4: Verify Status
```sql
SELECT status FROM "Notification" WHERE id = 'latest-id';
```
**Expected:** status = "FAILED"

### Step 5: Check Error Details
```sql
SELECT providerResponse FROM "NotificationLog"
WHERE notificationId = 'latest-id' AND status = 'FAILED';
```
**Expected:** providerResponse contains SMTP error details

---

## Test Case 4: User Without Email

### Step 1: Send to User Without Email
**Body:**
```json
{
  "type": "ANNOUNCEMENT",
  "title": "No Email Test",
  "messageEn": "Testing user without email",
  "channels": ["EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": {
    "userIds": ["test-user-no-email"]
  }
}
```

### Step 2: Check Logs
```
Failed to send email to
Delivery completed for notification xxx with status FAILED
```

### Step 3: Verify Graceful Failure
```sql
SELECT status, providerResponse FROM "NotificationLog"
WHERE notificationId = 'latest-id';
```
**Expected:** status = "FAILED", error = "No email address available"

---

## Test Case 5: Multiple Recipients

### Step 1: Send to Multiple Users
**Body:**
```json
{
  "type": "ANNOUNCEMENT",
  "title": "Multi-Recipient Test",
  "messageEn": "Testing multiple recipients",
  "channels": ["IN_APP", "EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": {
    "userIds": ["test-user-1", "test-user-2"]
  }
}
```

### Step 2: Verify Multiple Deliveries
```sql
SELECT channel, recipient, status FROM "NotificationLog"
WHERE notificationId = 'latest-id'
ORDER BY recipient;
```
**Expected:** 4 logs (2 channels × 2 users)

---

## Test Case 6: Audience Targeting - All Users

### Step 1: Send to All Users
**Body:**
```json
{
  "type": "EMERGENCY_ALERT",
  "title": "Emergency Test",
  "messageEn": "This is an emergency alert",
  "channels": ["IN_APP"],
  "targetAudience": "ALL",
  "audienceMeta": {}
}
```

### Step 2: Verify Audience Resolution
```sql
SELECT COUNT(*) as total_logs FROM "NotificationLog"
WHERE notificationId = 'latest-id';
```
**Expected:** Number of logs = number of active users × channels

---

## Test Case 7: Scheduling (Future Notifications)

### Step 1: Schedule Future Notification
**Body:**
```json
{
  "type": "EVENT_NOTIFICATION",
  "title": "Scheduled Event",
  "messageEn": "This event is scheduled",
  "channels": ["IN_APP"],
  "targetAudience": "ALL",
  "scheduledAt": "2026-12-31T23:59:59Z"
}
```

### Step 2: Verify No Immediate Delivery
```sql
SELECT status, sentAt, scheduledAt FROM "Notification"
WHERE id = 'latest-id';
```
**Expected:** status = "PENDING", sentAt = null

---

## Test Case 8: Status Checking API

### Step 1: Get User Notifications
**Method:** GET  
**URL:** `{{base_url}}/notifications`  
**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Query Params:**
- page: 1
- limit: 10

### Step 2: Verify Response Structure
```json
{
  "data": [
    {
      "id": "notification-id",
      "title": "Test Notification",
      "status": "SENT",
      "logs": [
        {
          "status": "DELIVERED",
          "channel": "IN_APP"
        }
      ]
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

## Test Case 9: Mark as Read

### Step 1: Mark Notification as Read
**Method:** PATCH  
**URL:** `{{base_url}}/notifications/{{notification_id}}/read`  
**Headers:**
```
Authorization: Bearer {{admin_token}}
```

**Expected Response:**
```json
{
  "success": true
}
```

### Step 2: Verify Status Update
```sql
SELECT status FROM "NotificationLog"
WHERE notificationId = '{{notification_id}}' AND channel = 'IN_APP';
```
**Expected:** status = "READ"

---

## Test Case 10: Load Testing

### Step 1: Create Multiple Requests
Use Postman Runner:
1. Select "Notification Delivery Tests" collection
2. Click "Run collection"
3. Set iterations: 50
4. Delay: 100ms between requests

### Step 2: Monitor Performance
- ✅ All responses < 300ms
- ✅ No application crashes
- ✅ Async processing handles load
- ✅ Database connections stable

### Step 3: Verify Delivery
```sql
SELECT status, COUNT(*) as count
FROM "Notification"
WHERE createdAt > NOW() - INTERVAL '5 minutes'
GROUP BY status;
```
**Expected:** All notifications eventually SENT or FAILED

---

## Common Issues & Solutions

### 401 Unauthorized
- ✅ Check JWT token is valid and not expired
- ✅ Verify admin has `notification.create` permission
- ✅ Ensure token format: `Bearer your-jwt-here`

### 500 Internal Server Error
- ✅ Check application logs for stack traces
- ✅ Verify database connection
- ✅ Ensure all environment variables are set

### Emails Not Sending
- ✅ Verify SMTP credentials in .env
- ✅ Check network connectivity
- ✅ Confirm FROM_EMAIL is set
- ✅ Review email service logs

### Events Not Processing
- ✅ Check EventEmitter2 is properly injected
- ✅ Verify listener is registered in NotificationsModule
- ✅ Confirm event name matches ('notification.created')

### Status Not Updating
- ✅ Check database permissions for updates
- ✅ Verify transaction handling
- ✅ Review async processing logs

## Test Automation

### Create Postman Tests
Add this to each request's "Tests" tab:

```javascript
// Set notification ID for follow-up tests
if (pm.response.code === 201) {
    const response = pm.response.json();
    pm.environment.set("notification_id", response.notificationId);
}

// Verify response time
pm.test("Response time is less than 300ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(300);
});

// Verify success status
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

// Verify notification ID returned
pm.test("Notification ID returned", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('notificationId');
});
```

## Monitoring Dashboard

### Key Metrics to Monitor
- Response times for notification creation
- Success/failure rates
- Email delivery success rate
- Event processing latency
- Database query performance

### Useful Queries
```sql
-- Delivery success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM "Notification"
WHERE createdAt > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Average delivery time
SELECT AVG(EXTRACT(EPOCH FROM (sentAt - createdAt))) as avg_seconds
FROM "Notification"
WHERE status = 'SENT' AND createdAt > NOW() - INTERVAL '1 hour';
```

This comprehensive Postman testing guide covers all aspects of the Notification Delivery Layer implementation.
