# Notifications Module (`src/modules/notifications`)

## What this module is responsible for

The Notifications module provides a centralized notification system with:

- Creating notifications (immediate or scheduled).
- Resolving recipients based on a target audience.
- Creating per-recipient per-channel delivery logs.
- Delivering EMAIL notifications asynchronously (best-effort) via an event listener.
- In-app read status tracking.
- Admin APIs to list notifications and resend **failed EMAIL** deliveries.

## Key data model concepts (Prisma)

Primary models involved (see `prisma/schema.prisma`):

- `Notification`
  - high-level notification record: audience, channels, content, schedule info, status, counts.
- `NotificationLog`
  - per-recipient per-channel delivery log (status + optional provider response payload).

## Channels and delivery behavior

Supported channels enum: `IN_APP`, `EMAIL`, `SMS`, `PUSH`.

Implementation behavior:

- `IN_APP`
  - Logs are created as `DELIVERED` immediately (meaning: visible in-app once fetched).
- `EMAIL`
  - Logs are created as `PENDING`.
  - Delivery happens asynchronously in `NotificationDeliveryListener` after `dispatchNow(...)` emits `notification.created`.
  - On success: log becomes `SENT`.
  - On failure: log becomes `FAILED` with `providerResponse.error`.
- `SMS` / `PUSH`
  - Logs are created as `PENDING`, but delivery is not implemented in this module yet.

## Audience targeting and recipient resolution

Audience enum: `ALL`, `SPECIFIC_RESIDENCES`, `SPECIFIC_UNITS`, `SPECIFIC_BLOCKS`.

Resolution rules (as implemented in `NotificationsService.resolveRecipients(...)`):

- `ALL`
  - all `User` rows where `userStatus = ACTIVE` (recipients are `User.id`).
- `SPECIFIC_RESIDENCES`
  - `audienceMeta.userIds` (recipients are `User.id`).
- `SPECIFIC_UNITS`
  - `audienceMeta.unitIds`
  - recipients are resolved via `ResidentUnit -> Resident.userId`.
- `SPECIFIC_BLOCKS`
  - `audienceMeta.blocks` (array) or `audienceMeta.block` (string)
  - units are resolved by `Unit.block IN blocks`, then recipients via `ResidentUnit -> Resident.userId`.

Important: this module uses `ResidentUnit` to resolve a user’s assigned units. `ResidentUnit` is marked legacy for permission checks in the schema, but it is still used here as a “membership mapping”.

## Notification lifecycle (immediate vs scheduled)

### Immediate
1. `POST /notifications` creates a `Notification(status=PENDING)` and then calls `dispatchNow(notificationId)`.
2. `dispatchNow(...)` resolves recipients, creates `NotificationLog` rows, then sets `Notification.status = SENT` and emits `notification.created`.
3. `NotificationDeliveryListener` handles the event and sends EMAIL (if included), updating the corresponding logs.

### Scheduled
1. `POST /notifications` creates `Notification(status=SCHEDULED, scheduledAt=...)`.
2. `NotificationScheduler` runs every minute and calls `dispatchScheduled()`.
3. Due scheduled notifications are dispatched the same way as immediate notifications.

## API surface (controller)

Base route: `/notifications`

- `POST /notifications` (permissions: `notification.create`)
- `GET /notifications/me` (permissions: `notification.view_own`)
- `PATCH /notifications/:id/read` (permissions: `notification.view_own`)

Admin:

- `GET /notifications/admin/all?page=<n>&limit=<n>` (permissions: `notification.view_all`)
  - Returns paginated `Notification[]` including `sender` and `logs`.
- `POST /notifications/admin/resend/:id` (permissions: `notification.manage`)
  - Resends **FAILED EMAIL logs only** for that notification.

## Relevant code entry points

- `src/modules/notifications/notifications.controller.ts`
- `src/modules/notifications/notifications.service.ts`
- `src/modules/notifications/notification-delivery.listener.ts`
- `src/modules/notifications/notifications.scheduler.ts`
- `src/modules/notifications/email.service.ts`

