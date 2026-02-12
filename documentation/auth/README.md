# Auth Module (`src/modules/auth`)

## What this module is responsible for

This module provides authentication and account-verification workflows:

- Login with email or phone + password.
- JWT access token issuance + refresh token rotation.
- Password reset via time-limited token (sent by email).
- Email verification (send token + verify token).
- Phone verification OTP (token creation + verify; delivery depends on notification delivery implementation).
- Referral-based signup (feature-flagged).

## Authentication model

- Access tokens are JWTs signed with `JWT_ACCESS_SECRET` and expire in **15 minutes**.
- Refresh tokens are random UUIDs stored hashed in DB and expire in **7 days**.

Generated JWT payload includes:
- `sub`: user id
- `roles`: role names
- `permissions`: resolved permission strings

At request time, `JwtStrategy` resolves the authenticated actor as `req.user` with:
- `req.user.id` (user id)
- `req.user.roles` (role names)
- `req.user.permissions` (strings)

## Login flow (`POST /auth/login`)

### Behavior

1) Lookup user by `email` OR `phone`.
2) (Optional, feature-flagged) If `ENABLE_PENDING_REGISTRATIONS === 'true'`, block login if a matching `PendingRegistration` is still `PENDING`.
3) Enforce lockout:
   - After **5** failed attempts, user is locked for **15 minutes** (`lockedUntil`).
4) If password is valid:
   - resets `loginAttempts` and clears `lockedUntil`
   - updates `lastLoginAt`
5) For non-admin users, enforce active community access:
   - SUPER_ADMIN and MANAGER skip this check.
   - Otherwise the user must have at least one ACTIVE `UnitAccess` record (else 403).
6) Issue tokens via `generateTokens(...)` (access + refresh).

### Outputs

Returns `{ accessToken, refreshToken }`.

## Refresh flow (`POST /auth/refresh`)

This endpoint rotates refresh tokens:

- The backend fetches the latest non-revoked refresh token for the `userId`.
- If the incoming token does not match (bcrypt compare) OR the stored token is expired:
  - all refresh tokens for the user are revoked
  - 401 is returned
- If it matches:
  - that refresh token is revoked
  - a new access token + refresh token are issued

## Password reset flow

### Request reset (`POST /auth/forgot-password`)

- Accepts either `email` or `phone`.
- Always returns a generic success message to avoid user enumeration.
- If a matching user exists and they have an email address, a reset link is sent via `NotificationsService` using the `EMAIL` channel.
- The raw token is never stored; only a hash/digest is stored in `PasswordResetToken`.
- Token lifetime: **1 hour**.

### Reset password (`POST /auth/reset-password`)

- Validates the token against a stored, un-used, un-expired `PasswordResetToken`.
- On success:
  - marks the reset token as used
  - updates the user password hash
  - revokes all refresh tokens for the user

## Email verification flow

### Send verification token (`POST /auth/send-email-verification`)

JWT-protected endpoint that:

- Invalidates previous un-used email verification tokens for the user.
- Creates a new `EmailVerificationToken` (1 hour TTL).
- Sends an email containing the token (and a link) using the `EMAIL` channel.

### Verify email (`POST /auth/verify-email`)

JWT-protected endpoint that:

- Reads the latest un-used, un-expired `EmailVerificationToken` for the user.
- Validates the provided token (bcrypt compare).
- Marks the token as used and sets `User.emailVerifiedAt`.

## Phone OTP verification flow

### Send OTP (`POST /auth/send-phone-otp`)

JWT-protected endpoint that:

- Ensures the provided `phone` matches the user profile.
- Creates a `PhoneVerificationOtp` (5 minute TTL).
- Sends a notification with channel `SMS`.

Important: actual SMS delivery depends on notification delivery support (see `src/modules/notifications/notification-delivery.listener.ts`).

### Verify OTP (`POST /auth/verify-phone-otp`)

JWT-protected endpoint that:

- Reads the latest un-used, un-expired OTP for the user.
- Validates the provided OTP (bcrypt compare).
- Marks OTP as used and sets `User.phoneVerifiedAt`.

## Referral signup (feature-flagged)

`POST /auth/signup-with-referral`:

- Returns 404 unless `ENABLE_REFERRAL_SIGNUP === 'true'`.
- Atomically:
  - validates an existing referral for the phone
  - creates a new user (`signupSource='referral'`)
  - converts the referral
  - issues tokens
- After commit, emits `referral.converted` to drive in-app/email notifications.

## Configuration

Environment variables used by this module:

- `JWT_ACCESS_SECRET`
- `FRONTEND_URL` (used to build reset/verification links)
- `ENABLE_PENDING_REGISTRATIONS` (default: false)
- `ENABLE_REFERRAL_SIGNUP` (default: false)

## Relevant code entry points

- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/jwt.strategy.ts`
- `src/modules/auth/guards/jwt-auth.guard.ts`
- `src/modules/auth/guards/permissions.guard.ts`
