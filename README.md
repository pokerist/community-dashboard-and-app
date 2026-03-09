# Community Dashboard Backend

Production-focused backend service built with NestJS + Prisma + PostgreSQL.

## Structure

- `src/`: API source code
- `prisma/`: schema, migrations, seed
- `apps/`: frontend/mobile apps
- `scripts/deploy/`: deployment assets

## Run (Production)

```bash
npm install
npm run db:init:fresh
npm run build
npm run start:prod
```

## Core Scripts

- `npm run build`
- `npm run start`
- `npm run start:prod`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:push:reset`
- `npm run db:init:fresh`
- `npm run db:init:fresh:reset`

## Security

- `npm run audit:prod` runs `npm audit --omit=dev`
- `npm run audit:prod:gate` enforces: `critical/high/moderate = 0` and only allowlisted low advisories
- Exception details are documented in `SECURITY_EXCEPTIONS.md`

## RBAC + Governance Docs

- `documentation/LOGICAL_DIAGRAMS.md`
- `documentation/FLOWS.md`
- `documentation/domain.md`
- `documentation/ENV_MATRIX.md`

## Seed Profiles

- `npm run seed:fast` baseline seed
- `npm run seed:fast:reset-rbac` reset + reseed RBAC policies/assignments
- `npm run seed:full` full legacy dataset profile

## Deploy

```bash
./deploy.sh
```
