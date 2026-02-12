# Clubhouse Module (`src/modules/clubhouse`)

## What this module is responsible for

This module implements an approval gate for “clubhouse access”:

- A user requests clubhouse access for a specific unit.
- Admin reviews pending requests and approves/rejects them.
- Approved records are stored in `ClubhouseAccessRequest` with `status="APPROVED"`.

## How clubhouse access affects bookings

Bookings are already implemented in `src/modules/bookings`.

The backend enforces an additional rule for facilities that are treated as “clubhouse-managed”:

- If a facility has `Facility.type === MULTIPURPOSE_HALL`, then creating a booking requires an APPROVED clubhouse access request for the same `(userId, unitId)`.

This mapping is implemented in `BookingsService.createForActor(...)`.

If your project uses a different facility type/name for clubhouse, adjust the mapping in code.

## Data model

Prisma model: `ClubhouseAccessRequest`

- `userId`, `unitId`
- `status`: string (`PENDING`, `APPROVED`, `REJECTED`)
- `requestedAt`, `approvedAt`, `approvedBy`

## Flow overview

### 1) Request access (User)

Entry point: `ClubhouseController -> ClubhouseService.createAccessRequest(...)`.

Checks:

- User must have ACTIVE `UnitAccess` for the unit (date-window-aware).
- Unit must be in one of: `DELIVERED`, `OCCUPIED`, `LEASED`.
- A request must not already exist for the same `(userId, unitId)` in `PENDING` or `APPROVED`.

Writes:

- Creates `ClubhouseAccessRequest` with `status="PENDING"`.

Notifications:

- Admins receive a “pending clubhouse request” notification (in-app + email).
- Requester receives a “request submitted” notification (in-app + email).

### 2) Approve / reject (Admin)

Checks:

- Actor must be an admin (`Admin` record exists for `userId`).
- Request must exist and be `PENDING`.

Writes:

- Approve: sets `status="APPROVED"`, `approvedAt`, `approvedBy`.
- Reject: sets `status="REJECTED"`.

Notifications:

- Requester is notified on approval/rejection (in-app + email).

### 3) Booking access

When the user tries to book a “clubhouse-managed” facility (currently: `MULTIPURPOSE_HALL`), the booking endpoint will:

- Check `ClubhouseAccessRequest` has an APPROVED record for `(userId, unitId)`.
- If missing, booking fails with 403.

## Relevant code entry points

- `src/modules/clubhouse/clubhouse.controller.ts`
- `src/modules/clubhouse/clubhouse.service.ts`
- `src/modules/bookings/bookings.service.ts`
