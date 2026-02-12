# Bookings Module (`src/modules/bookings`)

## What this module is responsible for

This module manages facility reservations:

- Create a booking for a `Facility` on a date/time slot with slot validation.
- Enforce booking rules (limits, cooldown, slot capacity).
- List bookings (admin list, my bookings, by facility).
- Admin updates booking status and triggers notifications.
- User can cancel their own bookings.

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `Booking`
  - belongs to `Facility` via `facilityId`
  - belongs to `User` via `userId`
  - optional `residentId` (schema uses `Resident.id`)
  - required `date`, `startTime`, `endTime`
  - `status`: `PENDING`, `APPROVED`, `CANCELLED`, `REJECTED`, ...
  - `cancelledAt` set when user cancels

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

Ownership rules:

- `GET /bookings/:id` with only `booking.view_own` only returns bookings where `booking.userId === actorUserId`.
- `PATCH /bookings/:id/cancel` enforces `booking.userId === actorUserId`.

## API surface (controller)

Base route: `/bookings`

- `POST /bookings` (permissions: `booking.create`)
- `GET /bookings` (permissions: `booking.view_all`)
- `GET /bookings/me` (permissions: `booking.view_own`)
- `GET /bookings/:id` (permissions: `booking.view_all` OR `booking.view_own`)
- `PATCH /bookings/:id/status` (permissions: `booking.update`)
- `GET /bookings/facility/:facilityId` (permissions: `booking.view_by_facility`)
- `PATCH /bookings/:id/cancel` (permissions: `booking.cancel_own`)
- `DELETE /bookings/:id` (permissions: `booking.delete`)

## Flow: Create booking (`POST /bookings`)

Implementation notes (`BookingsService.createForActor`):

1. Requires `unitId` and checks ACTIVE `UnitAccess` for the actor (`getActiveUnitAccess`).
2. Feature gating: bookings are only available when unit status is one of:
   - `DELIVERED`, `OCCUPIED`, `LEASED`
3. Requires `UnitAccess.canBookFacilities === true`.
4. Loads facility slot rules and resolves the effective rules for the given date:
   - Exceptions override day-of-week configs.
   - Closed days reject booking creation.
5. Validates that requested time:
   - is within open/close window
   - matches slot duration exactly (if configured)
6. Enforces:
   - `maxReservationsPerDay`
   - `cooldownMinutes`
   - slot capacity (count of `PENDING`/`APPROVED` in the same slot)
7. Saves booking with:
   - `userId` from JWT (never from client input)
   - `residentId` auto-resolved from `Resident.userId` (if exists)
   - `status=PENDING`

## Flow: Status updates + notifications

When staff updates booking status (`PATCH /bookings/:id/status`):

- If status becomes `APPROVED`, emits `booking.approved`
- If status becomes `CANCELLED` or `REJECTED`, emits `booking.cancelled`

`src/events/listeners/notification.listener.ts` listens to these events and sends IN_APP + EMAIL notifications.

## Relevant code entry points

- `src/modules/bookings/bookings.controller.ts`
- `src/modules/bookings/bookings.service.ts`
- `src/modules/bookings/dto/*.ts`
- `src/events/listeners/notification.listener.ts`

