# SSS Community Platform (Backend + Admin Dashboard + Resident Mobile)

Full-stack community management platform for residential compounds:
- **Backend API** (NestJS + Prisma + PostgreSQL)
- **Admin Dashboard** (React/Vite)
- **Resident Mobile App** (Expo / React Native)

This repo contains the operational platform used to manage:
- units, leases, residents, owners, tenants
- bookings / facilities
- service requests + requests catalog
- complaints + violations + incidents
- invoices + payments (demo payment simulation in mobile)
- access QR codes
- notifications (personal + community updates)
- white-label mobile branding

## Repo Structure

- `src/` → NestJS backend modules and API
- `prisma/` → Prisma schema + migrations + seed
- `apps/admin-web/` → Admin dashboard
- `apps/community-mobile-native/` → Resident mobile app (Expo)
- `apps/community-mobile/` → UI reference (web design source)
- `scripts/` → local/dev/demo/deploy/smoke scripts
- `documentation/` → architecture, flows, deployment, mobile parity, and runbooks

## Quick Start (Local)

### 1) Backend
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Swagger:
- `http://127.0.0.1:3001/api` (or your configured port)

### 2) Admin Dashboard
```bash
cd apps/admin-web
npm install
npm run dev
```

### 3) Resident Mobile (Expo)
```bash
cd apps/community-mobile-native
npm install
npx expo start -c
```

Set API base URL in:
- `apps/community-mobile-native/.env`

## Demo Data / Personas

Baseline seed:
- `npx prisma db seed`

Demo personas:
- `npm run seed:mobile-personas`

Realistic dashboard load:
- `npm run seed:dashboard-load`

### Example Accounts
- Admin: `test@admin.com / pass123`
- Manager: `manager@test.com / pass123`
- Resident A: `residentA@test.com / pass123`
- Resident B: `residentB@test.com / pass123`
- Owner demo / Tenant demo / Family / Authorized / Contractor demos are created by `seed:mobile-personas`

## Deployment (PM2 + Ports)

Default direct-port deployment:
- Admin Dashboard → `4002`
- Backend API → `4003`

Entry docs:
- `documentation/DEPLOYMENT_ADMIN_PM2.md` (direct ports + PM2)
- `documentation/DEPLOYMENT.md` (domain + Nginx + HTTPS)

Quick server deploy (Ubuntu/Debian, PM2 wrapper):
```bash
./deploy.sh
```

Deployment standard:
- Always deploy using `./deploy.sh` (do not run scattered manual install/build/restart commands).
- `deploy.sh` uses `.env.production` and bootstraps it from `.env.production.example` when missing.

## Smoke Checks

Mobile persona smoke (PowerShell):
```bash
npm run smoke:mobile-personas
```

Admin/backend deployment smoke (Linux):
```bash
npm run smoke:admin-stack:linux
```

## Documentation Index

Core docs:
- `documentation/README.md`
- `documentation/FLOWS.md`
- `documentation/ARCHITECTURE.md`
- `documentation/ENV_MATRIX.md`
- `documentation/RUN_LOCAL.md`
- `documentation/RUN_DEMO.md`
- `documentation/DEPLOYMENT.md`
- `documentation/MOBILE_PERSONAS.md`
- `documentation/WHITE_LABEL_BRANDING.md`
- `documentation/NOTIFICATION_PAYLOAD_CONTRACT.md`

Product status / audits:
- `documentation/admin-demo-audit-matrix.md`
- `documentation/mobile-parity-audit.md`

## Notes

- This repo contains a large amount of product-specific customizations and demo tooling.
- Some provider integrations (SMTP/Twilio/FCM/Expo Push) can run in mock mode when credentials are missing.
- For client-facing deployments, use HTTPS + reverse proxy + domain-based CORS.
