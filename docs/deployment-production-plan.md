# Deployment Production Plan

## Current Baseline
Existing deploy entrypoint is `./deploy.sh` -> `scripts/deploy/deploy-admin-stack.sh`.

It already handles:
- env bootstrap (`.env.production`, admin env)
- dependency install/build
- Prisma schema push (`prisma db push`)
- seed execution options
- PM2 process boot
- health checks and basic smoke output

## Recommended Transition Plan

### Phase 1 (now, low risk)
- Keep current deploy script and local-like behavior.
- Separate required seed from optional demo seeds in docs/ops runbook.
- Enforce canonical API routes in admin/mobile clients.

### Phase 2 (safe with verification)
- Add migration-safe branch:
  - staging/prod use `prisma migrate deploy`
  - local/dev can keep `db push`
- Add explicit `NODE_ENV` safeguards around destructive reset/seed actions.

### Phase 3 (post-launch hardening)
- Front with reverse proxy + TLS.
- Narrow CORS to production domain(s).
- Move secrets to managed vault.
- Add centralized monitoring/alerts and structured logs.

## Operational Checklist
1. DB connectivity and role permissions.
2. PM2 process health (`community-backend`, `community-admin-web`).
3. `/api` reachable and auth endpoints healthy.
4. storage provider mode verified (local/mock/live as intended).
5. push/email/sms provider diagnostics checked.
6. file/public routes and brand assets reachable.

## Classification
- `safe now`: keep script path, improve runbook clarity.
- `safe with verification`: introduce `migrate deploy` branch for non-dev environments.
- `defer`: full infra migration (object storage mandates, queue infra, managed secrets) until rollout window.
- `risky/manual review`: forcing immediate infra changes in same release as contract cleanup.
