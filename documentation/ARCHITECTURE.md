# Full-Stack Architecture (Backend + Admin + Mobile)

## Summary

The platform is a modular monolith backend with two client applications:
- **Admin Dashboard** (`apps/admin-web`)
- **Resident Mobile App** (`apps/community-mobile-native`)

Both clients consume the same backend API (NestJS), with role-based behavior and audience-specific UX.

## Components

### 1) Backend API (NestJS)
- Entry point: `src/main.ts`
- Modules wired in: `src/app.module.ts`
- Persistence: PostgreSQL via Prisma (`prisma/schema.prisma`)
- Core capabilities:
  - auth + RBAC + permissions
  - units / leases / owners
  - services / service-fields / service-requests
  - complaints / violations / incidents
  - invoices / fees / payment simulation
  - bookings / facilities
  - QR access
  - notifications (personal + community updates)
  - file upload / streams
  - system settings + white-label brand
  - reports + scheduling

### 2) Admin Dashboard (React + Vite)
- Path: `apps/admin-web`
- Uses `VITE_API_BASE_URL`
- Main responsibilities:
  - operational management (units, services, complaints, violations, bookings)
  - notification authoring (personal + community presets)
  - ticket operations (service/request + complaint replies/status)
  - system settings (including brand)
  - analytics/reports

### 3) Resident Mobile (Expo / React Native)
- Path: `apps/community-mobile-native`
- Uses `EXPO_PUBLIC_API_BASE_URL`
- Main responsibilities:
  - resident workflows (services/requests, complaints, QR, finance, bookings)
  - personal notifications + community updates
  - ticket comments and status visibility
  - household management (role/capability gated)
  - white-label branding bootstrap on app launch

## High-Level Data Flow

### Auth / Session
1. Mobile/Admin -> `POST /auth/login`
2. Backend returns access + refresh tokens
3. Clients call protected endpoints with bearer token
4. On access expiry, client refreshes via `POST /auth/refresh`
5. Mobile `/auth/me` bootstrap resolves persona + feature availability

### Ticketing (Services/Requests)
1. Resident submits request -> `POST /service-requests`
2. Backend creates ticket + emits events
3. Notifications generated for resident/admin (where configured)
4. Admin opens ticket (inbox UI), changes status, replies/comments
5. Resident sees status/comments + receives deep-linkable notifications

### Complaints
1. Resident creates complaint -> `POST /complaints`
2. Admin manages complaint in dashboard (`Complaints & Violations`)
3. Admin public comments / status changes trigger resident notifications
4. Mobile opens complaint details directly via deep link payload

### Community Updates
1. Admin authors update in Notification Center using presets
2. Backend stores notifications with payload route/entity metadata
3. Mobile filters general-audience notifications into `Community Updates`
4. Personal notifications remain under bell icon

### Branding (White-label)
1. Admin updates brand settings -> `PATCH /system-settings/brand`
2. Backend stores brand config in system settings
3. Mobile bootstraps via `GET /mobile/app-config`
4. Mobile applies colors/logo/name with cached fallback

## Notification Model (Conceptual)

Backend stores a generic `Notification` + `NotificationLog` delivery records.

Notification payload is used by mobile deep-linking:
- `route`
- `entityType`
- `entityId`
- `openInAppLabel`
- `ctaLabel`
- `externalUrl`

This supports:
- personal notifications
- community updates
- push taps / in-app taps
- direct entity opening (ticket, invoice, complaint, booking, QR)

## Role / Persona Mapping (Mobile)

Backend computes persona hints in `/auth/me`:
- `resolvedPersona`
- `featureAvailability`
- flags like `isOwner`, `isTenant`, `isFamily`, `isDelegate`, `isPreDeliveryOwner`, `canManageWorkers`

Mobile uses these hints to:
- gate drawer items
- hide unsupported actions
- choose screens/sections

See `documentation/MOBILE_PERSONAS.md`.

## Deployment Topology (Recommended)

### Runtime (server)
- PM2 process `community-backend` on `4003`
- PM2 process `community-admin-web` on `4002`

### Public access (recommended)
- Nginx/Caddy reverse proxy
- `community-admin.<domain>` -> `127.0.0.1:4002`
- `community-api.<domain>` -> `127.0.0.1:4003`
- HTTPS via Let's Encrypt

See `documentation/DEPLOYMENT.md`.

## Operational Scripts

Important scripts:
- `deploy.sh` -> wrapper for PM2 deployment
- `scripts/deploy/deploy-admin-stack.sh` -> actual deployment flow
- `scripts/seed-mobile-personas.ts`
- `scripts/reset-dashboard-data.ts`
- `scripts/mobile-persona-smoke.ps1`
- `scripts/deploy/smoke-admin-stack.sh`

## Known Boundaries / Intentional Tradeoffs

- Community Updates currently reuse Notifications storage (fast and practical for MVP)
- Expo Push is supported; FCM direct requires native mobile build setup
- Some admin experiences are functional but still distributed (not unified inbox yet)
- Demo payment is simulation (state changes invoice to `PAID`, no real gateway)
