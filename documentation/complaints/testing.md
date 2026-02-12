# Complaints Module - Postman Testing Guide

## Postman environment variables

- `baseUrl` (example: `http://localhost:3000`)
- `residentToken` (owner/tenant/family JWT)
- `staffToken` (admin/staff JWT with complaint permissions)
- `unitId`
- `fileId_attachment` (File.id uploaded as `SERVICE_ATTACHMENT`)
- `complaintId`

## File upload prerequisites (attachments)

Upload complaint evidence using the File module:

- `POST {{baseUrl}}/files/upload/service-attachment` (form-data key `file`)

Use the returned `id` as an item in `attachmentIds`.

## 1) Create complaint (resident)

`POST {{baseUrl}}/complaints`

Headers:

- `Authorization: Bearer {{residentToken}}`

Body:

```json
{
  "unitId": "{{unitId}}",
  "category": "Noise",
  "description": "Loud music after 11 PM",
  "priority": "MEDIUM",
  "attachmentIds": ["{{fileId_attachment}}"]
}
```

Expected:

- `201/200` complaint with `complaintNumber` like `CMP-00001`.

Negative test cases:

- Provide `reporterId` different from token -> `400 reporterId must match the authenticated user`
- Provide `unitId` where user has no active access -> `403 No active access to this unit`

## 2) List complaints (staff)

`GET {{baseUrl}}/complaints?page=1&limit=20&search=CMP-&status=NEW`

Headers:

- `Authorization: Bearer {{staffToken}}`

Expected:

- Paginated response: `{ data: [...], meta: {...} }`

## 3) Get complaint by id (resident own)

`GET {{baseUrl}}/complaints/{{complaintId}}`

Headers:

- `Authorization: Bearer {{residentToken}}`

Expected:

- `200` only if the complaint belongs to that resident (reporterId matches token).

## 4) Assign/update complaint (staff)

`PATCH {{baseUrl}}/complaints/{{complaintId}}`

Headers:

- `Authorization: Bearer {{staffToken}}`

Body:

```json
{
  "status": "IN_PROGRESS",
  "assignedToId": "<staffUserId>"
}
```

Expected:

- `200` updated complaint.

## 5) Resolve/close (staff)

`PATCH {{baseUrl}}/complaints/{{complaintId}}/status`

Headers:

- `Authorization: Bearer {{staffToken}}`

Body:

```json
{
  "status": "RESOLVED",
  "resolutionNotes": "Investigated and notified resident"
}
```

Negative:

- `RESOLVED` without `resolutionNotes` -> `400`

## 6) Delete complaint (resident own)

`DELETE {{baseUrl}}/complaints/{{complaintId}}`

Headers:

- `Authorization: Bearer {{residentToken}}`

Expected:

- `200` deletion for open complaints.

Negative:

- Attempt delete when status `RESOLVED/CLOSED` -> `400 Cannot delete a RESOLVED complaint.`
- Attempt delete someone else’s complaint -> `403`

