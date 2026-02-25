# Admin + Backend Deployment (PM2, Direct Ports)

This deploy flow runs:
- Backend API on `4003`
- Admin dashboard on `4002`
- PM2 process management

Server target used in our current setup:
- `108.61.174.92`

## Files Added
- `scripts/deploy/deploy-admin-stack.sh`
- `scripts/deploy/pm2.admin-stack.ecosystem.cjs`
- `.env.production.example`
- `apps/admin-web/.env.production.example`

## One-Time Server Prerequisites
1. Install Node.js (LTS)
2. Install PM2:
   - `npm i -g pm2`
3. Install PostgreSQL (or point to managed DB)
4. Open firewall ports:
   - `4002/tcp`
   - `4003/tcp`

Example (Ubuntu + UFW):
```bash
sudo ufw allow 4002/tcp
sudo ufw allow 4003/tcp
```

## Zero-Touch Quick Start (Clone + Run)
For a fast online demo (insecure defaults, mock providers, local PostgreSQL), the script can now do almost everything automatically.

From repo root on the server:
```bash
chmod +x deploy.sh scripts/deploy/deploy-admin-stack.sh
./deploy.sh
```

What it auto-generates/configures if missing:
- `.env.production` and `apps/admin-web/.env.production`
- demo `JWT_ACCESS_SECRET` (same local demo default) if missing/placeholder
- local PostgreSQL install/start (Ubuntu/Debian)
- local DB + user + password (deterministic demo defaults) and `DATABASE_URL` / `DIRECT_URL`
- PM2 install/startup + app processes
- UFW ports `4002` / `4003` (if UFW is active)
- provider mock flags when credentials are missing

Default zero-touch demo DB values used by the script:
- DB user: `community_user`
- DB name: `community_dashboard`
- DB password: `community123` (stored in `.env.production` as `AUTO_LOCAL_DB_PASSWORD`)

## Optional Manual Env Overrides (Advanced)
If you want a real managed DB / real providers, edit these after first run:
- `.env.production`
- `apps/admin-web/.env.production`

Important production values later:
- `DATABASE_URL`, `DIRECT_URL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- SMTP / Twilio / Expo Push / FCM credentials

## Deploy Command
From repo root on the server (recommended wrapper):
```bash
chmod +x deploy.sh scripts/deploy/deploy-admin-stack.sh
./deploy.sh
```

Direct script (same result):
```bash
chmod +x scripts/deploy/deploy-admin-stack.sh
./scripts/deploy/deploy-admin-stack.sh
```

### Optional: Include Demo Data
```bash
RUN_DEMO_SEEDS=true RUN_DASHBOARD_LOAD_SEED=true ./deploy.sh
```

## What `deploy.sh` now handles automatically
- Installs server prerequisites on Ubuntu/Debian when missing (via `apt`):
  - `curl`, `git`, `build-essential`
- Installs Node.js LTS (default `20.x`) if missing
- Installs `pm2` globally if missing
- Opens firewall ports `4002` / `4003` if `ufw` is installed and active
- Configures `pm2 startup` (systemd) and saves PM2 process list

Environment toggles (optional):
- `AUTO_BOOTSTRAP_SERVER=false` → skip auto-install/bootstrap
- `AUTO_OPEN_FIREWALL_PORTS=false` → skip UFW rules
- `AUTO_PM2_STARTUP=false` → skip `pm2 startup`
- `NODE_MAJOR=20` → change Node major installer target

## PM2 Commands
```bash
pm2 status
pm2 logs community-backend
pm2 logs community-admin-web
pm2 restart community-backend
pm2 restart community-admin-web
pm2 save
```

## URLs
- Admin: `http://108.61.174.92:4002`
- Backend: `http://108.61.174.92:4003`
- Swagger: `http://108.61.174.92:4003/api`

## Notes
- This is a direct-port deployment (no reverse proxy yet).
- For production hardening later:
  - put Nginx/Caddy in front
  - enable HTTPS
  - restrict CORS to the final admin URL/domain
