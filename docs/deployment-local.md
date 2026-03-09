# Deployment Local

## Goal
Keep local developer workflow unchanged and reliable.

## Backend
```bash
npm install
npm run db:init:fresh
npm run start:dev
```

Notes:
- Uses Prisma `db push` path (`db:init:fresh` script).
- Seeds baseline data using configured seed script.
- Swagger at `/api` on backend port.

## Admin Web
```bash
cd apps/admin-web
npm install
npm run dev
```

Default backend expectation in admin client is `http://localhost:4003` unless `VITE_API_BASE_URL` overrides it.

## Mobile (real app)
```bash
cd apps/community-mobile-native
npm install
npx expo start -c
```

## Local Smoke Checklist
1. Backend up and Swagger reachable.
2. Admin login works and dashboard loads.
3. Mobile login + `/auth/me` works.
4. Bookings/complaints/violations core screens load without 404.
5. File upload/download works in local storage mode.

## Failure Triage
- 401 loops: check token refresh + sessionVersion invalidation conditions.
- 404 from admin: verify route family drift (`/system-settings`, rental routes).
- Upload errors: verify integration storage provider config and local fallback logs.
