# Units Module (`src/modules/units`)

## What this module is responsible for

The Units module provides CRUD and operational APIs around `Unit` records, plus some utility endpoints that other modules depend on:

- Create/update/delete units and list them with filtering + pagination.
- Assign/remove residents to units via `ResidentUnit` (legacy mapping).
- Update a unit’s `status` and derived `isDelivered` flag.
- Fetch leases for a unit.
- Search units by partial `unitNumber`.
- Read `UnitAccess` for a user on a unit.
- Check simple feature gating based on `Unit.status`.

## Key data model concepts (Prisma)

Primary models involved (see `prisma/schema.prisma`):

- `Unit`: the property unit record. Also contains workflow-ish fields like `status` and `isDelivered`.
- `ResidentUnit`:
  - Used here to map a `Resident` to a `Unit`.
  - The schema marks it as **legacy** for permission checks, but it is still used for “who is assigned to this unit” and “who is the primary owner resident”.
- `UnitAccess`: the recommended access-control model used across the system for permissions and gating.
- `Lease`: used to fetch unit leases (Leases module).

## Authentication / authorization

All routes are guarded by:

- `JwtAuthGuard` (JWT required).
- `PermissionsGuard` using `@Permissions(...)` metadata. Units endpoints do set `@Permissions(...)`.

Important: which permissions are required per endpoint is defined in `src/modules/units/units.controller.ts`.

## API surface (controller)

Base route: `/units`

CRUD:

- `GET /units` (permissions: `unit.view_all`)
- `GET /units/:id` (permissions: `unit.view_all` OR `unit.view_own`)
- `POST /units` (permissions: `unit.create`)
- `PATCH /units/:id` (permissions: `unit.update`)
- `DELETE /units/:id` (permissions: `unit.delete`)

Assignments (legacy mapping via `ResidentUnit`):

- `POST /units/:id/assign-user` (permissions: `unit.assign_resident`)
- `DELETE /units/:id/assigned-users/:userId` (permissions: `unit.remove_resident_from_unit`)
- `GET /units/:id/residents` (permissions: `unit.view_assigned_residents`)

Status:

- `PATCH /units/:id/status` (permissions: `unit.update_status`)

Lease info:

- `GET /units/:id/leases` (permissions: `unit.view_leases`)

Search:

- `GET /units/number/:unitNumber` (permissions: `unit.view_all` OR `unit.view_own`)

Access utilities:

- `GET /units/access/:unitId/:userId` (permissions: `unit.view_all`)
- `GET /units/can-access-feature/:unitId?feature=<feature>` (permissions: `unit.view_all`)

## Flow 1: List units (`GET /units`)

Implementation notes:

- Uses a shared `paginate(...)` helper with:
  - `searchFields`: `unitNumber`, `projectName`, `block`
  - filters: `type`, `status`, `block`, `projectName`
- Includes `residents` (as `ResidentUnit` rows including `resident`) and `leases`.

## Flow 2: Assign a resident to a unit (`POST /units/:id/assign-user`)

Despite the request field being named `userId`, the relationship stored is `ResidentUnit.residentId`.

To prevent common client mistakes, the service accepts **either**:

- a `Resident.id`, or
- a `User.id` (it will resolve to the resident profile via `Resident.userId`).

Rules:

- Unit must exist.
- Resident must exist (by resident ID or user ID resolution).
- The same resident cannot be assigned to the same unit twice (`@@unique([residentId, unitId])`).
- If role is `OWNER`, the unit cannot already have a primary resident assignment (`ResidentUnit.isPrimary = true`).

What is stored:

- A `ResidentUnit` row is created with:
  - `isPrimary = true` when role is `OWNER`
  - `isPrimary = false` for `TENANT` / `FAMILY`

Important:

- This endpoint **does not** create/update `UnitAccess`. It only writes the legacy `ResidentUnit` mapping.

## Flow 3: Remove a resident assignment (`DELETE /units/:id/assigned-users/:userId`)

Same ID behavior as assignment:

- Accepts a `Resident.id` or a `User.id` and resolves to a `residentId`.

Deletes the matching `ResidentUnit` row or returns 404 if not found.

## Flow 4: Update unit status (`PATCH /units/:id/status`)

Behavior:

- Updates `Unit.status`.
- Updates `Unit.isDelivered` as:
  - `true` only when `status === DELIVERED`
  - `false` for any other status
- Emits event `unit.status.changed` (via EventEmitter) if status changed.

## Flow 5: Feature gating (`GET /units/can-access-feature/:unitId?feature=...`)

This endpoint is a simple switch on `Unit.status`:

- `add_tenant`, `add_family` => allowed only when `Unit.status === DELIVERED`
- `manage_delegates` => allowed when `Unit.status` is `DELIVERED`, `OCCUPIED`, or `LEASED`
- `view_payment_plan`, `view_announcements`, `view_overdue_checks` => always `true`
- anything else => `false`

Note: Other modules may treat `OCCUPIED` and `LEASED` as “delivered enough” for specific flows.

## Gotchas / inconsistencies to be aware of

- The controller returns `204 No Content` for some deletes, but the service returns Prisma objects (depending on Nest serialization, a body may still be present). Don’t rely on a response body for 204 endpoints.
- Unit assignments here use `ResidentUnit` (legacy) and do not grant access via `UnitAccess`. Many “real access” checks across the system use `UnitAccess`.

## Relevant code entry points

- `src/modules/units/units.controller.ts`
- `src/modules/units/units.service.ts`
- `src/modules/units/dto/*.ts`
