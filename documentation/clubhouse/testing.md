# Clubhouse Module - Postman / API Testing

## Setup

Recommended environment variables:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN_USER` (JWT for a unit user)
- `ACCESS_TOKEN_ADMIN` (JWT for an admin user)
- `UNIT_ID` (unit the user has ACTIVE access to)
- `REQUEST_ID` (clubhouse request id)

Headers for all requests:

- `Authorization: Bearer <token>`

## 1) Request clubhouse access (User)

`POST {{BASE_URL}}/clubhouse/request-access`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_USER}}`

Body:
```json
{ "unitId": "{{UNIT_ID}}" }
```

Expected:
- 201/200 `ClubhouseAccessRequest` with `status="PENDING"`.

Test cases:
- User has no ACTIVE UnitAccess -> 400.
- Unit status not delivered/occupied/leased -> 400.
- Duplicate request (existing PENDING/APPROVED) -> 400.

## 2) List pending requests (Admin)

`GET {{BASE_URL}}/clubhouse/pending`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}`

Expected:
- Array of PENDING requests (includes user + unit).

Test case:
- Non-admin -> 403.

## 3) Approve (Admin)

`POST {{BASE_URL}}/clubhouse/approve/{{REQUEST_ID}}`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}`

Expected:
- Updated request with `status="APPROVED"`, `approvedAt`, `approvedBy`.

Test cases:
- Approve non-existent -> 404.
- Approve non-PENDING -> 400.

## 4) Reject (Admin)

`POST {{BASE_URL}}/clubhouse/reject/{{REQUEST_ID}}`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_ADMIN}}`

Expected:
- Updated request with `status="REJECTED"`.

## 5) View my approved access (User)

`GET {{BASE_URL}}/clubhouse/my-access`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN_USER}}`

Expected:
- Array of APPROVED requests (includes unit).

## 6) Booking integration check

Bookings for facilities with `Facility.type === MULTIPURPOSE_HALL` require APPROVED clubhouse access.

Steps:

1) Attempt to create a booking for a `MULTIPURPOSE_HALL` facility without approval -> expect 403.
2) Approve the clubhouse request -> attempt booking again -> expect success (assuming other booking rules pass).
