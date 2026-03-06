# Commercial Module - Testing Guide

## Automated Tests

Run only commercial unit tests:

```bash
npm test -- commercial.service.spec.ts
```

Run only commercial e2e tests:

```bash
npm run test:e2e -- test/commercial/commercial.e2e-spec.ts
```

## Postman / Manual Flow

Use JWT bearer token with permissions:

- `commercial.view_all`
- `commercial.create`
- `commercial.update`
- `commercial.delete`

### 1) Create Commercial Entity

`POST /commercial/entities`

```json
{
  "name": "Starbucks",
  "description": "Coffee tenant",
  "communityId": "community-uuid",
  "ownerUserId": "owner-user-uuid"
}
```

### 2) Create Branch

`POST /commercial/entities/:entityId/branches`

```json
{
  "name": "Main Branch",
  "unitId": "unit-uuid"
}
```

### 3) Add Staff

`POST /commercial/branches/:branchId/staff`

```json
{
  "userId": "employee-user-uuid",
  "role": "EMPLOYEE",
  "permissions": ["WORK_ORDERS", "ATTENDANCE"]
}
```

### 4) Replace Staff Access

`PUT /commercial/staff/:staffId/access`

```json
{
  "permissions": ["WORK_ORDERS", "SERVICE_REQUESTS"]
}
```

### 5) Soft Delete Validation

- `DELETE /commercial/staff/:staffId`
- `DELETE /commercial/branches/:branchId`
- `DELETE /commercial/entities/:entityId`

Verify in DB that records remain present with non-null `deletedAt`.
