# Complaints Module (`src/modules/complaints`)

## What this module is responsible for

The Complaints module handles resident-submitted complaints and the staff workflow around them:

- Residents report complaints (optionally linked to a unit).
- Staff list/search/filter all complaints.
- Staff update complaint details and status.
- Residents can delete their own complaints *only while still open* (not resolved/closed).
- Complaints can be linked to file attachments (evidence) via the shared `Attachment` table.
- There is a helper method to generate an invoice for a complaint (not exposed as an HTTP endpoint).

## Key data model concepts (Prisma)

Primary models involved (see `prisma/schema.prisma`):

- `Complaint`
  - `reporterId` (User.id) is required.
  - Optional `unitId`.
  - `status`: `NEW | IN_PROGRESS | RESOLVED | CLOSED`
  - `resolutionNotes` + `resolvedAt` are used when resolved/closed.
- `Attachment`
  - Used for complaint evidence. The service stores attachments with:
    - `entity = 'COMPLAINT'`
    - `entityId = <complaint.id>`
    - `fileId = <uploaded File.id>`
- `File`
  - Upload via File module (typically `POST /files/upload/service-attachment`).

## Authentication / authorization

All routes are guarded by:

- `JwtAuthGuard` (JWT required).
- `PermissionsGuard` using `@Permissions(...)` metadata.

Important: In addition to permissions, the module enforces row-level rules for “own” access:

- `GET /complaints/:id` with `complaint.view_own` is restricted to `Complaint.reporterId === req.user.id`.
- `DELETE /complaints/:id` with `complaint.delete_own` is restricted to `Complaint.reporterId === req.user.id`.

## API surface (controller)

Base route: `/complaints`

- `POST /complaints` (permissions: `complaint.report`)
- `GET /complaints` (permissions: `complaint.view_all`)
- `GET /complaints/:id` (permissions: `complaint.view_own` OR `complaint.view_all`)
- `PATCH /complaints/:id` (permissions: `complaint.manage`)
- `PATCH /complaints/:id/status` (permissions: `complaint.manage`)
- `DELETE /complaints/:id` (permissions: `complaint.delete_own` OR `complaint.delete_all`)

## Flow 1: Resident reports a complaint (`POST /complaints`)

Key behavior:

- `reporterId` is derived from the JWT (`req.user.id`). Clients should omit it.
- If `unitId` is provided, the reporter must have active unit access (`UnitAccess(status=ACTIVE)`), enforced via `getActiveUnitAccess(...)`.
- A sequential complaint number is generated: `CMP-00001`, `CMP-00002`, ...
- Attachments:
  - If `attachmentIds` are provided, `Attachment` rows are created with `entity='COMPLAINT'`.

## Flow 2: Staff list/search complaints (`GET /complaints`)

This endpoint is paginated via the shared `paginate(...)` utility and supports:

- Pagination: `page`, `limit`
- Sorting: `sortBy`, `sortOrder`
- Search: `search` across `complaintNumber`, `category`, `description`
- Filters:
  - `status`, `priority`, `unitId`, `reporterId`, `assignedToId`
  - `createdAtFrom`, `createdAtTo` (date range)

The list includes basic relations:

- `reporter` (nameEN/email)
- `unit` (unitNumber)
- `assignedTo` (nameEN)

## Flow 3: Staff update / resolve / close

`PATCH /complaints/:id` and `PATCH /complaints/:id/status`:

- When transitioning to `RESOLVED` or `CLOSED`, `resolutionNotes` is required.
- `resolvedAt` is set automatically when resolving/closing.

## Flow 4: Delete complaint (`DELETE /complaints/:id`)

Rules:

- Residents can only delete their own complaints (when using `complaint.delete_own`).
- Staff/admin can delete any complaint (when using `complaint.delete_all`).
- Deletion is blocked when complaint is `RESOLVED` or `CLOSED` (history preservation).

## Relevant code entry points

- `src/modules/complaints/complaints.controller.ts`
- `src/modules/complaints/complaints.service.ts`
- `src/modules/complaints/dto/*.ts`

