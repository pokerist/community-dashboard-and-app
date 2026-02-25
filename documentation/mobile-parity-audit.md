# Mobile Parity Audit (Source -> Expo Native -> Backend)

## Scope
- Source of truth (visual + nav): `figma.site` + `apps/community-mobile`
- Target app: `apps/community-mobile-native`
- Backend: current NestJS API in this repo

## Persona Mapping (Source -> Backend)
| Source Persona | Backend Mapping | Status |
|---|---|---|
| Owner | `COMMUNITY_USER` + `UnitAccess(OWNER)` (+ owner profile) | `done` |
| Tenant | `COMMUNITY_USER` + `UnitAccess(TENANT)` / active lease | `done` |
| Pre-delivery Owner | `OWNER` access on `Unit.status = NOT_DELIVERED` | `done` |
| Family | `COMMUNITY_USER` + `UnitAccess(FAMILY)` | `done` |
| Authorized | `Delegate` (`UnitAccess(DELEGATE)`) | `done` |
| Contractor | `Delegate + canManageWorkers` (+ contractor/workers records) | `done` |

## Navigation Parity
| Item | Source | Native | Status | Notes |
|---|---|---|---|---|
| Bottom Nav | `Home`, `QR Codes`, `Profile` | same | `done` | Matched to source structure |
| Hamburger on Home | yes | yes | `done` | Opens drawer |
| Drawer menu | yes | yes | `in_progress` | spacing/overlay tuned; ongoing visual parity |
| Hidden routes via drawer | yes | partial | `in_progress` | requests/services/complaints/finance wired |

## Screen/Feature Matrix
| Screen / Feature | Personas (expected) | Backend endpoints | Native Status | Backend Status | Notes |
|---|---|---|---|---|---|
| Onboarding | all | none | `done` | n/a | visual parity in progress |
| Login | all | `POST /auth/login`, `POST /auth/refresh` | `done` | `done` | functional |
| Register (pending request) | all | `POST /signup`, `POST /files/upload/public-signup-photo` | `in_progress` | `done` | public signup photo upload added; UX still can be polished |
| Home | all | `/auth/me`, multiple summary endpoints | `in_progress` | `done` | live snapshot wired |
| Home banners | all (filtered) | `GET /banners/mobile-feed` (`/mobile` alias) | `done` | `done` | route conflict fixed, active/date/audience filtered |
| QR Codes | owner/tenant/family/authorized | `/access-qrcodes` | `done` | `done` | role gating in progress |
| Services | allowed community personas | `/services`, `/service-fields`, `/service-requests/*` | `done` | `done` (after permission patch/reseed) | fixed forbidden fallback |
| Complaints | allowed personas | `/complaints/me`, `/complaints` | `done` | `done` | |
| Bookings | delivered/eligible personas | `/facilities`, `/bookings/*` | `done` | `done` | UI parity in progress |
| Payments / Finance | allowed personas | `/invoices/me`, `/violations/me` | `done` | `done` | needs persona gating polish |
| Notifications | all | `/notifications/me`, `PATCH /notifications/:id/read` | `done` | `done` | |
| Profile | all | `GET /auth/me` | `done` | `done` | persona hints added |
| Household hub | owner/tenant/authorized/contractor | `owners/family`, `delegates`, `contractors`, `workers` | `in_progress` | `done` | Lists + family add/remove/edit + delegate create-by-contact/revoke/edit permissions + contractor/worker create + worker QR |
| Smart Home | role-based | n/a or limited | `hidden/gated` | `partial` | intentionally hidden |
| Discover / Help | role-based | none | `hidden/gated` | n/a | intentionally hidden |

## Permissions Audit (Mobile-critical)
| Endpoint | Problem | Fix | Status |
|---|---|---|---|
| `GET /services` | `COMMUNITY_USER` missing `service.read` caused `403` | Added fallback permission in controller + added `service.read` to seed | `done` |
| `GET /service-fields?serviceId=...` | `COMMUNITY_USER` missing `service_field.read` likely causes `403` | Added fallback permission in controller + added `service_field.read` to seed | `done` |

## Backend Additions for Mobile Parity
| Item | Status | Notes |
|---|---|---|
| `GET /auth/me` bootstrap | `done` | already existed; extended with `personaHints` + `featureAvailability` |
| `GET /banners/mobile` | `done` | active/date/audience filtered for authenticated resident |
| Public signup photo upload | `done` | `POST /files/upload/public-signup-photo` |
| Household aggregate endpoint (`/mobile/household/...`) | `planned` | optional but recommended for mobile UX |

## Demo Data / Seed Gaps
- `COMMUNITY_USER` permissions updated in `prisma/seed.ts` (`service.read`, `service_field.read`).
- Persona-specific demo accounts are seeded via `npm run seed:mobile-personas`.
- Script also seeds demo banner + active service + facility slot configs for mobile flows.
- Persona smoke check script available: `npm run smoke:mobile-personas` (backend must be running).

## Next Recommended Implementation Steps
1. Finalize Household UX polish (multi-step forms / edit affordances).
2. Expand role-based gating to remaining edge cases across all screens.
3. Full visual parity pass (screen-by-screen screenshots vs `figma.site`).
4. Optional household aggregate endpoint for performance (`/mobile/household/...`).
5. End-to-end persona smoke automation script.
