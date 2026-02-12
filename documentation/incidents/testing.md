# Incidents Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) Create an incident

`POST {{BASE_URL}}/incidents`

Permissions required: `incidents.create`

Body example (with unit and attachments):

```json
{
  "type": "Suspicious activity",
  "location": "Gate 3",
  "residentName": "N/A",
  "description": "Guard reported suspicious person near gate",
  "priority": "HIGH",
  "unitId": "{{unitId}}",
  "attachmentIds": ["{{fileId1}}", "{{fileId2}}"]
}
```

Test cases:

- Missing `type` or `description` -> 400 validation error.
- Invalid `unitId` -> 400 "Unit not found".
- Invalid `priority` -> 400 validation error.

## 2) Dashboard cards

`GET {{BASE_URL}}/incidents/cards`

Permissions required: `incidents.view`

Expected:

- `{ activeIncidents, incidentsResolvedToday, averageResponseTime, totalCCTVCameras }`

## 3) Paginated list

`GET {{BASE_URL}}/incidents/list?page=1&limit=20`

Permissions required: `incidents.view`

Optional filters:

- `status=OPEN|RESOLVED`
- `priority=LOW|MEDIUM|HIGH|CRITICAL`
- `unitId={{unitId}}`
- `reportedAtFrom=2026-01-01`
- `reportedAtTo=2026-01-31`
- `search=<text>` (searches type/location/residentName/description/incidentNumber)

Expected:

- Standard pagination response from `paginate(...)`.

## 4) Resolve an incident

`PATCH {{BASE_URL}}/incidents/{{incidentId}}/resolve`

Permissions required: `incidents.resolve`

Expected:

- Incident updated to `status=RESOLVED` with `resolvedAt` and `responseTime`.

Test cases:

- Resolving a non-existent incident -> 404.
- Resolving an already resolved incident -> 400.

