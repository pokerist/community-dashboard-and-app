# Auth Session Flow

## Current End-to-End Flow
1. Mobile/admin login via `/auth/login`.
2. Backend verifies credentials and access eligibility.
3. Access token (JWT) + refresh token (DB-backed, hashed) are issued.
4. Client refreshes via `/auth/refresh` with `{ userId, refreshToken }`.
5. Backend rotates refresh token (revokes previous, issues new one).

## Why Sessions Can Expire Unexpectedly
- Single-session takeover behavior is active: if active session exists, login triggers takeover challenge.
- JWT carries `sessionVersion` (`sv`). If `sessionVersion` changes (e.g., takeover), old access tokens fail immediately.
- Refresh endpoint checks latest non-revoked token; invalid/old token can revoke all refresh tokens for that user.
- Hard auth failures on mobile can clear session after repeated 401/403 during refresh.

## Current Strengths
- Refresh tokens are hashed in DB.
- Token rotation is implemented.
- Session invalidation through `sessionVersion` is explicit.
- OTP-based second factors exist (login 2FA + session takeover).

## Current Gaps
- No explicit device/session inventory API for users/admin.
- No soft revoke by device model (all-or-nothing patterns exist).
- Mobile long-lived behavior depends on refresh reliability; limited observability on why refresh failed.

## Safe Incremental Improvements
- `safe now`: add session telemetry fields (last refresh IP/device/user-agent) and structured auth failure logs.
- `safe with verification`: add endpoints to list/revoke per-device sessions.
- `defer`: major token model rewrite.
- `risky/manual review`: changing takeover/single-session policy without product/security alignment.

## Local-Development Constraint
Keep current local workflow unchanged:
- no forced auth provider migration
- no mandatory external session store
- no breaking token format changes in this phase
