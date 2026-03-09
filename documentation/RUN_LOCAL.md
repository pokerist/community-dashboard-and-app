# Run Local (Backend + Admin + Mobile)

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL (local or remote)
- Expo Go (for mobile testing)

## 1) Backend

From repo root:
```bash
npm install
npm run db:init:fresh
npm run start:dev
```

Backend URLs (default local):
- API: `http://127.0.0.1:3001`
- Swagger: `http://127.0.0.1:3001/api`

### Optional local demo data
```bash
npm run seed:mobile-personas
npm run seed:dashboard-load
```

## 2) Admin Dashboard

```bash
cd apps/admin-web
npm install
```

Create env:
```bash
cp .env.production.example .env.local
```

Set:
```env
VITE_API_BASE_URL=http://127.0.0.1:3001
```

Run:
```bash
npm run dev
```

## 3) Resident Mobile (Expo)

```bash
cd apps/community-mobile-native
npm install
```

Create env:
```bash
cp .env.example .env
```

Set API URL:
- iOS simulator / web:
```env
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:3001
```
- Android emulator:
```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001
```
- Physical device on same Wi-Fi:
```env
EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:3001
```

Run:
```bash
npx expo start -c
```

## Demo Accounts

Baseline:
- `test@admin.com / pass123`
- `manager@test.com / pass123`
- `residentA@test.com / pass123`
- `residentB@test.com / pass123`

Additional personas (after `npm run seed:mobile-personas`):
- `owner.demo@test.com / pass123`
- `tenant.demo@test.com / pass123`
- `preowner.demo@test.com / pass123`
- `family.demo@test.com / pass123`
- `authorized.demo@test.com / pass123`
- `contractor.demo@test.com / pass123`

## Local Smoke Checks

### Backend/API
```bash
curl http://127.0.0.1:3001/api
```

### Mobile persona smoke (PowerShell)
```bash
npm run smoke:mobile-personas
```

## Common Issues

### Prisma `DIRECT_URL` not found
- Ensure the env file used by your shell includes both:
  - `DATABASE_URL`
  - `DIRECT_URL`

### Mobile image/file/banner issues
- Verify backend file/public routes are reachable
- Restart Expo with cache clear:
```bash
npx expo start -c
```

### Unauthorized after idle (mobile)
- Ensure refresh token flow is working and backend reachable
- Mobile now retries with refresh and can fall back to login + biometric quick login
