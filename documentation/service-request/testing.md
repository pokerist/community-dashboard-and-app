# Service Request Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## Prerequisites

To create a request you typically need:

- an active unit access for the user on `unitId` (`UnitAccess.status = ACTIVE`)
- a `Service` with `status=true`
- any configured `ServiceField`s for that service (some may be required)
- optional uploaded files:
  - for `attachmentIds` (general attachments)
  - for dynamic fields with `type=FILE` (use `fileAttachmentId` inside `fieldValues`)

## 1) Create a service request (community app)

`POST {{BASE_URL}}/service-requests`

Permissions required: `service_request.create`

Body example (no dynamic fields):

```json
{
  "serviceId": "{{serviceId}}",
  "unitId": "{{unitId}}",
  "description": "AC is not cooling",
  "priority": "MEDIUM",
  "attachmentIds": []
}
```

Body example (with dynamic fields):

```json
{
  "serviceId": "{{serviceId}}",
  "unitId": "{{unitId}}",
  "description": "Water leak in kitchen",
  "priority": "HIGH",
  "attachmentIds": ["{{fileId1}}"],
  "fieldValues": [
    { "fieldId": "{{textFieldId}}", "valueText": "Under the sink" },
    { "fieldId": "{{boolFieldId}}", "valueBool": true }
  ]
}
```

Expected:

- Response includes `service`, `attachments` (with `file`), and `fieldValues` (with `field`).

Test cases:

- Missing/invalid `unitId` -> 400 validation error.
- User has no ACTIVE unit access -> 403.
- Service inactive -> 400.
- Missing required fields -> 400.
- Submitting a `fieldId` that belongs to a different service -> 400.
- Submitting multiple value columns for the same field (e.g. `valueText` + `valueNumber`) -> 400.
- Service eligibility mismatch:
  - `DELIVERED_ONLY` + unit not delivered -> 400
  - `NON_DELIVERED_ONLY` + unit delivered -> 400

## 2) List my requests

`GET {{BASE_URL}}/service-requests/my-requests`

Permissions required: `service_request.view_own`

Expected:

- Array ordered by `requestedAt` desc.

## 3) Get a request by id

`GET {{BASE_URL}}/service-requests/{{requestId}}`

Permissions required: `service_request.view_own` OR `service_request.view_all`

Expected:

- With `service_request.view_own`: you can only fetch requests you created.
- With `service_request.view_all`: you can fetch any request.

## 4) List all requests (dashboard)

`GET {{BASE_URL}}/service-requests`

Permissions required: `service_request.view_all`

Expected:

- Array ordered by `requestedAt` desc.

## 5) Update a request (dashboard)

`PATCH {{BASE_URL}}/service-requests/{{requestId}}`

Permissions required:

- for `assignedToId`: `service_request.assign`
- for `status=RESOLVED`: `service_request.resolve`
- for `status=CLOSED`: `service_request.close`
- for `status=NEW` or `IN_PROGRESS`: `service_request.assign`

Assign example:

```json
{ "assignedToId": "{{staffUserId}}" }
```

Resolve example:

```json
{ "status": "RESOLVED" }
```

Test cases:

- Invalid `assignedToId` -> 400.
- Trying to resolve without `service_request.resolve` -> 403.

