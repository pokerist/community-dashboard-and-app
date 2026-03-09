# Notifications Flow

## Current Flow
1. Domain/service builds `SendNotificationDto`.
2. `NotificationsService.sendNotification` validates channels + audience.
3. Audience expansion resolves target users by `communityIds`, `phaseIds`, `clusterIds`, `unitIds` (plus legacy fallback keys).
4. `Notification` is persisted.
5. `NotificationLog` records are created per channel/recipient.
6. Delivery workers send through configured provider routers (email/sms/push) or mark as failed/mock when unavailable.
7. Aggregated counts/status are updated on notification.

## Audience Model
- Supports multi-level targeting:
  - community
  - phase
  - cluster
  - unit
- User context matching uses active unit links and derived location scopes.

## Async/Event Architecture
- Uses Nest `EventEmitter2` for event contracts.
- Notification dispatch has built-in retry/resend paths.
- Dedup window exists for rapid duplicate events.

## Known Weak Points
- NotificationsService is very large and carries multiple responsibilities (validation, expansion, delivery, stats).
- Route/payload-driven notification navigation in mobile can become brittle without strict contract tests.
- Provider config variance (mock/live) can hide integration issues until late.

## Refactor Plan
- `safe now`: split service into smaller collaborators (audience resolver, channel dispatchers, aggregation updater).
- `safe with verification`: normalize payload schema for mobile deep-link routing.
- `defer`: introducing queue infra (BullMQ/SQS) if not operationally needed yet.
- `risky/manual review`: changing notification semantics (audience meaning) without product signoff.
