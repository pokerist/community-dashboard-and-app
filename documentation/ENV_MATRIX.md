# ENV_MATRIX

## Runtime Environment Matrix

| Variable | Local Dev | Staging/Prod | Required | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | yes | yes | yes | PostgreSQL connection for Prisma. |
| `DIRECT_URL` | optional | optional | no | Optional direct DB connection for Prisma tooling. |
| `JWT_SECRET` | yes | yes | yes | Access token signing key. |
| `JWT_REFRESH_SECRET` | yes | yes | yes | Refresh token signing key. |
| `ACCESS_TOKEN_EXPIRES_IN` | yes | yes | no | Default from code if missing. |
| `REFRESH_TOKEN_EXPIRES_IN` | yes | yes | no | Default from code if missing. |
| `VITE_API_BASE_URL` (admin-web) | yes | yes | yes | API origin used by admin frontend. |
| `NODE_ENV` | `development` | `production` | no | Standard Node mode. |

## OTP / Session Security

| Variable | Purpose |
|---|---|
| `ENABLE_FIREBASE_OTP` | Enables Firebase OTP verification path. |
| `FIREBASE_PROJECT_ID` | Firebase project id. |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email. |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key (multiline-safe). |
| `ENABLE_SESSION_TAKEOVER_OTP` | If enabled, session takeover requires OTP challenge. |

## RBAC / Visibility Behavior Flags

| Variable | Default | Effect |
|---|---|---|
| `SEED_RESET_RBAC` | `false` | When `true` during seed, clears RBAC policy tables and role assignments before reseed. |
| `SEED_FORCE_SCREEN_RULES` | `false` | Forces replacing screen visibility rules during seed even if rules already exist. |

## Seed Profiles

| Command | Profile | Notes |
|---|---|---|
| `npm run seed:fast` | Baseline fast seed | Non-destructive by default for existing RBAC rules. |
| `npm run seed:fast:reset-rbac` | RBAC reset + reseed | Destructive for RBAC policy/assignments; backup first. |
| `npm run seed:full` | Full legacy dataset | Uses `prisma/seed.ts` profile for expanded data. |

## Safety Checklist (Before RBAC Reset)

1. Backup database snapshot.
2. Confirm maintenance window.
3. Run `npm run seed:fast:reset-rbac`.
4. Validate login + `/auth/me/access` + dashboard visibility.
5. Verify critical roles (`SUPER_ADMIN`, manager/staff personas) and production accounts.
