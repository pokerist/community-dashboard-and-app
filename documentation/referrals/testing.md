# Referrals Module - Postman / API Testing

## Setup

Environment variables recommended:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)

All requests below require header:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) Create a referral (community user)

`POST {{BASE_URL}}/referrals`

Permissions required: `referral.create`

Body example:

```json
{
  "friendFullName": "John Doe",
  "friendMobile": "+201234567890",
  "message": "Join our community!"
}
```

Test cases:

- `friendMobile` invalid format -> 400 validation error.
- Self referral (friendMobile equals your phone) -> 400.
- Duplicate active referral for the same phone -> 409.

## 2) Validate a referral (authenticated)

`GET {{BASE_URL}}/referrals/validate?phone=+201234567890`

Auth: JWT required (no specific permission enforced on this endpoint)

Expected:

- If no active referral -> `{ valid: false, message: ... }`
- If active referral exists -> `{ valid: true, referrerName, message: ... }`

## 3) List referrals (admin/staff)

`GET {{BASE_URL}}/referrals?page=1&limit=20`

Permissions required: `referral.view_all`

Optional filters:

- `status=NEW|CONTACTED|CONVERTED|REJECTED`
- `referrerId={{userId}}`
- `dateFrom=2026-01-01`
- `dateTo=2026-01-31`

Expected:

- Paginated response `{ data, meta }`.

## 4) Reject a referral (admin/staff)

`PATCH {{BASE_URL}}/referrals/{{referralId}}/reject`

Permissions required: `referral.view_all`

Body example:

```json
{ "reason": "Invalid phone" }
```

Test cases:

- Rejecting a converted referral -> 400.
- Rejecting an already rejected referral -> 400.

## 5) (Optional) Signup with referral (feature-flagged)

`POST {{BASE_URL}}/auth/signup-with-referral`

Availability:

- Disabled unless `ENABLE_REFERRAL_SIGNUP === 'true'` (otherwise returns 404).

Body example:

```json
{
  "phone": "+201234567890",
  "name": "Jane Doe",
  "password": "securePassword123"
}
```

