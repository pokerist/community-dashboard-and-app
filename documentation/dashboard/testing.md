# Dashboard Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

All endpoints require permission: `dashboard.view`.

## 1) Summary

`GET {{BASE_URL}}/dashboard/summary`

Expected:

- `pendingRegistrations` returns `0` unless `ENABLE_PENDING_REGISTRATIONS === 'true'`.

## 2) Incidents (dashboard list)

`GET {{BASE_URL}}/dashboard/incidents?page=1&limit=20`

Optional query params:

- `projectName`, `block`, `unitId`
- `status=OPEN|RESOLVED|CLOSED`
- `priority=LOW|MEDIUM|HIGH|CRITICAL`
- `dateFrom=2026-02-01`
- `dateTo=2026-02-28`
- `search=<text>`

## 3) Complaints (dashboard list)

`GET {{BASE_URL}}/dashboard/complaints?page=1&limit=20`

Optional query params:

- `projectName`, `block`, `unitId`
- `status=NEW|IN_PROGRESS|RESOLVED|CLOSED`
- `priority=LOW|MEDIUM|HIGH|CRITICAL`
- `dateFrom=2026-02-01`
- `dateTo=2026-02-28`
- `search=<text>`

## 4) Revenue

`GET {{BASE_URL}}/dashboard/revenue?dateFrom=2026-01-01&dateTo=2026-12-31`

Expected:

- `chartData` array grouped by month (`YYYY-MM`).
- `currentMonth` and `currentYear` totals.

## 5) Occupancy

`GET {{BASE_URL}}/dashboard/occupancy`

Optional:

- `projectName`, `block`

## 6) Devices

`GET {{BASE_URL}}/dashboard/devices`

Optional:

- `projectName`, `block`, `unitId`
- `type=CAMERA|...`

