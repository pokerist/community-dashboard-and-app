# Leases Module - Postman Testing Guide

This file is meant to be used as a practical testing checklist for `src/modules/leases`.

## Postman environment variables

Recommended variables:

- `baseUrl` (example: `http://localhost:3000`)
- `adminToken`
- `ownerToken`
- `unitId`
- `ownerUserId` (recommended; see “ownerId resolution”)
- `leaseId`
- `fileId_contract` (File.id with category `CONTRACT`)
- `fileId_nationalId` (File.id with category `NATIONAL_ID`)

## Authentication

All routes require:

- Header: `Authorization: Bearer {{adminToken}}` or `{{ownerToken}}`

To get a token:

`POST {{baseUrl}}/auth/login`

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

## File uploads (prerequisite for JSON-based lease creation)

- Upload contract: `POST {{baseUrl}}/files/upload/contract` (form-data key `file`)
- Upload national ID: `POST {{baseUrl}}/files/upload/national-id` (form-data key `file`)

Use the returned `id` as `contractFileId` / `nationalIdFileId`.

## 1) Create lease (JSON + file IDs)

`POST {{baseUrl}}/leases`

Headers:

- `Authorization: Bearer {{adminToken}}` (or `{{ownerToken}}` if creating as owner)

Body (new tenant):

```json
{
  "unitId": "{{unitId}}",
  "ownerId": "{{ownerUserId}}",
  "startDate": "2026-03-01T00:00:00.000Z",
  "endDate": "2027-02-28T23:59:59.000Z",
  "monthlyRent": 50000,
  "securityDeposit": 200000,
  "tenantEmail": "tenant1@example.com",
  "tenantNationalId": "12345678901234",
  "tenantName": "Tenant One",
  "tenantPhone": "+201000000001",
  "contractFileId": "{{fileId_contract}}",
  "nationalIdFileId": "{{fileId_nationalId}}"
}
```

Expected:

- `200/201` lease object with `status=ACTIVE`.
- Unit updated to `status=LEASED`.
- `UnitAccess(role=TENANT)` created for tenant.

Negative test cases:

- `startDate >= endDate` -> `400`
- Unit not found -> `404`
- Unit already `LEASED` -> `409`
- Owner has no active owner access on unit -> `403`
- Overlapping active lease for unit -> `409`
- Contract/national ID file missing or wrong category -> `400`
- Contract file already attached to another lease -> `409`

## 2) Create lease (multipart upload)

`POST {{baseUrl}}/leases`

Headers:

- `Authorization: Bearer {{adminToken}}`
- `Content-Type: multipart/form-data`

Form-data:

- `contractFile`: (file, required if no `contractFileId`)
- `nationalIdPhoto`: (file, optional; required if tenant has no stored `nationalIdFileId`)
- plus the same non-file fields as JSON.

Expected:

- Same behavior as JSON flow; controller uploads files and passes IDs to service.

## 3) Create lease reusing an existing tenant by email

Prerequisite:

- A tenant user exists with the email used below.

`POST {{baseUrl}}/leases`

Body (reused tenant):

```json
{
  "unitId": "{{unitId}}",
  "ownerId": "{{ownerUserId}}",
  "startDate": "2027-03-01T00:00:00.000Z",
  "endDate": "2028-02-29T23:59:59.000Z",
  "monthlyRent": 55000,
  "tenantEmail": "tenant1@example.com",
  "contractFileId": "{{fileId_contract}}"
}
```

Notes:

- `tenantName/tenantPhone/tenantNationalId` may be omitted for existing tenants.
- `nationalIdFileId` may be omitted only if the existing tenant already has `User.nationalIdFileId` stored.

## 4) List leases

`GET {{baseUrl}}/leases`

Expected:

- `200` list ordered by `createdAt desc`.

## 5) List leases by unit

`GET {{baseUrl}}/leases/unit/{{unitId}}`

Expected:

- `200` list ordered by `startDate desc`.

## 6) Get lease details

`GET {{baseUrl}}/leases/{{leaseId}}`

Expected:

- `200` lease including `unit`, `tenant`, `owner`, `contractFile`.

Negative:

- Not found -> `404`

## 7) Update lease

`PATCH {{baseUrl}}/leases/{{leaseId}}`

Headers:

- `Authorization: Bearer {{adminToken}}` (or owner token for owner user)

Body examples:

- Update rent:
```json
{ "monthlyRent": 60000 }
```

- Terminate via status update (triggers cascades):
```json
{ "status": "TERMINATED", "endDate": "2026-09-01T00:00:00.000Z" }
```

Expected on termination/expiry:

- Unit updated to `OCCUPIED`.
- Tenant `UnitAccess(role=TENANT)` expired.
- Tenant `ResidentUnit` mapping removed.

## 8) Delete lease

`DELETE {{baseUrl}}/leases/{{leaseId}}`

Expected:

- Lease deleted.
- Unit updated to `OCCUPIED`.
- Tenant access expired and tenant mapping removed.

## 9) Add tenant to existing lease

`POST {{baseUrl}}/leases/{{leaseId}}/add-tenant`

Body:

```json
{
  "tenantEmail": "tenant2@example.com",
  "tenantNationalId": "99998888777766",
  "name": "Tenant Two",
  "phone": "+201000000002",
  "nationalIdFileId": "{{fileId_nationalId}}"
}
```

Expected:

- New tenant created and linked to lease.
- Tenant unit access created.

Negative:

- Lease not active -> `400`
- Email already registered -> `409`
- National ID already exists -> `409`

## 10) Terminate lease

`POST {{baseUrl}}/leases/{{leaseId}}/terminate`

Body:

```json
{
  "reason": "End of contract",
  "terminationDate": "2026-10-01T00:00:00.000Z"
}
```

Expected:

- Lease `status=TERMINATED` and `endDate` set to termination date.
- Unit set to `OCCUPIED`.
- Tenant access expired and mappings removed.
- Termination email attempted (best-effort) if tenant email exists.

