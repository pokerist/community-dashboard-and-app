# Mobile Backend Contract

Scope: contract check between `apps/community-mobile-native` service calls and backend controllers. Source code is truth.

## Status Legend
- `working as-is`
- `mismatched`
- `deprecated/legacy path`
- `needs adapter layer`

## High-Priority Contract Findings

| Area | Mobile calls | Backend routes | Status | Notes |
|---|---|---|---|---|
| Auth refresh | `POST /auth/refresh` | `POST /auth/refresh` | working as-is | Request requires `{ userId, refreshToken }` |
| Auth bootstrap | `GET /auth/me` | `GET /auth/me` | working as-is | Returns persona hints + feature availability |
| Bookings | `/bookings/me`, `/bookings`, `/bookings/:id/cancel` | same routes in `bookings.controller.ts` | working as-is | Permissions required server-side |
| Complaints | `/complaints/me`, `/complaints`, `/complaints/:id`, `/complaints/:id/comments` | same routes in `complaints.controller.ts` | working as-is | Mobile maps `body -> description` on create |
| Violations | `/violations/me`, `/violations/:id/actions` | same routes in `violations.controller.ts` | working as-is | Action payload supports appeal/fix |
| Units listing | `GET /units/my` | `GET /units/my` | working as-is | Supports query pagination/filter |
| Mobile config | `GET /mobile/app-config` | `GET /mobile/app-config` | working as-is | Includes runtime capabilities |
| Screen manifest | `GET /mobile/screen-manifest` | `GET /mobile/screen-manifest` | working as-is | Persona + permissions + feature flags |

## Cross-Client Drift (important for stability)
These are not mobile blockers only, but they cause ecosystem instability and documentation drift.

| Area | Observed client call | Backend truth | Status | Recommended action |
|---|---|---|---|---|
| System settings (admin) | `/admin/settings` | `/system-settings` | mismatched | Update admin client to canonical `/system-settings*` routes |
| Rental approvals (admin) | `/rental/rent-requests/*` | `/rental/requests/*` and `/rent-requests/*` | mismatched + duplicated families | Consolidate to one canonical route family and deprecate the other |

## Quick Safe Fixes
- Replace admin `/admin/settings` usage with `/system-settings` endpoints.
- Normalize rental request routes in admin service to current backend canonical set.
- Keep temporary compatibility wrappers only if needed short-term; document deprecation date.

## Risky Changes (defer until protected by tests)
- Rewriting mobile payload shapes broadly without e2e contract tests.
- Removing old rental routes before admin web is fully switched.

## Recommended Contract Test Matrix
1. `auth/login -> auth/refresh -> auth/me` happy path.
2. Bookings CRUD-lite (`me`, `create`, `cancel`).
3. Complaints (`me`, `create`, `detail`, `comments`).
4. Violations (`me`, `actions/list`, `actions/create`).
5. `mobile/app-config` and `mobile/screen-manifest` visibility checks per persona.
