# Violations Module (`src/modules/violations`)

## What this module is responsible for

The Violations module tracks community rule violations and their financial consequences:

- Staff issue violations for a unit (optionally targeting a resident user).
- Evidence attachments can be linked via the shared `Attachment` table.
- When a violation has a non-zero fine, a fine invoice is generated automatically.
- Staff can update a violation’s status / appeal notes.
- Staff can cancel/delete a violation (with safety checks for paid invoices).

## Key data model concepts (Prisma)

Primary models involved (see `prisma/schema.prisma`):

- `Violation`
  - `residentId` is the **target user** (`User.id`) and is optional.
  - `issuedById` is the issuer (`User.id`) and is optional.
  - `fineAmount` is stored on the violation and also becomes an invoice amount (if > 0).
  - `status`: `PENDING | PAID | APPEALED | CANCELLED` (see enum in schema).
- `Invoice`
  - A fine invoice is generated using `InvoicesService.generateInvoice(...)`.
  - The schema only supports linking a single `violationId` to an invoice.
- `Attachment`
  - Evidence attachments are stored as:
    - `entity = 'VIOLATION'`
    - `entityId = <violation.id>`
    - `fileId = <uploaded File.id>`
- `File`
  - Upload via File module (typically `POST /files/upload/service-attachment`).

## Authentication / authorization

All routes are guarded by:

- `JwtAuthGuard` (JWT required).
- `PermissionsGuard` using `@Permissions(...)` metadata.

Row-level rule for “own” access:

- `GET /violations/:id` with `violation.view_own` is restricted to `Violation.residentId === req.user.id`.

## API surface (controller)

Base route: `/violations`

- `POST /violations` (permissions: `violation.issue`)
- `GET /violations` (permissions: `violation.view_all`) **paginated**
- `GET /violations/:id` (permissions: `violation.view_own` OR `violation.view_all`)
- `PATCH /violations/:id` (permissions: `violation.update`)
- `DELETE /violations/:id` (permissions: `violation.cancel`)

## Flow 1: Issue a violation (`POST /violations`)

Key behavior:

- `issuedById` is derived from the JWT (`req.user.id`). Clients should omit it.
- A sequential violation number is generated: `VIO-00001`, `VIO-00002`, ...
- Attachments:
  - If `attachmentIds` are provided, `Attachment` rows are created with `entity='VIOLATION'`.
- Fine invoice:
  - If `fineAmount > 0`, an invoice of type `FINE` is created and linked to the violation.

## Flow 2: List violations (`GET /violations`)

This endpoint is paginated via the shared `paginate(...)` utility and supports:

- Pagination: `page`, `limit`
- Sorting: `sortBy`, `sortOrder`
- Search: `search` across `violationNumber`, `type`, `description`
- Filters:
  - `status`, `unitId`, `residentId`, `issuedById`
  - `createdAtFrom`, `createdAtTo` (date range)

Includes:

- `unit` (unitNumber/projectName)
- `resident` (nameEN/email)
- `issuedBy` (nameEN)
- `invoices` (id/status/invoiceNumber)

## Flow 3: Get violation by id (`GET /violations/:id`)

- Staff with `violation.view_all` can read any violation.
- Users with `violation.view_own` can only read violations where they are the target (`residentId`).

## Flow 4: Update violation (`PATCH /violations/:id`)

Current implementation updates only:

- `status`
- `appealStatus`

Other fields in the DTO are ignored by the service update to prevent accidental mutation of core violation fields.

## Flow 5: Cancel/delete violation (`DELETE /violations/:id`)

Rules:

- If the linked invoice is `PAID`, deletion is blocked.
- Otherwise, the linked invoice is deleted (if present) and the violation is deleted in a transaction.

## Relevant code entry points

- `src/modules/violations/violations.controller.ts`
- `src/modules/violations/violations.service.ts`
- `src/modules/violations/dto/*.ts`

