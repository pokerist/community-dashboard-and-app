# Delegates Module - Postman / API Testing

## Setup

Recommended environment variables:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN_OWNER` (JWT for an owner user)
- `ACCESS_TOKEN_ADMIN` (JWT for an admin user)
- `DELEGATE_USER_ID` (existing `User.id` for the delegate)
- `UNIT_ID` (unit the owner has ACTIVE access to)
- `DELEGATE_ID_FILE_ID` (file id uploaded as `DELEGATE_ID` or `NATIONAL_ID`)
- `UNIT_ACCESS_ID` (created delegate `UnitAccess.id`)

Headers for all requests:

- `Authorization: Bearer <token>`

## 1) Request delegate access (Owner)

`POST {{BASE_URL}}/delegates/request`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_OWNER}}`

Body:
```json
{
  "userId": "{{DELEGATE_USER_ID}}",
  "unitId": "{{UNIT_ID}}",
  "type": "FRIEND",
  "idFileId": "{{DELEGATE_ID_FILE_ID}}",
  "startsAt": "2026-02-20T00:00:00.000Z",
  "endsAt": "2026-03-20T00:00:00.000Z",
  "canGenerateQR": true,
  "canManageWorkers": true,
  "canViewFinancials": true,
  "canReceiveBilling": false,
  "canBookFacilities": true
}
```

Expected:
- 201/200 UnitAccess row with `role="DELEGATE"` and `status="PENDING"`.

Test cases:
- Unit status not in `DELIVERED/OCCUPIED/LEASED` -> 403.
- Requester is not an owner -> 403.
- Delegate already has `PENDING/APPROVED/ACTIVE` access -> 400.
- `idFileId` does not exist -> 400.
- `endsAt <= startsAt` -> 400.

## 2) List pending delegate requests (Admin)

`GET {{BASE_URL}}/delegates/pending`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}`

Expected:
- Array of pending delegate `UnitAccess` rows (includes user + unit).

Test case:
- Non-admin calls this -> 403.

## 3) Approve a delegate request (Admin)

`POST {{BASE_URL}}/delegates/{{UNIT_ACCESS_ID}}/approve`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}`

Expected:
- Updated UnitAccess row with `status="ACTIVE"`.

Test cases:
- Approving non-DELEGATE access id -> 404.
- Approving non-PENDING -> 400.
- Delegate user missing email/phone/nationalIdFileId -> 400.

Credential setup test:
- If the delegate user has no password, approval should trigger an email containing a password setup link (reset-password flow).

## 4) Revoke delegate access (Admin or Owner)

`POST {{BASE_URL}}/delegates/{{UNIT_ACCESS_ID}}/revoke`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}` (or owner token)

Expected:
- Updated UnitAccess row with `status="REVOKED"` and `endsAt` set to now.

Test cases:
- Non-admin and non-owner -> 403.
- Revoked delegate can no longer generate QRs / book facilities / access unit-scoped endpoints that require ACTIVE access.

## 5) List delegates for a unit (Admin/Owner)

`GET {{BASE_URL}}/delegates/unit/{{UNIT_ID}}`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_OWNER}}` (or admin token)

Expected:
- Array of DELEGATE unit-access rows for the unit.

## 6) Update delegate permissions/dates (Admin/Owner)

`PATCH {{BASE_URL}}/delegates/{{UNIT_ACCESS_ID}}`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}` (or owner token)

Body:
```json
{ "canGenerateQR": false, "endsAt": "2026-03-01T00:00:00.000Z" }
```

Expected:
- Updated UnitAccess row.

Test cases:
- Non-admin and non-owner -> 403.

## 7) Hard delete (Admin only)

`DELETE {{BASE_URL}}/delegates/{{UNIT_ACCESS_ID}}`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}`

Expected:
- Deleted UnitAccess row.

Test case:
- Non-admin -> 403.
