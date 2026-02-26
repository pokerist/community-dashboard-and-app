# Environment Variable Matrix

This document lists runtime configuration by app:
- Backend API (NestJS)
- Admin Web (Vite)
- Resident Mobile (Expo)

## Backend (`.env` / `.env.production`)

### Required (core runtime)
- `PORT` — API port (default deployment uses `4003`)
- `DATABASE_URL` — Prisma DB connection
- `DIRECT_URL` — Prisma direct DB connection (required by schema)
- `JWT_ACCESS_SECRET` — access token signing secret

### Required in production (file features)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Recommended integration URLs
- `CORS_ORIGIN` — admin dashboard origin
- `FRONTEND_URL` — admin URL (used in certain links/flows)

### Feature flags / behavior
- `ENABLE_PENDING_REGISTRATIONS`
- `ENABLE_REFERRAL_SIGNUP`
- `QR_ENFORCE_SINGLE_ACTIVE`

### Notification providers
#### SMTP (email)
- `FROM_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_MOCK_MODE=true|false`

#### Twilio (SMS)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `TWILIO_MOCK_MODE=true|false`

#### FCM (native push / direct device tokens)
Option A:
- `FCM_SERVICE_ACCOUNT_JSON`

Option B:
- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`

Flags:
- `FCM_MOCK_MODE=true|false`

#### Expo Push (Expo tokens)
- `EXPO_PUSH_ACCESS_TOKEN`
- `EXPO_PUSH_MOCK_MODE=true|false`

### HikCentral / Access Integration
- `HIKCENTRAL_MOCK`
- `HIKCENTRAL_BASE_URL`
- `HIKCENTRAL_API_KEY`
- `HIKCENTRAL_QR_CREATE_PATH`

### Zero-touch local demo deploy helper (server script)
- `AUTO_LOCAL_DB_PASSWORD` (written by deploy script when local DB is auto-provisioned)

## Admin Web (`apps/admin-web/.env.production` or `.env.local`)

### Required
- `VITE_API_BASE_URL`

Examples:
- Local: `http://127.0.0.1:3001`
- Direct-port server: `http://108.61.174.92:4003`
- Recommended production: `https://community-api.example.com`

## Resident Mobile (`apps/community-mobile-native/.env`)

### Required
- `EXPO_PUBLIC_API_BASE_URL`

Examples:
- Android emulator: `http://10.0.2.2:3001`
- iOS simulator/web: `http://127.0.0.1:3001`
- Device on LAN: `http://<LAN-IP>:3001`
- Production (recommended): `https://community-api.example.com`

## Deployment Script Flags (`deploy.sh` / `scripts/deploy/deploy-admin-stack.sh`)

### Ports / targets
- `SERVER_IP` (default `108.61.174.92`)
- `FRONTEND_PORT` (default `4002`)
- `BACKEND_PORT` (default `4003`)
- `API_URL`
- `ADMIN_URL`

### Bootstrap behavior
- `AUTO_BOOTSTRAP_SERVER=true|false`
- `AUTO_OPEN_FIREWALL_PORTS=true|false`
- `AUTO_PM2_STARTUP=true|false`
- `AUTO_INSTALL_POSTGRES=true|false`
- `AUTO_PROVISION_LOCAL_DB=true|false`
- `AUTO_LOCAL_DB_TRUST_AUTH=true|false`
- `NODE_MAJOR` (default `20`)

### Post-deploy checks
- `HEALTH_CHECK_AFTER_DEPLOY=true|false`
- `API_HEALTH_PATH` (default `/api`)

### Demo seeding
- `RUN_DEMO_SEEDS=true|false`
- `RUN_DASHBOARD_LOAD_SEED=true|false`

## Notes

1. `DIRECT_URL` is required because Prisma schema uses `directUrl`.
2. Do not `source` env files manually in a shell if values contain `&` (for example DB socket URL query parameters); use tooling/scripts that parse safely.
3. For client-facing deployments, use domain-based URLs and HTTPS for both admin and mobile.
