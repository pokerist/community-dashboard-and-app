# PM Handover Review (Backend + Admin)

## 1) Executive Summary
This platform is a modular NestJS backend with an Admin Web control panel used to operate a gated community product across property, people, access, operations, finance, and communication domains.

Primary delivery channels in current scope:
- Backend API: `src/` + `prisma/`
- Admin Web: `apps/admin-web`

Primary objective for handover owner:
- run and deploy the current stack reliably
- understand system logic and data ownership
- keep backend contracts consistent for admin and mobile consumers

## 2) Product Capability Inventory (Current State)
### Identity and access
- JWT auth + refresh lifecycle (`/auth/login`, `/auth/refresh`, `/auth/me`)
- RBAC (`Role`, `Permission`, `UserRole`) + endpoint permission guards
- Unit-scoped authority via `UnitAccess` (owner, tenant, family, delegate)

### Property and residency
- Community/cluster/unit management
- Resident/owner/tenant/admin management via `/admin/users/*`
- Lease and rent request workflows (`/rental/*`, `/leases/*`, `/rent-requests/*`)

### Operations
- Services + service requests
- Complaints + violations + incidents
- Facilities + bookings
- Gates + gate logs + access-control QR
- Workers/contractors/compound staff flows

### Financials
- Invoice CRUD and status lifecycle
- Unit fee ingestion and invoice generation
- Rent-related dashboard/rental statistics

### Communication and engagement
- Notification center (in-app + provider capabilities)
- News, marketing, surveys

### System configuration
- Settings sections in `SystemSetting` JSON model
- Brand, onboarding, offers, mobileAccess policy
- Mobile-facing config endpoint: `GET /mobile/app-config`
- Integration readiness/status (SMTP/SMS OTP/FCM/S3) via integration service

## 3) Core Data Logic (DB-first View)
### Core entities
- `User`: identity, auth state, profile, role links
- `Role`, `Permission`, `UserRole`: authorization matrix
- `Unit`: property object (community/cluster binding)
- `UnitAccess`: authority and feature capabilities per user per unit
- `Lease`: owner-tenant legal occupancy link
- `ServiceRequest`, `Complaint`, `Violation`, `Booking`: operational records
- `Invoice`: financial ledger item with optional source link (service/violation/booking/etc.)
- `Notification`, `NotificationLog`: communication payload and delivery tracking
- `SystemSetting`: config sections (brand/mobileAccess/onboarding/offers/integrations)

### Business precedence
- Effective persona/visibility is computed from:
  1. profile + active unit access roles
  2. permission set
  3. mobileAccess policy from `SystemSetting`
- Finance/QR/household capabilities require both role permissions and unit access constraints.

## 4) Deploy-from-Zero Runbook (Operator)
### A) Minimum prerequisites
- Node.js (20+ recommended)
- PostgreSQL reachable by backend
- environment files:
  - root `.env`/`.env.production`
  - `apps/admin-web/.env.local` or `.env.production`

### B) Startup order (local/dev)
1. DB up and reachable
2. backend schema + seed: `npm run db:init:fresh:reset`
3. backend run: `npm run start:dev` or `npm run start:prod`
4. admin run: `cd apps/admin-web && npm run dev`

### C) Startup order (server/PM2)
1. configure `.env.production` and `apps/admin-web/.env.production`
2. run `./deploy.sh`
3. validate PM2 processes:
   - `community-backend`
   - `community-admin-web`
4. smoke check:
   - backend health/swagger: `/api`
   - admin page reachable

### D) Environment minimums
- Required backend:
  - `DATABASE_URL`, `DIRECT_URL`, `PORT`, `JWT_ACCESS_SECRET`
- Required admin:
  - `VITE_API_BASE_URL`
- Optional providers (can run mock mode): SMTP, Twilio/SMS, FCM, Expo push, S3/Supabase storage

### E) Health checks
- HTTP:
  - backend: `GET /api`
  - admin: root page
- functional:
  - login with seeded admin
  - dashboard stats endpoints
  - settings read/write smoke

## 5) Operational Checklist for Handover Owner
### Daily/Release checks
- Verify DB migration/push status
- Verify API base URL alignment with admin build env
- Verify CORS origin configuration for deployed admin domain
- Verify notification providers in intended mode (mock/live)
- Verify file storage provider and public file routes

### Incident checks
- 401 spikes: token refresh flow and secret mismatch
- 404 spikes: admin endpoint contract drift
- notification failures: provider credentials and connectivity
- empty dashboards: seed/data freshness and permissions

### Monitoring baseline
- PM2 process health
- backend logs for auth/permission failures
- DB connection saturation
- notification delivery failure ratio

## 6) Known Contract Risks (Current)
- Endpoint shape drift exists between some admin service clients and backend routes.
- Some admin sections call legacy/unscoped routes (`/users`, `/admin/settings`, rent-request variants) causing 404 in runtime tests.
- Recommendation: keep a single source-of-truth matrix and enforce route contract smoke tests in CI.

## 7) What Is Reusable Immediately
- Existing modular backend already supports most community operating needs.
- Current settings model already supports mobile branding, onboarding, offers, and persona access policy.
- New endpoint `GET /mobile/screen-manifest` now provides explicit screen visibility/actions contract for clients.

## 8) Handover Decision Notes
- Keep monolith structure; no architecture split needed for next phase.
- Prioritize API contract hardening over adding new modules.
- Treat admin and mobile as API clients against one canonical backend contract.
