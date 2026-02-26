# Notification Payload Contract (Admin <-> Backend <-> Mobile)

This document defines the payload keys currently used for mobile actions and deep-linking.

## Why this matters

Notifications are used for:
- personal notifications (bell)
- community updates (home feed)
- push notification tap routing
- opening specific records directly (ticket/invoice/complaint/etc.)

The contract should be stable and documented to avoid client regressions.

## Backend DTO Support

`SendNotificationDto.payload` supports:
- `payload?: Record<string, unknown>`

Payload is stored on the `Notification` record and passed to mobile clients.

## Common Payload Keys (Current)

### Routing / deep-link
- `route` (string)
  - Example: `/requests`, `/services`, `/payments`, `/complaints`, `/community-updates`
- `entityType` (string)
  - Example: `SERVICE_REQUEST`, `INVOICE`, `VIOLATION`, `BOOKING`, `COMPLAINT`, `ACCESS_QR`
- `entityId` (string / UUID)
  - Entity identifier used by mobile to auto-open details modal

### CTA / UI labels
- `openInAppLabel` (string)
  - Button label for internal route action
- `ctaLabel` / `ctaText` (string)
  - Button label for external link action
- `externalUrl` / `ctaUrl` (string)
  - External URL to open in browser

### Event metadata (optional)
- `eventKey` (string)
  - Used by mobile for classification/routing fallback in some cases

## EntityType Values Currently Used (Observed)

These are already used by backend listeners and/or admin authoring:
- `SERVICE_REQUEST`
- `INVOICE`
- `VIOLATION`
- `BOOKING`
- `COMPLAINT`
- `ACCESS_QR` (and mobile also tolerates aliases like `ACCESS_QRCODE`, `QR_CODE`)

## Route Values (Recommended Set)

To keep mobile routing stable, prefer these route values:
- `/community-updates`
- `/notifications`
- `/services`
- `/requests`
- `/payments`
- `/complaints`
- `/bookings`
- `/qr`
- `/profile`
- `/household`

The mobile app contains route normalization and aliases, but consistent authoring is preferred.

## Mobile Behavior (Current)

When a payload includes:
- `route` only → mobile opens target screen
- `route + entityType + entityId` → mobile opens target screen and auto-opens details modal (if supported)

Supported detail deep-links currently include:
- Service request ticket
- Invoice
- Violation
- Booking
- Complaint
- Access QR

## Authoring Guidance (Admin Notification Center)

### Community Update (general)
- `route=/community-updates`
- optional `externalUrl`
- optional `ctaLabel`

### Ticket-linked update
- `route=/requests` or `/services`
- `entityType=SERVICE_REQUEST`
- `entityId=<ticket-id>`

### Finance-linked update
- `route=/payments`
- `entityType=INVOICE` or `VIOLATION`
- `entityId=<id>`

## Validation Recommendations (Next Step)

Recommended future backend validation:
1. if `entityType` present, require `entityId`
2. restrict `route` to allowed values (enum)
3. normalize aliases server-side before storing
4. add payload schema version (optional)

## Example Payloads

### Community maintenance update
```json
{
  "route": "/community-updates",
  "openInAppLabel": "View Update",
  "externalUrl": "https://example.com/maintenance",
  "ctaLabel": "Read Details"
}
```

### Service request status update
```json
{
  "route": "/requests",
  "entityType": "SERVICE_REQUEST",
  "entityId": "0c5a0c24-9f95-4f2f-8e07-0fa4ec7f83e1",
  "openInAppLabel": "View Ticket"
}
```

### Violation notification
```json
{
  "route": "/payments",
  "entityType": "VIOLATION",
  "entityId": "f7f2a2de-4b92-4d33-a322-bf2f5f1f440f",
  "openInAppLabel": "View Violation"
}
```
