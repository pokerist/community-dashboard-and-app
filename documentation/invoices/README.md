# Invoices Module (`src/modules/invoices`)

## What this module is responsible for

This module is the billing layer for the system:

- Create invoices (manual) and generate invoices (bulk utility invoices from `UnitFee` records).
- List invoices and fetch invoice details (including invoice documents).
- Mark invoices as paid (and update linked source entities).
- Manage `UnitFee` records (fee inputs used by utility invoice generation).

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `Invoice`
  - `invoiceNumber` is generated from a DB-backed sequence (`InvoiceSequence`) and stored as a unique string (e.g. `INV-00001`).
  - `residentId` is optional and points to `User.id` (schema naming uses `residentId`).
  - Source links (optional): `violationId`, `serviceRequestId`, `complaintId`, `bookingId`, `incidentId`.
  - `documents`: attachments linked through `Attachment.invoiceId` (included in `findAll`/`findOne`).
- `UnitFee`
  - One fee input (e.g. Water/Electricity) for a `unitId` and `billingMonth`.
  - Unique constraint: `@@unique([unitId, type, billingMonth])`.
  - Optional `invoiceId` linking the fee to the generated invoice.
- `InvoiceSequence`
  - Atomic counter used to generate sequential invoice numbers.

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

Important ownership rules (enforced in the service layer):

- `GET /invoices/:id` with `invoice.view_own` allows access if:
  - `invoice.residentId === actorUserId`, OR
  - the actor has ACTIVE `UnitAccess` to `invoice.unitId`
- `GET /invoices/resident/:residentId` with `invoice.view_own` only allows `residentId === actorUserId`
- `GET /invoices/fees` with `unit_fee.view_own` only returns fees for units the actor has ACTIVE `UnitAccess` to

## API surface (controller)

Base route: `/invoices`

- `POST /invoices/generate` (permissions: `invoice.generate`)
- `GET /invoices/resident/:residentId` (permissions: `invoice.view_all` OR `invoice.view_own`)
- `GET /invoices/fees` (permissions: `unit_fee.view_all` OR `unit_fee.view_own`)
- `POST /invoices/fees` (permissions: `unit_fee.create`)
- `DELETE /invoices/fees/:id` (permissions: `unit_fee.delete`)
- `GET /invoices` (permissions: `invoice.view_all`)
- `GET /invoices/:id` (permissions: `invoice.view_all` OR `invoice.view_own`)
- `POST /invoices` (permissions: `invoice.create`)
- `PATCH /invoices/:id` (permissions: `invoice.update`)
- `POST /invoices/:id/pay` (permissions: `invoice.mark_paid`)
- `DELETE /invoices/:id` (permissions: `invoice.delete`)

## Flow: Generate monthly utility invoices (`POST /invoices/generate`)

Implementation highlights (`InvoicesService.generateMonthlyUtilityInvoices`):

1. Fetches all `UnitFee` rows for the month where `invoiceId IS NULL`.
2. Groups fees per `unitId` and sums amounts.
3. Resolves the unit's primary resident (`ResidentUnit.isPrimary = true`) to bill.
4. Calls `InvoicesService.generateInvoice({ sources: { unitFeeIds: [...] } })` which:
   - generates an invoice number in the same DB transaction
   - creates the invoice
   - links the `UnitFee` rows by setting their `invoiceId`

## Flow: Mark invoice as paid (`POST /invoices/:id/pay`)

`InvoicesService.markAsPaid`:

- Sets `status=PAID` and `paidDate=now()` inside a transaction.
- If the invoice is linked to a source entity, it updates that entity:
  - `Violation.status = PAID`
  - `ServiceRequest.status = RESOLVED`
  - `Complaint.status = RESOLVED`
  - `Booking.status = APPROVED`
  - `Incident.status = RESOLVED`

## Relevant code entry points

- `src/modules/invoices/invoices.controller.ts`
- `src/modules/invoices/invoices.service.ts`
- `src/modules/invoices/dto/*.ts`

