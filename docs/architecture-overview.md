# Architecture Overview

## Objective
Stabilize the current working local development stack and prepare a clean path for fresh deployment, without forcing infrastructure migration (especially storage).

## Stack
- Backend: NestJS + Prisma + PostgreSQL (`src`, `prisma`)
- Admin Web: React + Vite (`apps/admin-web`)
- Mobile client (actual): Expo React Native (`apps/community-mobile-native`)
- Notifications: in-app + push (FCM/Expo) + email/SMS routing (`src/modules/notifications`)
- Auth: JWT access tokens + DB refresh tokens + Firebase OTP verification (`src/modules/auth`)
- Storage abstraction: LOCAL/S3/SUPABASE runtime-configured (`src/modules/file` + `src/modules/system-settings/integration-config.service.ts`)

## Runtime Topology
1. Admin and mobile call backend HTTP APIs.
2. Backend modules execute domain logic.
3. Prisma persists to PostgreSQL.
4. Notifications module fans out to in-app logs and external channels.
5. File module resolves storage provider at runtime; falls back to local-compatible mode when provider config is incomplete.

## Current Domain Grouping (recommended)
- Identity & Access: `auth`, `users`, `pending-registrations`, `approvals`, `referrals`
- Residential: `communities`, `units`, `leases`, `owners`, `delegates`, `household`, `rent-requests`, `rental`
- Operations: `service`, `service-field`, `service-request`, `complaints`, `violations`, `incidents`, `reports`, `dashboard`
- Facilities & Access: `facilities`, `bookings`, `clubhouse`, `access-control`, `gates`, `fire-evacuation`, `resident-vehicles`, `workers`, `commercial`, `compound-staff`
- Engagement & Content: `notifications`, `banners`, `marketing`, `survey`, `ordering`, `hospitality`, `help-center`, `discover`, `news`
- Platform Infrastructure: `file`, `system-settings`, `prisma`, `events`

## Key Architectural Truths
- `User + Unit + UnitAccess` is the effective authorization core.
- `ResidentUnit` exists but is explicitly marked legacy in schema comments; do not use for access checks.
- Canonical hierarchy is now `Community -> Phase -> Cluster` with optional unit placement at any level.
- `apps/community-mobile` should be treated as UI/reference; the real client contract target is `apps/community-mobile-native`.

## Cross-Cutting Risks (current)
- `AuthService` and `NotificationsService` are large orchestration services (high coupling).
- Route-contract drift exists in some admin calls (for example settings and rental request variants).
- Some docs under `documentation/` are historical and can drift from current code.

## Fresh Deploy Principle
- Keep existing flow (`prisma db push` + seed) for local and current deployment scripts.
- Introduce migration-safe production path gradually (see `docs/deployment-production-plan.md`), without breaking current developer workflow.
