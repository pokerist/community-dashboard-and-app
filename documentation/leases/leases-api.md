# Leases API

This document covers the current behavior of the Leases module (`src/modules/leases`).

## Auth

All routes require a valid JWT (`Authorization: Bearer <token>`).

Additional service-level authorization rules:
- Creating a lease: only Admin or the specified lease owner.
- Updating a lease: only Admin or the lease owner.
- Deleting a lease: only Admin or the lease owner.
- Adding a tenant: only Admin or the lease owner.
- Terminating a lease: only Admin or the lease owner.

## File Uploads

Leases support two ways to provide files:
- Upload first via File module and pass IDs in JSON.
- Upload directly as `multipart/form-data` on supported endpoints.

File validation (leases endpoints):
- Allowed mime types: `image/jpeg`, `image/png`, `image/jpg`, `application/pdf`
- Max size: 5MB

Common file categories:
- Contract file: `CONTRACT`
- National ID document: `NATIONAL_ID`

## Endpoints

1. `POST /leases`
2. `GET /leases`
3. `GET /leases/unit/:unitId`
4. `GET /leases/:id`
5. `PATCH /leases/:id`
6. `DELETE /leases/:id`
7. `POST /leases/:leaseId/add-tenant`
8. `POST /leases/:leaseId/terminate`

---

## 1) POST /leases

Creates a lease and creates a tenant user account.

### Content Types

- `application/json`
- `multipart/form-data`

### Request Body (JSON)

`CreateLeaseDto` fields:
- `unitId` (uuid, required)
- `ownerId` (uuid, required)
  - Must be the owner **User.id**. Backward-compatible: if you send **Owner.id**, backend will resolve it to `Owner.userId`.
- `startDate` (ISO string, required)
- `endDate` (ISO string, required)
- `monthlyRent` (number, required)
- `securityDeposit` (number, optional)
- `tenantEmail` (string email, required)
- `tenantNationalId` (string, required)
- `tenantName` (string, required)
- `tenantPhone` (string, required)
- `contractFileId` (uuid, required if not uploading `contractFile`)
- `nationalIdFileId` (uuid, required if not uploading `nationalIdPhoto`)

Example:
```json
{
  "tenantName": "Venus",
  "tenantPhone": "0987654321",
  "unitId": "107565e6-a9ad-4d0e-b4f3-322b9c20c37f",
  "ownerId": "b6fdff82-2f7b-4d61-b497-7bf2991b7dd6",
  "tenantEmail": "venussellaxx@email.com",
  "tenantNationalId": "12345678901255",
  "startDate": "2026-01-01T00:00:00.000Z",
  "endDate": "2026-12-31T23:59:59.000Z",
  "monthlyRent": 50000,
  "securityDeposit": 500000,
  "nationalIdFileId": "<fileId from /files/upload/national-id>",
  "contractFileId": "<fileId from /files/upload/contract>"
}
```

### Multipart Form

File fields:
- `contractFile` (file, required if no `contractFileId`)
- `nationalIdPhoto` (file, required if no `nationalIdFileId`)

Non-file fields: same as JSON fields.

### Validations / Business Rules

Returns 400/403/404/409 with these rules:
- 400 if `startDate >= endDate`
- 400 if `contractFileId` missing and `contractFile` not uploaded
- 400 if `nationalIdFileId` missing and `nationalIdPhoto` not uploaded
- 400 if `contractFileId` does not exist or is not category `CONTRACT`
- 400 if `nationalIdFileId` does not exist or is not category `NATIONAL_ID`
- 400 if `ownerId` is not a valid owner User.id (or resolvable Owner.id)
- 403 if requester is not Admin and is not the specified owner
- 403 if the specified owner does not have ACTIVE `UnitAccess(role=OWNER)` on `unitId`
- 404 if unit not found
- 409 if unit is already `LEASED`
- 409 if overlapping ACTIVE lease exists for the unit
- If `tenantEmail` already exists, the backend reuses the existing tenant user instead of failing.
- 409 if `tenantNationalId` belongs to a different user than `tenantEmail`
- 409 if tenant national ID already exists
- 409 if `contractFileId` is already attached to another lease

### Side Effects

- Creates tenant `User`, `Resident`, and `Tenant`
- Creates `Lease` with status `ACTIVE`
- Sets `Lease.source` automatically:
  - `COMPOUND` if created by an Admin
  - `OWNER` if created by the owner
- Sets unit status to `LEASED`
- Creates `ResidentUnit` mapping for tenant (non-primary)
- Creates `UnitAccess(role=TENANT)` for lease duration
- If the tenant already has ACTIVE family members, it automatically creates `UnitAccess(role=FAMILY, source=FAMILY_AUTO)` for them on the new unit.

### Test Cases

Happy path:
- Create lease with JSON and valid file IDs
- Create lease with multipart upload

Failure:
- Invalid/missing ownerId
- ownerId not owner of unit
- Unit not found
- Unit already leased
- Overlapping lease
- Duplicate tenant email
- Duplicate tenant national ID
- Invalid contract/national id file IDs
- Contract file already used
- startDate >= endDate

---

## 2) GET /leases

Lists all leases.

### Response Notes

- Sorted by `createdAt desc`
- Includes `unit.unitNumber`, `unit.projectName`, `tenant` and `owner` basic fields

### Test Cases

- Returns list
- Ordering newest-first

---

## 3) GET /leases/unit/:unitId

Lists leases for a unit.

### Behavior

- Sorted by `startDate desc`

### Test Cases

- Existing unit with leases returns list
- Unit with no leases returns `[]`

---

## 4) GET /leases/:id

Fetch lease details.

### Behavior

- 404 if not found
- Includes `unit`, `tenant`, `owner`, `contractFile`

### Test Cases

- Existing lease returns expanded details
- Nonexistent id returns 404

---

## 5) PATCH /leases/:id

Updates lease fields.

### Authorization

- Only Admin or lease owner.

### Request Body

`UpdateLeaseDto` fields:
- `tenantId` (uuid, optional)
- `startDate` (ISO string, optional)
- `endDate` (ISO string, optional)
- `monthlyRent` (number, optional)
- `status` (LeaseStatus enum, optional)

### Cascades

If `status` is set to `TERMINATED` or `EXPIRED`, backend also:
- Sets unit status to `OCCUPIED`
- Expires tenant `UnitAccess(role=TENANT)` for the unit
- Deletes tenant `ResidentUnit` mapping for the unit
- Expires family `UnitAccess(role=FAMILY, source=FAMILY_AUTO)` for the unit
- If tenant has no remaining ACTIVE leases, deactivates family members and expires remaining family access
- If tenant has no remaining ACTIVE leases and no ACTIVE OWNER unit access, sets tenant userStatus to INACTIVE and logs it

### Test Cases

Happy path:
- Update rent/dates
- Terminate via update and verify cascades

Failure:
- Non-owner/non-admin tries update -> 403
- Lease not found -> 404

---

## 6) DELETE /leases/:id

Deletes a lease.

### Authorization

- Only Admin or lease owner.

### Cascades

- Sets unit status to `OCCUPIED`
- Expires tenant unit access and removes tenant unit mapping
- Expires family access for that unit and deactivates family if tenant has no remaining leases
- Updates tenant user status if needed

### Test Cases

- Owner/admin deletes lease
- Non-owner/non-admin -> 403
- Lease not found -> 404

---

## 7) POST /leases/:leaseId/add-tenant

Adds a tenant to an existing lease.

### Content Types

- `application/json`
- `multipart/form-data`

### Request Body (JSON)

`AddTenantToLeaseDto` fields:
- `tenantEmail` (email, required)
- `tenantNationalId` (string, required)
- `name` (string, required)
- `phone` (string, required)
- `nationalIdFileId` (uuid, required if not uploading `nationalIdPhoto`)

### Multipart

- File field: `nationalIdPhoto`

### Validations

- 404 if lease not found
- 400 if lease is not ACTIVE
- 403 if requester is not Admin or lease owner
- 409 if email already registered
- 409 if national ID already exists

### Side Effects

- Creates tenant `User`, `Resident`, `Tenant`
- Sets `lease.tenantId`
- Creates tenant `ResidentUnit` mapping (non-primary)
- Creates tenant `UnitAccess(role=TENANT)`

### Test Cases

- Add tenant with JSON `nationalIdFileId`
- Add tenant with multipart upload
- Duplicate email/national id
- Lease not ACTIVE
- Non-owner/non-admin

---

## 8) POST /leases/:leaseId/terminate

Terminates a lease and revokes tenant/family access.

### Authorization

- Only Admin or lease owner.

### Request Body

```json
{
  "reason": "End of contract period",
  "terminationDate": "2026-06-01T00:00:00.000Z"
}
```

### Behavior

- 404 if lease not found
- 400 if lease is not ACTIVE
- 403 if requester is not Admin or lease owner

### Cascades

- Sets lease status to `TERMINATED` and updates `endDate`
- Sets unit status to `OCCUPIED`
- Expires tenant access to the unit
- Removes tenant unit mapping
- Expires family access to the unit
- If tenant has no remaining ACTIVE leases: deactivates family members and expires remaining family access
- If tenant has no remaining ACTIVE leases and no ACTIVE OWNER access: sets userStatus to INACTIVE and logs it

### Test Cases

- Terminate as owner/admin
- Non-owner/non-admin -> 403
- Lease not ACTIVE -> 400
- Lease not found -> 404
