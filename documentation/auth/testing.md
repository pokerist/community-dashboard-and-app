# Auth Module - Postman / API Testing

## Setup

Recommended Postman environment variables:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)
- `USER_ID` (your user id)
- `REFRESH_TOKEN` (latest refresh token)

JWT-protected requests need:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

## 1) Login

`POST {{BASE_URL}}/auth/login`

Body (email):
```json
{ "email": "admin@example.com", "password": "P@ssw0rd123" }
```

Body (phone):
```json
{ "phone": "+201234567890", "password": "P@ssw0rd123" }
```

Expected:
- 200 `{ "accessToken": "...", "refreshToken": "..." }`

Test cases:
- Wrong password 5 times -> 403 lockout for ~15 minutes.
- Non-admin user without ACTIVE `UnitAccess` -> 403.
- If `ENABLE_PENDING_REGISTRATIONS=true` and a matching `PendingRegistration` is `PENDING` -> 401.

## 2) Refresh token

`POST {{BASE_URL}}/auth/refresh`

Body:
```json
{ "userId": "{{USER_ID}}", "refreshToken": "{{REFRESH_TOKEN}}" }
```

Expected:
- 200 new `{ accessToken, refreshToken }`

Test cases:
- Wrong refresh token -> 401 and all refresh tokens for the user are revoked.
- Expired stored refresh token -> 401 and all refresh tokens for the user are revoked.

## 3) Forgot password (request reset)

`POST {{BASE_URL}}/auth/forgot-password`

Body (email):
```json
{ "email": "user@example.com" }
```

Body (phone):
```json
{ "phone": "+201234567890" }
```

Expected:
- 200 `{ "message": "If the account exists, a reset link has been sent." }`

Notes:
- Delivery is done via `NotificationsService` and currently relies on `EMAIL` delivery.
- If the account exists but has no email on file, the API still returns success, but nothing will be delivered.

## 4) Reset password

`POST {{BASE_URL}}/auth/reset-password`

Body:
```json
{ "token": "<token-from-email-link>", "newPassword": "NewP@ssw0rd123" }
```

Expected:
- 200 `{ "message": "Password reset successfully" }`

Test cases:
- Invalid token -> 400.
- Expired token (> 1 hour) -> 400.
- Reusing the same token -> 400.
- After reset, old refresh tokens should no longer work.

## 5) Send email verification token (JWT)

`POST {{BASE_URL}}/auth/send-email-verification`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN}}`

Expected:
- 200 `{ "message": "Verification email sent" }`

Test cases:
- User has no email -> 400.

## 6) Verify email (JWT)

`POST {{BASE_URL}}/auth/verify-email`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN}}`

Body:
```json
{ "token": "<token-from-verification-email>" }
```

Expected:
- 200 `{ "message": "Email verified successfully" }`

## 7) Send phone OTP (JWT)

`POST {{BASE_URL}}/auth/send-phone-otp`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN}}`

Body:
```json
{ "phone": "+201234567890" }
```

Expected:
- 200 `{ "message": "OTP sent successfully" }`

Test cases:
- Phone does not match current user profile -> 400.

Note:
- SMS delivery depends on notification delivery implementation.

## 8) Verify phone OTP (JWT)

`POST {{BASE_URL}}/auth/verify-phone-otp`

Headers:
- `Authorization: Bearer {{ACCESS_TOKEN}}`

Body:
```json
{ "otp": "123456" }
```

Expected:
- 200 `{ "message": "Phone verified successfully" }`

Test cases:
- Invalid OTP -> 400.
- Expired OTP (> 5 minutes) -> 400.

## 9) Signup with referral (feature-flagged)

`POST {{BASE_URL}}/auth/signup-with-referral`

Requires `ENABLE_REFERRAL_SIGNUP=true` (otherwise 404).

Body:
```json
{ "phone": "+201234567890", "name": "New User", "password": "P@ssw0rd123" }
```

Expected:
- 200 `{ accessToken, refreshToken }`

Test cases:
- No valid referral for phone -> 400.
- Phone already belongs to a user -> 400.
