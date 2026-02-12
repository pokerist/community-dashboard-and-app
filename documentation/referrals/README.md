# Referrals Module (`src/modules/referrals`)

## What this module is responsible for

The Referrals module provides an invitation-style workflow:

- Community users can create referral invitations (store who invited whom).
- Admin/staff can list referrals and reject invalid ones.
- The Auth module can convert a referral during signup (links the created user to the referral and marks it as converted).

Important: the system currently does not support open/public signup. Referral-based signup is feature-flagged (see below).

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `Referral`
  - `referrerId` -> `User.id` (the inviter)
  - `friendFullName`, `friendMobile`, optional `message`
  - `status`: `NEW` | `CONTACTED` | `CONVERTED` | `REJECTED`
  - `convertedUserId` -> `User.id` (unique; a user can only be converted from one referral)

## Authentication / authorization

All routes in `ReferralsController` are guarded by:

- `JwtAuthGuard`
- `PermissionsGuard` (only enforces permissions when an endpoint has `@Permissions(...)`)

Endpoints and permissions:

- `POST /referrals` requires `referral.create`
- `GET /referrals` requires `referral.view_all`
- `PATCH /referrals/:id/reject` requires `referral.view_all`
- `GET /referrals/validate` has no `@Permissions(...)` metadata, so it only requires a valid JWT

## Feature flag: referral signup

`POST /auth/signup-with-referral` is disabled unless:

- `ENABLE_REFERRAL_SIGNUP === 'true'`

When disabled, the endpoint returns 404.

## API surface (controller)

Base route: `/referrals`

- `POST /referrals`
- `GET /referrals` (paginated; supports `status`, `referrerId`, `dateFrom`, `dateTo`)
- `GET /referrals/validate?phone=...`
- `PATCH /referrals/:id/reject`

## Flow: Create referral (`POST /referrals`)

Rules enforced in `ReferralsService.create`:

- Referrer cannot refer themselves (compares referrer phone to `friendMobile`).
- Only one "active" referral can exist per phone (`status` in `NEW|CONTACTED`).
- Referrals are created with `status=NEW`.

## Flow: Validate referral (`GET /referrals/validate`)

`ReferralsService.validateReferral(phone)` returns:

- `{ valid: false }` if no referral exists with status `NEW|CONTACTED`
- `{ valid: true, referrerName }` otherwise

## Flow: Convert referral (Auth integration)

`AuthService.signupWithReferral`:

1. Validates referral for phone.
2. Creates the user.
3. Calls `ReferralsService.convertReferral(phone, userId)` to set:
   - `status=CONVERTED`
   - `convertedUserId=userId`

## Relevant code entry points

- `src/modules/referrals/referrals.controller.ts`
- `src/modules/referrals/referrals.service.ts`
- `src/modules/referrals/dto/*.ts`
- `src/modules/auth/auth.controller.ts` (feature-flagged signup endpoint)
- `src/modules/auth/auth.service.ts` (conversion logic)

