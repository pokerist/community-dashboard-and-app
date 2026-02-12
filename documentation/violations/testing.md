# Violations Module - Postman Testing Guide

## Postman environment variables

- `baseUrl` (example: `http://localhost:3000`)
- `staffToken` (JWT with violation permissions)
- `residentToken` (JWT with `violation.view_own`)
- `unitId`
- `residentUserId` (User.id for the violation target)
- `fileId_attachment` (File.id uploaded as `SERVICE_ATTACHMENT`)
- `violationId`

## File upload prerequisites (attachments)

Upload violation evidence using the File module:

- `POST {{baseUrl}}/files/upload/service-attachment` (form-data key `file`)

Use the returned `id` as an item in `attachmentIds`.

## 1) Issue violation (staff)

`POST {{baseUrl}}/violations`

Headers:

- `Authorization: Bearer {{staffToken}}`

Body:

```json
{
  "unitId": "{{unitId}}",
  "residentId": "{{residentUserId}}",
  "type": "Noise",
  "description": "Excessive noise after 10 PM",
  "fineAmount": 500,
  "dueDate": "2026-03-01T00:00:00.000Z",
  "attachmentIds": ["{{fileId_attachment}}"]
}
```

Expected:

- `201/200` violation with `violationNumber` like `VIO-00001`.
- Invoice is generated if `fineAmount > 0`.

Negative:

- Provide `issuedById` different from token -> `400 issuedById must match the authenticated user`

## 2) List violations (staff)

`GET {{baseUrl}}/violations?page=1&limit=20&status=PENDING&search=VIO-`

Headers:

- `Authorization: Bearer {{staffToken}}`

Expected:

- Paginated response: `{ data: [...], meta: {...} }`

## 3) Get violation by id (resident own)

`GET {{baseUrl}}/violations/{{violationId}}`

Headers:

- `Authorization: Bearer {{residentToken}}`

Expected:

- `200` only if `residentUserId` matches the token user id.

## 4) Update violation status / appeal (staff)

`PATCH {{baseUrl}}/violations/{{violationId}}`

Headers:

- `Authorization: Bearer {{staffToken}}`

Body:

```json
{
  "status": "APPEALED",
  "appealStatus": "Under review"
}
```

Expected:

- `200` updated violation.

## 5) Cancel/delete violation (staff)

`DELETE {{baseUrl}}/violations/{{violationId}}`

Headers:

- `Authorization: Bearer {{staffToken}}`

Expected:

- `200` deleted violation.

Negative:

- If linked invoice is `PAID` -> `400 Cannot delete a violation that has already been paid.`

