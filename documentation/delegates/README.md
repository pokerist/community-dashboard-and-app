# Delegates Module (`src/modules/delegates`)

## What this module is responsible for

This module implements "unit delegation":

- A unit **owner** submits a **delegate access request** for a specific unit.
- The request is stored as a `UnitAccess` row with `role=DELEGATE` and `status=PENDING`.
- An **admin** approves (or an admin/owner revokes) the request.
- When revoked, access is blocked immediately across the backend because most unit-scoped flows require ACTIVE access.

Delegates represent people responsible for a unit for a period (family member, friend, interior designer).

## Key data model

Delegates are stored in the existing `UnitAccess` Prisma model:

- `role = DELEGATE`
- `delegateType`: `FAMILY | FRIEND | INTERIOR_DESIGNER`
- `status`: uses `AccessStatus` (`PENDING`, `ACTIVE`, `REVOKED`, ...)
- Validity window:
  - `startsAt` (required)
  - `endsAt` (optional)
- Permission flags:
  - `canGenerateQR` (access-control QR generation)
  - `canManageWorkers` (worker management capability; enforcement depends on worker endpoints)
  - `canViewFinancials` (fees/fines/invoices visibility)
  - `canReceiveBilling` (intended for billing notifications; currently informational)
  - `canBookFacilities` (facility booking)

Delegate identity docs:

- Delegates must have `User.nationalIdFileId` set (in practice this is usually a `File` with category `DELEGATE_ID` uploaded via the File module).

## Flow overview

### 1) Owner requests a delegate

Entry point: `DelegatesController -> DelegatesService.createDelegateRequest(...)`.

Checks:

- Unit must be in one of: `DELIVERED`, `OCCUPIED`, `LEASED`.
- Requester must have ACTIVE `UnitAccess` with `role=OWNER` for the unit.
- Delegate user must exist (current implementation requires `userId`).
- Delegate must not already have access for the same unit (`PENDING/APPROVED/ACTIVE`).
- `idFileId` must exist and be category `DELEGATE_ID` or `NATIONAL_ID`.
- `endsAt`, if provided, must be after `startsAt`.

Writes:

- Updates `User.nationalIdFileId = idFileId`.
- Creates `UnitAccess`:
  - `role=DELEGATE`
  - `status=PENDING`
  - permission flags default to:
    - `canGenerateQR=true`
    - `canManageWorkers=true`
    - `canViewFinancials=true`
    - `canReceiveBilling=false`
    - `canBookFacilities=true`

Notifications:

- Admins receive a "delegate request pending" notification (in-app + email).
- Delegate receives a "request submitted" notification (in-app + email).

### 2) Admin approves

Entry point: `DelegatesController -> DelegatesService.approveDelegate(...)`.

Checks:

- Approver must be an admin (`Admin` record exists for `userId`).
- UnitAccess must exist, be `role=DELEGATE`, and `status=PENDING`.
- Delegate user must have: `email`, `phone`, and `nationalIdFileId`.

Writes:

- Updates `UnitAccess.status` to `ACTIVE`.

Notifications:

- Delegate receives "delegate access approved" (in-app + email).

Credentials:

- If the delegate user has no `passwordHash` set, the backend generates a password-reset token and emails a “set up your account” link using the existing reset-password flow (`/auth/reset-password`).

### 3) Admin/Owner revokes

Entry point: `DelegatesController -> DelegatesService.revokeDelegate(...)`.

Checks:

- Revoker must be admin OR the unit owner.

Writes:

- Sets `UnitAccess.status=REVOKED` and `endsAt=now()`.

Notifications:

- Delegate receives "delegate access revoked" (in-app + email).

## Relationship to Workers / Contractor access

Delegates are the authority layer for "operational entry" (contractors/workers), distinct from visitors/deliveries.

When `UnitAccess.role=DELEGATE` is ACTIVE and `canManageWorkers=true`, the delegate can:

- Create contractor companies: `POST /contractors`
- Register workers for a unit: `POST /workers`
- Generate worker access QRs: `POST /workers/:id/qr`

See `documentation/workers/README.md` for the worker/contractor flow and endpoint details.

## Security notes / enforcement points

- Unit-scoped flows that depend on ACTIVE unit access should use `getActiveUnitAccess(...)`.
  - This helper enforces `startsAt/endsAt` windows (not just `status=ACTIVE`).
- Financial visibility is additionally gated by `UnitAccess.canViewFinancials`:
  - Invoices and unit-fee views require ACTIVE access **and** `canViewFinancials=true` when using the “unit access” path.

## Relevant code entry points

- `src/modules/delegates/delegates.controller.ts`
- `src/modules/delegates/delegates.service.ts`
- `src/modules/delegates/dto/*.ts`
- `src/common/utils/unit-access.util.ts`
