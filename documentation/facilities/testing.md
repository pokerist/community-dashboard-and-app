# Facilities Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) Create a facility (admin)

`POST {{BASE_URL}}/facilities`

Permissions required: `facility.create`

Body example:

```json
{
  "name": "Gym",
  "type": "CUSTOM",
  "isActive": true,
  "capacity": 20,
  "maxReservationsPerDay": 1,
  "cooldownMinutes": 60,
  "slotConfig": [
    {
      "dayOfWeek": 1,
      "startTime": "10:00",
      "endTime": "22:00",
      "slotDurationMinutes": 60,
      "slotCapacity": 5
    }
  ],
  "slotExceptions": [
    {
      "date": "2026-02-20",
      "isClosed": true
    }
  ]
}
```

## 2) List facilities (community or dashboard)

`GET {{BASE_URL}}/facilities`

Permissions required: `facility.view_all` OR `facility.view_own`

Expected:

- With `facility.view_all`: includes active + inactive facilities.
- With only `facility.view_own`: returns only `isActive=true` facilities.

## 3) Get facility by id

`GET {{BASE_URL}}/facilities/{{facilityId}}`

Permissions required: `facility.view_all` OR `facility.view_own`

Expected:

- With only `facility.view_own`: inactive facilities return 404.

## 4) Update facility (admin)

`PATCH {{BASE_URL}}/facilities/{{facilityId}}`

Permissions required: `facility.update`

Notes:

- If you pass `slotConfig`, it replaces all slot config rows for the facility.
- If you pass `slotExceptions`, it replaces all exception rows for the facility.

## 5) Disable facility (soft delete) (admin)

`DELETE {{BASE_URL}}/facilities/{{facilityId}}`

Permissions required: `facility.delete`

Expected:

- If there are active bookings (`PENDING` or `APPROVED`) -> 400.
- Otherwise -> facility updated to `isActive=false`.

