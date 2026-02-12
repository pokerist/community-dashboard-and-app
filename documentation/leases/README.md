# Leases Module (`src/modules/leases`)

## What this module is responsible for

The Leases module manages tenant leasing flows for a unit:

- Create a lease (including creating or reusing a tenant user).
- List leases (all / per unit).
- Get lease details.
- Update a lease (including termination/expiry cascades when status changes).
- Delete a lease (with cascades).
- Terminate an active lease (with cascades and notification email).

This module is also a key input for “authority resolution” across the system:

- If a unit has an `ACTIVE` lease, the tenant is treated as the current authority for certain flows (e.g., family operations).

## Authentication / authorization

All Leases routes are guarded by:

- `JwtAuthGuard`: requires `Authorization: Bearer <accessToken>`.
- `PermissionsGuard`: Leases endpoints currently do not set `@Permissions(...)` metadata, so permission checks are effectively a no-op here.

Service-level authorization rules (implemented in `LeasesService`):

- Create, update, delete, add-tenant, terminate:
  - Allowed for Admin users, or the lease owner (`Lease.ownerId === requester userId`).

## Files and uploads

Endpoints support two styles:

1. Provide file IDs in JSON (upload first via File module).
2. Upload directly as `multipart/form-data` on supported Leases endpoints.

File validation:

- Allowed MIME types: `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`
- Max size: 5MB

Relevant `File.category` values:

- Contract file: `CONTRACT`
- National ID document: `NATIONAL_ID`

Note: In the controller, uploaded files are stored using `FileService.handleUpload(...)` into bucket `identity-docs`.

## API surface (controller)

Base route: `/leases`

- `POST /leases` (create lease; supports JSON or multipart)
- `GET /leases` (list all)
- `GET /leases/unit/:unitId` (list for unit)
- `GET /leases/:id` (details)
- `PATCH /leases/:id` (update)
- `DELETE /leases/:id` (delete)
- `POST /leases/:leaseId/add-tenant` (add tenant to an existing lease; supports JSON or multipart)
- `POST /leases/:leaseId/terminate` (terminate active lease)

## Data model concepts (Prisma)

The lease flow touches these models:

- `Lease` (links `unitId`, `ownerId` (User.id), `tenantId` (User.id), dates, rent/deposit, status/source).
- `Unit` (status is updated to `LEASED` when lease starts; set to `OCCUPIED` on termination/deletion/expiry cascades).
- `User` + `Resident` + `Tenant` (tenant identity is created if needed).
- `UnitAccess`:
  - Tenant access: `role=TENANT`, `source=LEASE_ASSIGNMENT`, active for lease duration.
  - Family auto access: `role=FAMILY`, `source=FAMILY_AUTO`, created for tenant family if applicable.

Important note from schema:

- `ResidentUnit` is marked as legacy for permission checks, but is still used by this module to map a tenant resident to a unit.

## Flow 1: Create lease (`POST /leases`)

### Goal
Create an `ACTIVE` lease and ensure the unit becomes tenant-occupied for the lease period.

### Inputs
DTO: `CreateLeaseDto` (`src/modules/leases/dto/create-lease.dto.ts`)

Required:

- `unitId`
- `ownerId` (see “ownerId resolution” below)
- `startDate` (Date)
- `endDate` (Date)
- `monthlyRent` (number)
- `tenantEmail`

Conditionally required (depends on whether tenant already exists):

- If tenant email does **not** exist yet:
  - `tenantName`, `tenantPhone`, `tenantNationalId` are required.
- If tenant email already exists:
  - `tenantName`, `tenantPhone`, `tenantNationalId` may be omitted.

Files:

- `contractFileId` is required (either provided in JSON or uploaded as `contractFile` multipart field).
- `nationalIdFileId` is required **unless** the tenant already exists and already has `User.nationalIdFileId` stored.

### ownerId resolution

`ownerId` should be the owner **User.id**. For backward compatibility, the service will also accept an **Owner.id** and resolve it to `Owner.userId`.

### Main validations / rules (as implemented)

- `startDate < endDate`.
- Unit must exist.
- Unit must not have `Unit.status === LEASED` (other unit statuses are not explicitly blocked).
- The owner must have active owner access on that unit:
  - `UnitAccess(role=OWNER, status=ACTIVE)` for `ownerUserId` + `unitId`.
- Contract file and national ID file must exist and match categories.
- Contract file ID cannot already be attached to another lease.
- Overlapping active lease (same unit, status `ACTIVE`, overlapping dates) is rejected.
- Tenant reuse by email:
  - If a tenant user already exists and has `nationalIdFileId`, a different `nationalIdFileId` is rejected.
  - If `tenantNationalId` is provided and already exists for a *different* user, reject.

### Side effects (as implemented)

If the tenant user does not exist:

- Create `User` (random password, bcrypt hash outside transaction).
- Create `Resident` and set `Resident.nationalId`.
- Create `Tenant` role record.

If the tenant user exists:

- Ensure tenant has a `Resident` record (create if missing).
- Update missing `nationalIdFileId` on user if needed.
- Validate/merge national ID values if provided.

Always:

- Create `Lease(status=ACTIVE, source=OWNER|COMPOUND)`.
- Expire any prior auto-family access on the unit:
  - `UnitAccess(role=FAMILY, source=FAMILY_AUTO, status=ACTIVE)` -> `EXPIRED`.
- Set `Unit.status = LEASED`.
- Create `ResidentUnit` mapping for the tenant resident to the unit (`isPrimary: false`).
- Create tenant `UnitAccess(role=TENANT, status=ACTIVE)` for lease duration.
- If tenant has active family links (`FamilyMember.status=ACTIVE`), create missing family `UnitAccess(role=FAMILY, source=FAMILY_AUTO)` records for the unit, bounded by lease dates.

Email:

- A lease welcome email is sent only if a **new** tenant user was created (avoid re-sending credentials when reusing tenants).

## Flow 2: Update lease (`PATCH /leases/:id`)

Authorization:

- Admin or lease owner.

Behavior:

- Updates lease fields as provided.
- If `status` is set to `TERMINATED` or `EXPIRED`, the service performs cascades:
  - Set `Unit.status = OCCUPIED`.
  - Expire tenant `UnitAccess(role=TENANT)` for the unit.
  - Remove tenant `ResidentUnit` mapping for the unit.
  - Outside the transaction: expire tenant family access for the unit and possibly deactivate the family if tenant has no other active leases; possibly set tenant `User.userStatus = INACTIVE` if they also own no units.

## Flow 3: Delete lease (`DELETE /leases/:id`)

Authorization:

- Admin or lease owner.

Behavior:

- Deletes the lease row.
- Sets `Unit.status = OCCUPIED`.
- Expires tenant access and removes tenant `ResidentUnit`.
- Outside the transaction: family/user deactivation cascades (same helpers as update/terminate).

## Flow 4: Add tenant to an existing lease (`POST /leases/:leaseId/add-tenant`)

This endpoint creates a new tenant user and sets `Lease.tenantId`.

Important behavior notes:

- It requires the lease to be `ACTIVE`.
- It does **not** check whether the lease already has a `tenantId` set; calling it on an already-populated lease can overwrite tenant linkage.

Side effects:

- Create tenant `User` + `Resident` + `Tenant`.
- Update `Lease.tenantId`, `tenantEmail`, `tenantNationalId`.
- Create tenant `ResidentUnit` and `UnitAccess(role=TENANT)`.
- Expire prior `FAMILY_AUTO` accesses on the unit and grant tenant family access for this unit if tenant has family links.

Email:

- Sends tenant welcome email (credentials) after success.

## Flow 5: Terminate lease (`POST /leases/:leaseId/terminate`)

Authorization:

- Admin or lease owner.

Behavior:

- Requires lease `status === ACTIVE`.
- Sets `Lease.status = TERMINATED` and updates `Lease.endDate` to termination date.
- Sets `Unit.status = OCCUPIED`.
- Expires tenant access and removes tenant `ResidentUnit`.
- Outside transaction: family/user deactivation cascades (best-effort; termination succeeds even if cascades fail).
- Sends termination email to tenant if tenant email exists.

## Relevant code entry points

- `src/modules/leases/leases.controller.ts`
- `src/modules/leases/leases.service.ts`
- `src/modules/leases/dto/create-lease.dto.ts`
- `src/modules/leases/dto/add-tenant-to-lease.dto.ts`

