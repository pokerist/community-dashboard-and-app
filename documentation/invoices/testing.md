# Invoices Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) List all invoices (dashboard)

`GET {{BASE_URL}}/invoices`

Permissions required: `invoice.view_all`

Expected:

- Array of invoices ordered by `dueDate` desc.
- Each item includes `unit`, `resident` (if any), and `documents` (attachments) with `file`.

## 2) Get invoice by id (dashboard or community)

`GET {{BASE_URL}}/invoices/{{invoiceId}}`

Permissions required: `invoice.view_all` OR `invoice.view_own`

Ownership rules when using `invoice.view_own`:

- allowed if `invoice.residentId === yourUserId`
- OR allowed if you have ACTIVE `UnitAccess` to `invoice.unitId`

Test cases:

- `invoice.view_own` trying to access another user's invoice without unit access -> 403.
- unknown `invoiceId` -> 404.

## 3) List invoices for a resident (community)

`GET {{BASE_URL}}/invoices/resident/{{residentId}}`

Permissions required: `invoice.view_all` OR `invoice.view_own`

Behavior:

- With `invoice.view_all`: any `residentId` is allowed.
- With `invoice.view_own`: `residentId` must equal your authenticated `user.id` or you get 403.

## 4) Create an invoice manually (admin)

`POST {{BASE_URL}}/invoices`

Permissions required: `invoice.create`

Body example:

```json
{
  "unitId": "{{unitId}}",
  "residentId": "{{userId}}",
  "type": "MISCELLANEOUS",
  "amount": 250,
  "dueDate": "2026-03-01T00:00:00.000Z"
}
```

Expected:

- Returns created invoice with `invoiceNumber` populated (unless you provided one).

## 5) Mark invoice as paid (workflow)

`POST {{BASE_URL}}/invoices/{{invoiceId}}/pay`

Permissions required: `invoice.mark_paid`

Expected:

- Invoice updated with `status=PAID` and `paidDate` set.

Test cases:

- Paying an already-paid invoice -> 400.
- Paying a cancelled invoice -> 400.

## 6) Unit fees: list all fee records (dashboard)

`GET {{BASE_URL}}/invoices/fees`

Permissions required: `unit_fee.view_all` OR `unit_fee.view_own`

Behavior:

- With `unit_fee.view_all`: returns all `UnitFee` rows.
- With `unit_fee.view_own`: returns fees only for units you have ACTIVE `UnitAccess` to.

## 7) Unit fees: create fee record (dashboard)

`POST {{BASE_URL}}/invoices/fees`

Permissions required: `unit_fee.create`

Body example:

```json
{
  "unitId": "{{unitId}}",
  "type": "Electricity",
  "amount": 150.75,
  "billingMonth": "2026-02-01T00:00:00.000Z"
}
```

Test cases:

- Creating a duplicate fee for same `unitId/type/billingMonth` -> 409/400 depending on Prisma error mapping.

## 8) Generate monthly utility invoices (admin)

`POST {{BASE_URL}}/invoices/generate`

Permissions required: `invoice.generate`

Body example:

```json
{ "billingMonth": "2026-02-01T00:00:00.000Z" }
```

Expected:

- Returns array of newly created invoices (one per unit that had fees and a primary resident).
- Units with no primary resident are skipped (server logs a warning).

