# Workers / Contractor Access (`src/modules/workers`)

## What this module is responsible for

This module implements the "operational entry" system (contractors + workers), which is separate from Visitor Management (visitors/deliveries).

Key responsibilities:

- Delegate creates/manages contractor companies (as a grouping concept).
- Delegate registers persistent worker identities for a unit (name, national ID, optional phone/photo, job type).
- Delegate generates **WORKER** access QR codes for registered workers (shift/daily windows).

QR generation/validation is handled by HikCentral; this backend only decides **who/when/why** and requests QR creation.

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `AccessProfile`
  - Stores worker identity: `fullName`, `nationalId`, optional `phone`, optional `photoId`.
- `Contractor`
  - Company/team grouping for workers.
- `ContractorMember`
  - Links users (delegates) to contractors with a role: `ADMIN | SUPERVISOR | VIEWER`.
- `Worker`
  - Links an `AccessProfile` (person) to a `Unit` and a `Contractor`, and stores `jobType` + `status`.
- `AccessGrant` + `AccessQRCode`
  - When generating a worker QR, an `AccessGrant` is created using the worker's `accessProfileId`.
  - An `AccessQRCode` row is created for history and revocation (revocation is DB-only for now).

## Authorization rules

All routes require JWT auth.

- **Create contractor** (`POST /contractors`)
  - Allowed: Admin, or **DELEGATE** with ACTIVE unit access and `canManageWorkers=true` (authorization scoped by `unitId`).
  - Side-effect: creator becomes an ACTIVE `ContractorMember` with role `ADMIN`.
- **Create worker** (`POST /workers`)
  - Allowed: Admin, or **DELEGATE** with ACTIVE unit access and `canManageWorkers=true`.
  - Delegate must be an ACTIVE contractor member (ADMIN/SUPERVISOR) of the target contractor.
- **List workers** (`GET /workers?unitId=...`)
  - Allowed: Admin, **OWNER** of the unit, or **DELEGATE** with `canManageWorkers=true`.
  - Delegates only see workers under contractors they are members of.
- **Update worker** (`PATCH /workers/:id`)
  - Allowed: Admin, or **DELEGATE** with `canManageWorkers=true` and contractor membership (ADMIN/SUPERVISOR).
- **Generate worker QR** (`POST /workers/:id/qr`)
  - Allowed: Admin, or **DELEGATE** with `canManageWorkers=true` and `canGenerateQR=true`, plus contractor membership.
  - Requires worker + contractor + access profile to be ACTIVE.

## API surface

### Contractors

Base route: `/contractors`

- `POST /contractors`
  - Body: `{ unitId, name }`
- `GET /contractors`
  - Query:
    - No `unitId`: lists contractors the requester belongs to.
    - With `unitId`: lists contractors with workers on that unit (owner/admin) or only those the delegate belongs to (delegate).

### Workers

Base route: `/workers`

- `POST /workers`
  - Body: `{ unitId, contractorId, fullName, nationalId, phone?, photoId?, jobType? }`
- `GET /workers?unitId=...`
- `PATCH /workers/:id`
  - Body: partial updates to identity/job/status.
- `POST /workers/:id/qr`
  - Body: `{ validFrom?, validTo?, gates?, notes? }`
  - Defaults: if no `validTo` is provided, the service generates an 8-hour window starting at `validFrom` (or now).

## Notes on Access Control module

The generic QR endpoint (`POST /access-qrcodes`) supports `type=WORKER`, but it does not tie the QR to a `Worker` record.

For the contractor/worker flow, prefer generating worker QRs through `POST /workers/:id/qr` so the backend can enforce:

- Worker must be ACTIVE.
- Delegate must be authorized for the unit (`canManageWorkers` + `canGenerateQR`).
- Delegate must belong to the worker's contractor.

