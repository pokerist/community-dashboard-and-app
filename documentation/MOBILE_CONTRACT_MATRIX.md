# Mobile Contract Matrix (Backend/Admin Source of Truth)

Scope:
- source = backend controllers + admin web API clients
- excludes mobile app source code per handover request

Legend:
- `implemented`: backend route exists and admin usage aligns
- `implemented-different-shape`: backend exists but admin expects different path/query/shape
- `missing`: admin expects route not implemented in backend
- `deprecated`: legacy path still used by some client code but replaced by canonical route

## 1) Canonical Mobile-Facing Contracts

| Contract | Purpose | Status |
|---|---|---|
| `GET /mobile/app-config` | branding + onboarding + offers + mobileAccess + integration capabilities | implemented |
| `GET /auth/me` | user bootstrap with persona hints + permissions + featureAvailability + units | implemented |
| `GET /mobile/screen-manifest` | explicit screen visibility/actions manifest derived from auth + settings | implemented |

### `/mobile/screen-manifest` response contract (canonical)
- `data.resolvedPersona`
- `data.screens[]`:
  - `key`
  - `visible`
  - `enabledActions[]`
  - `requiredPermissions[]`
  - `personaGuards[]`
  - `featureFlagSource`
- `meta.version`
- `meta.generatedAt`
- `meta.mobileAccessUpdatedAt`

## 2) Admin Web -> Backend Endpoint Alignment Matrix

| Domain | Admin-used Endpoint | Backend Route Reality | Status | Notes / Remediation |
|---|---|---|---|---|
| Auth | `POST /auth/login` | exists | implemented | login ok |
| Auth | `POST /auth/refresh` | exists | implemented | token rotation |
| Auth | `GET /auth/me` | exists | implemented | use as bootstrap source |
| Mobile config | `GET /mobile/app-config` | exists | implemented | includes capabilities |
| Mobile manifest | `GET /mobile/screen-manifest` | now exists | implemented | new explicit contract |
| System settings | `GET /system-settings` | exists | implemented | guarded by admin permissions |
| System settings | `GET /admin/settings` | no controller route | missing | use `/system-settings` or add alias route |
| Users (admin) | `/admin/users*` | exists | implemented | canonical admin user surface |
| Users (generic) | `GET /users` | no generic `/users` controller | missing | replace client calls with `/admin/users/*` or users-hub routes |
| Units | `GET /units` | exists | implemented | requires proper query dto |
| Units (variant query) | `GET /units?page=1&limit=500` in contexts producing 404 | route exists but not all query variants accepted consistently across client assumptions | implemented-different-shape | normalize query builder to backend-supported params |
| Invoices | `GET /invoices` | exists | implemented | list dto required |
| Invoices | `GET /invoices/stats` | exists | implemented | dashboard billing stats |
| Invoices | `GET /invoices/payments` | no route in invoices controller | missing | either add endpoint or reuse `/invoices` with status filters |
| Rental | `GET /rental/requests` | exists | implemented | canonical rent requests list |
| Rental | `GET /rental/rent-requests` | not in rental controller | implemented-different-shape | align admin client to `/rental/requests` |
| Rental | `POST /rental/rent-requests/:id/approve` | not in rental controller | implemented-different-shape | canonical: `POST /rental/requests/:id/approve` |
| Rental | `POST /rental/rent-requests/:id/reject` | not in rental controller | implemented-different-shape | canonical: `POST /rental/requests/:id/reject` |
| Complaints | `/complaints*` + `/complaints/stats` | exists | implemented | core lifecycle present |
| Violations | `/violations*` + `/violations/stats` | exists | implemented | appeal/action flows present |
| Services | `/services*`, `/service-requests*`, `/services/stats` | exists | implemented | includes dynamic fields |
| Notifications | `/notifications*`, `/notifications/admin/all` | exists | implemented | admin + personal consumption paths |
| Gates | `/gates*`, `/gates/logs`, `/gates/stats` | exists | implemented | gate analytics and logs |
| Communities | `/communities*` | exists | implemented | management and stats |
| Commercial | `/commercial/entities*` | exists | implemented | entities and memberships |
| Survey | `/surveys*` | exists | implemented | authoring + analytics |
| Marketing | `/marketing/*`, `/banners` | exists | implemented | referrals/projects/banners |

## 3) Immediate Contract Hardening Actions

1. Standardize Admin client to canonical routes:
- rental requests: move to `/rental/requests` variants
- avoid generic `/users` in billing/other modules; use scoped admin/user endpoints
- remove dependence on `/admin/settings` unless alias route is intentionally added

2. Add endpoint compatibility policy:
- any renamed route keeps backward alias for one release window, then deprecate formally

3. Add route-contract smoke tests:
- list all admin-used routes and verify status code + minimal response shape

## 4) Settings + Visibility Contract Rules

1. `GET /mobile/app-config` is public, non-user-specific configuration.
2. `GET /auth/me` is user-specific capability and persona context.
3. `GET /mobile/screen-manifest` is the final UI visibility contract and must be consumed by clients for show/hide and action gating.
4. Backend remains the source of truth for feature visibility; client-side flags are presentation only.

## 5) Deployment and Readiness Validation Checklist

- Backend up and healthy: `/api` reachable
- Admin points to correct API base URL
- Auth and settings contracts validated:
  - `/auth/login`
  - `/auth/me`
  - `/mobile/app-config`
  - `/mobile/screen-manifest`
- Notification providers checked for intended mode (mock/live)
- File public routes verified for brand logo path
- Route matrix smoke run passes with no unexpected 404s
