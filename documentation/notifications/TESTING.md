# Notifications Module - Postman Testing Guide

This file is meant to be used as a practical testing checklist for `src/modules/notifications`.

## Postman environment variables

Recommended variables:

- `baseUrl` (example: `http://localhost:3000`)
- `adminToken`
- `userToken`
- `userId` (User.id)
- `unitId`

## 0) Prerequisites

- SMTP env vars configured if you want to verify actual EMAIL delivery:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`

## 1) Send a notification to specific users (IN_APP + EMAIL)

`POST {{baseUrl}}/notifications`

Headers:

- `Authorization: Bearer {{adminToken}}`

Body:

```json
{
  "type": "ANNOUNCEMENT",
  "title": "Test Announcement",
  "messageEn": "Hello from admin",
  "channels": ["IN_APP", "EMAIL"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": { "userIds": ["{{userId}}"] }
}
```

Expected:

- `201/200` with `{ "notificationId": "..." }`
- `NotificationLog` rows created:
  - IN_APP: `DELIVERED`
  - EMAIL: `PENDING` then becomes `SENT` or `FAILED` asynchronously

## 2) Send a scheduled notification

Same endpoint, but include `scheduledAt` in the future:

```json
{
  "type": "ANNOUNCEMENT",
  "title": "Scheduled Test",
  "messageEn": "This is scheduled",
  "channels": ["IN_APP"],
  "targetAudience": "SPECIFIC_RESIDENCES",
  "audienceMeta": { "userIds": ["{{userId}}"] },
  "scheduledAt": "2026-12-31T23:59:00.000Z"
}
```

Expected:

- Notification created with `status=SCHEDULED`.
- After scheduler time, it is dispatched.

## 3) Fetch my notifications

`GET {{baseUrl}}/notifications/me?page=1&limit=20`

Headers:

- `Authorization: Bearer {{userToken}}`

Expected:

- Paginated response with `data` and `meta`.

## 4) Mark notification as read

`PATCH {{baseUrl}}/notifications/<notificationId>/read`

Headers:

- `Authorization: Bearer {{userToken}}`

Expected:

- `{ "success": true }`
- Corresponding IN_APP log becomes `READ`.

## 5) Admin list all notifications

`GET {{baseUrl}}/notifications/admin/all?page=1&limit=20`

Headers:

- `Authorization: Bearer {{adminToken}}`

Expected:

- Paginated list including `sender` and `logs`.

## 6) Admin resend failed EMAIL logs

`POST {{baseUrl}}/notifications/admin/resend/<notificationId>`

Headers:

- `Authorization: Bearer {{adminToken}}`

Expected:

- A summary like:
  - `attempted`, `sent`, `failed`
- Only EMAIL logs with `status=FAILED` are retried.

