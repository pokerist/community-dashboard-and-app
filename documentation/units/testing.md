# Units Module - Postman Testing Guide

This file is meant to be used as a practical testing checklist for `src/modules/units`.

## Postman environment variables

Recommended variables:

- `baseUrl` (example: `http://localhost:3000`)
- `adminToken`
- `unitId`
- `userId` (User.id that has a Resident profile)
- `residentId` (Resident.id for the same user)

## Authentication

All routes require:

- Header: `Authorization: Bearer {{adminToken}}`

## 1) Create unit

`POST {{baseUrl}}/units`

Body:

```json
{
  "unitNumber": "A-504",
  "projectName": "Alkarma",
  "block": "A",
  "type": "APARTMENT",
  "floors": 1,
  "bedrooms": 3,
  "bathrooms": 2,
  "sizeSqm": 120.5,
  "price": 1500000
}
```

Expected:

- `201` with created unit.

Negative:

- Missing required fields -> `400`

## 2) List units (filtering + pagination)

`GET {{baseUrl}}/units?status=AVAILABLE&type=APARTMENT&page=1&limit=20&search=A`

Expected:

- `200` paginated response (see `paginate(...)` output shape used across the project).

## 3) Get unit

`GET {{baseUrl}}/units/{{unitId}}`

Expected:

- `200` with unit including `residents` and `leases`.

## 4) Update unit

`PATCH {{baseUrl}}/units/{{unitId}}`

Body:

```json
{ "block": "B" }
```

Expected:

- `200` updated unit.

## 5) Delete unit

`DELETE {{baseUrl}}/units/{{unitId}}`

Expected:

- `204` (no body).

## 6) Assign resident to unit

`POST {{baseUrl}}/units/{{unitId}}/assign-user`

Body (either form works):

```json
{ "userId": "{{userId}}", "role": "OWNER" }
```

or

```json
{ "userId": "{{residentId}}", "role": "OWNER" }
```

Expected:

- `201` with created `ResidentUnit`.

Negative:

- Unit not found -> `404`
- Resident/user not found -> `404 Resident not found`
- Duplicate assignment -> `400 Resident is already assigned to this unit`
- Assign OWNER when already has primary -> `400 Unit already has an owner assigned`

## 7) Get unit residents (legacy assignment list)

`GET {{baseUrl}}/units/{{unitId}}/residents`

Expected:

- `200` list of `ResidentUnit` rows including `resident`.

## 8) Remove resident assignment

`DELETE {{baseUrl}}/units/{{unitId}}/assigned-users/{{userId}}`

Expected:

- `204`

Negative:

- Not found -> `404 Resident assignment not found for this unit`

## 9) Update unit status

`PATCH {{baseUrl}}/units/{{unitId}}/status`

Body:

```json
{ "status": "DELIVERED" }
```

Expected:

- `200` unit with `status=DELIVERED` and `isDelivered=true`.

## 10) Get unit leases

`GET {{baseUrl}}/units/{{unitId}}/leases`

Expected:

- `200` list of leases for the unit.

## 11) Search by unit number (contains)

`GET {{baseUrl}}/units/number/A-5`

Expected:

- `200` array of matching units.

Negative:

- No matches -> `404 No units found matching the number`

## 12) Read UnitAccess for a user on a unit

`GET {{baseUrl}}/units/access/{{unitId}}/{{userId}}`

Expected:

- `200` `UnitAccess` row or `null` if no active access exists.

## 13) Feature gating check

`GET {{baseUrl}}/units/can-access-feature/{{unitId}}?feature=add_family`

Expected:

- `200 { \"canAccess\": true|false }` based on `Unit.status`.

