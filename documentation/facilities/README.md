# Facilities Module (`src/modules/facilities`)

## What this module is responsible for

Facilities are community amenities that can be booked (Gym, Pool, etc.). This module manages:

- Facility catalog records (name, type, description, active flag).
- Slot configuration per day of week (`FacilitySlotConfig`).
- Date-specific overrides (`FacilitySlotException`) for closures/special hours.

Bookings are handled by the Bookings module.

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `Facility`
  - `isActive` controls whether the facility can be booked
  - optional pricing fields: `price`, `billingCycle`
  - limits: `maxReservationsPerDay`, `cooldownMinutes`
  - relations:
    - `slotConfig` (`FacilitySlotConfig[]`)
    - `slotExceptions` (`FacilitySlotException[]`)
    - `bookings` (`Booking[]`)
- `FacilitySlotConfig`
  - per `dayOfWeek` defines `startTime`, `endTime`, `slotDurationMinutes`, optional `slotCapacity`
- `FacilitySlotException`
  - per `date` can close the facility (`isClosed=true`) or override hours/capacity/duration for that date

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

Permissions:

- Admin/staff management:
  - `facility.create`, `facility.update`, `facility.delete`
- Community/dashboard view:
  - `facility.view_all` (see active + inactive)
  - `facility.view_own` (community view; only active facilities are returned)

## API surface (controller)

Base route: `/facilities`

- `POST /facilities` (permissions: `facility.create`)
- `GET /facilities` (permissions: `facility.view_all` OR `facility.view_own`)
- `GET /facilities/:id` (permissions: `facility.view_all` OR `facility.view_own`)
- `PATCH /facilities/:id` (permissions: `facility.update`)
- `DELETE /facilities/:id` (permissions: `facility.delete`)

## Behavior notes

- `GET /facilities`:
  - with `facility.view_all`: returns all facilities
  - with only `facility.view_own`: returns only `isActive=true` facilities
- `GET /facilities/:id`:
  - with only `facility.view_own`: returns 404 if the facility is inactive
- Delete behavior:
  - `FacilitiesService.remove` performs a soft-delete by setting `isActive=false`
  - it blocks disabling the facility if there are active bookings (`PENDING` or `APPROVED`)

## Relevant code entry points

- `src/modules/facilities/facilities.controller.ts`
- `src/modules/facilities/facilities.service.ts`
- `src/modules/facilities/dto/*.ts`

