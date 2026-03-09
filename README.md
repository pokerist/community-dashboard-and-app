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

## Deploy

```bash
./deploy.sh
```
