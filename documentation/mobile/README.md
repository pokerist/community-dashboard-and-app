# Mobile App Integration Guide

This guide is for building a mobile app (resident/community style) against this backend.
It focuses on practical integration, token handling, and screen-level API mapping.

## 1) API Connectivity Basics

- Base URL: `https://<your-domain-or-ip>`
- Swagger UI: `GET /api`
- Content type: `application/json` (except file uploads: `multipart/form-data`)
- Auth header for protected endpoints:
  - `Authorization: Bearer <accessToken>`
- Global validation is strict (`whitelist=true`, `forbidNonWhitelisted=true`), so extra fields are rejected.

## 2) Token and Session Model

- Login endpoint: `POST /auth/login`
- Refresh endpoint: `POST /auth/refresh`
- Access token:
  - JWT, `15m` expiry
  - use `sub` claim as `userId`
- Refresh token:
  - opaque value, DB-backed, rotated on each refresh
  - request body for refresh must include:
    - `userId`
    - `refreshToken`

Recommended mobile strategy:

1. Save `{accessToken, refreshToken}` securely (platform secure storage).
2. Decode `accessToken` and cache `sub` as `userId`.
3. Refresh token proactively when expiry is close, and reactively on `401`.
4. On refresh failure, clear tokens and force login.

## 3) Screen-by-Screen API Map (Community App)

## Auth and Account Screens

| Screen | API Calls | Notes |
|---|---|---|
| Login | `POST /auth/login` | Body can use `email` or `phone` + `password`. |
| Forgot password | `POST /auth/forgot-password` | Accepts `email` or `phone`. |
| Reset password | `POST /auth/reset-password` | Token comes from email/SMS flow. |
| Verify email | `POST /auth/send-email-verification`, `POST /auth/verify-email` | JWT required. |
| Verify phone | `POST /auth/send-phone-otp`, `POST /auth/verify-phone-otp` | JWT required; phone must match profile phone. |
| Referral signup (optional) | `POST /auth/signup-with-referral` | Feature-flagged by `ENABLE_REFERRAL_SIGNUP`. |

## Onboarding Screens

| Screen | API Calls | Notes |
|---|---|---|
| Signup request | `POST /signup` | Requires `personalPhotoId` and `nationalId`; creates pending registration. |
| Referral validate | `GET /referrals/validate?phone=...` | JWT required in current implementation. |

## Home and Core Community Screens

| Screen | API Calls | Notes |
|---|---|---|
| Notifications center | `GET /notifications/me`, `PATCH /notifications/:id/read` | In-app inbox and read status. |
| Facilities list | `GET /facilities` | With community permission, returns active facilities only. |
| My bookings | `GET /bookings/me` | User-scoped list. |
| Create booking | `POST /bookings` | Requires `facilityId`, `unitId`, `date`, `startTime`, `endTime`. |
| Cancel booking | `PATCH /bookings/:id/cancel` | User can cancel own booking only. |
| Service catalog | `GET /services?status=active` | Includes ordered dynamic form fields. |
| Service request form fields | `GET /service-fields?serviceId=<uuid>` | Needed when building dynamic form UI. |
| Create service request | `POST /service-requests` | Requires unit access + service eligibility + valid dynamic values. |
| My service requests | `GET /service-requests/my-requests` | User-scoped list. |
| Service request details | `GET /service-requests/:id` | Own or all-permission users. |
| Create complaint | `POST /complaints` | `reporterId` is derived from JWT. |
| Complaint details | `GET /complaints/:id` | Own complaint with `complaint.view_own`. |
| Delete complaint | `DELETE /complaints/:id` | Own complaint allowed only before resolved/closed. |
| Invoice list (self) | `GET /invoices/resident/:residentId` | With `invoice.view_own`, must match actor user id. |
| Invoice details | `GET /invoices/:id` | Own/resident and unit-access checks apply. |
| QR generation | `POST /access-qrcodes` | Requires active `UnitAccess` and `canGenerateQR=true`. |
| QR listing | `GET /access-qrcodes` | Returns by creator, or by unit with scope rules. |
| QR revoke | `PATCH /access-qrcodes/:id/revoke` | Generator or unit owner can revoke. |
| Clubhouse request | `POST /clubhouse/request-access` | Approval gate for clubhouse-managed booking flows. |
| Clubhouse access list | `GET /clubhouse/my-access` | Lists approved access records for current user. |
| Referral invite friend | `POST /referrals` | Community referral creation. |

## Owner/Delegate Operational Screens

| Screen | API Calls | Notes |
|---|---|---|
| Owner profile edit | `PATCH /owners/profile` | Own profile fields update. |
| Family list by unit | `GET /owners/family/:unitId` | Authority-aware (owner vs active tenant). |
| Add family member | `POST /owners/family/:unitId` | Requires document IDs and relationship-specific rules. |
| Update family profile | `PATCH /owners/family/:userId` | Requires owner authority on related unit. |
| Revoke family unit access | `POST /owners/units/:unitId/remove-user/:userId` | Revokes `UnitAccess(role=FAMILY)` for the unit. |
| Delegate request | `POST /delegates/request` | Owner requests delegate on unit. |
| Delegate management | `GET /delegates/unit/:unitId`, `PATCH /delegates/:id`, `POST /delegates/:id/revoke` | Owner/admin governance of delegate permissions and dates. |
| Contractors list/create | `GET /contractors`, `POST /contractors` | Delegate/admin operational access. |
| Workers list/create/update | `GET /workers?unitId=...`, `POST /workers`, `PATCH /workers/:id` | Delegate/admin operational workforce management. |
| Worker QR generation | `POST /workers/:id/qr` | Preferred worker flow instead of generic QR `type=WORKER`. |

## 4) Files and Attachments Integration

Upload first, then pass returned `fileId` to business endpoints.

- Upload endpoints:
  - `POST /files/upload/profile-photo`
  - `POST /files/upload/national-id`
  - `POST /files/upload/contract`
  - `POST /files/upload/delegate-id`
  - `POST /files/upload/worker-id`
  - `POST /files/upload/marriage-certificate`
  - `POST /files/upload/birth-certificate`
  - `POST /files/upload/service-attachment`
- Read file: `GET /files/:fileId/stream`
- Delete file: `DELETE /files/:fileId`

## 5) Are External Endpoints Ready for Mobile?

Yes. This backend already exposes REST endpoints suitable for external/mobile clients, with JWT auth and permission checks.

Production readiness checklist:

1. Deploy with HTTPS and stable domain.
2. Set all required env vars (JWT, DB, storage, notification providers, optional HikCentral config).
3. Keep RBAC role-permission mappings seeded/aligned with product roles.
4. Configure API gateway/reverse proxy limits for file uploads.
5. Monitor async email/notification jobs and failure retries.

## 6) Gaps to Address Before Full Mobile Rollout

1. Use `GET /auth/me` as the mobile bootstrap endpoint (user + roles + permissions + units + persona hints + feature flags).
2. Public signup photo upload now exists at `POST /files/upload/public-signup-photo` for pending signup request flow.
3. Community user list endpoints now exist for mobile:
   - `GET /complaints/me`
   - `GET /violations/me`
   - `GET /invoices/me`
4. `app.enableCors()` is still commented in `src/main.ts` (not a blocker for native mobile, but relevant for web clients).

## 7) Suggested Next Backend Additions (Mobile-Friendly)

1. Add a resident-safe `GET /banners/mobile-feed` contract doc to OpenAPI (currently implemented, used by mobile app).
2. Add optional household aggregate endpoint (`GET /mobile/household/units/:unitId/overview`) to reduce mobile N+1 calls.
3. Add refresh-token endpoint variant that infers user from refresh token (avoid client dependency on `userId` body).
4. Add signup public file flow for additional required docs if onboarding expands beyond personal photo.
