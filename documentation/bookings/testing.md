# Bookings Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## Prerequisites

To create bookings you need:

- a facility with slotConfig configured and `isActive=true`
- a unit with status `DELIVERED` (or `OCCUPIED` / `LEASED`)
- an ACTIVE `UnitAccess` row for your user on the unit with `canBookFacilities=true`

## 1) Create booking (community)

`POST {{BASE_URL}}/bookings`

Permissions required: `booking.create`

Body example:

```json
{
  "facilityId": "{{facilityId}}",
  "unitId": "{{unitId}}",
  "date": "2026-02-20T00:00:00.000Z",
  "startTime": "18:00",
  "endTime": "19:00"
}
```

Test cases:

- Booking on a closed day (exception `isClosed=true`) -> 400.
- Time not matching slot rules -> 400.
- Slot capacity exceeded -> 400.
- Cooldown not met -> 400.
- Unit not delivered -> 400.
- No ACTIVE unit access -> 403.
- `canBookFacilities=false` -> 400.

## 2) My bookings (community)

`GET {{BASE_URL}}/bookings/me`

Permissions required: `booking.view_own`

Expected:

- Array ordered by date desc, startTime desc.

## 3) Get booking by id (own vs all)

`GET {{BASE_URL}}/bookings/{{bookingId}}`

Permissions required: `booking.view_all` OR `booking.view_own`

Test cases:

- With only `booking.view_own`, trying to fetch someone else's booking -> 403.

## 4) List all bookings (dashboard)

`GET {{BASE_URL}}/bookings?page=1&limit=20`

Permissions required: `booking.view_all`

Optional filters:

- `status=PENDING|APPROVED|CANCELLED|REJECTED`
- `facilityId={{facilityId}}`
- `userId={{userId}}`
- `unitId={{unitId}}`
- `dateFrom=2026-02-01`
- `dateTo=2026-02-28`
- `search=<text>` (uses `paginate(...)` search)

## 5) Update booking status (dashboard)

`PATCH {{BASE_URL}}/bookings/{{bookingId}}/status`

Permissions required: `booking.update`

Approve example:

```json
{ "status": "APPROVED" }
```

Cancel (dashboard) example:

```json
{ "status": "CANCELLED" }
```

Expected:

- Emits events that trigger IN_APP + EMAIL notifications.

## 6) Cancel my booking (community)

`PATCH {{BASE_URL}}/bookings/{{bookingId}}/cancel`

Permissions required: `booking.cancel_own`

Expected:

- Sets `status=CANCELLED` and sets `cancelledAt`.

