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

## Prepare Env
### Backend
Copy:
```bash
cp .env.production.example .env.production
```

Edit at minimum:
- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_ACCESS_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- notification provider credentials as needed

### Admin Web
Copy:
```bash
cp apps/admin-web/.env.production.example apps/admin-web/.env.production
```

Default generated value:
- `VITE_API_BASE_URL=http://108.61.174.92:4003`

## Deploy Command
From repo root on the server:
```bash
chmod +x scripts/deploy/deploy-admin-stack.sh
./scripts/deploy/deploy-admin-stack.sh
```

### Optional: Include Demo Data
```bash
RUN_DEMO_SEEDS=true RUN_DASHBOARD_LOAD_SEED=true ./scripts/deploy/deploy-admin-stack.sh
```

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

