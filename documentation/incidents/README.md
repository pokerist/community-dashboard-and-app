# Incidents Module (`src/modules/incidents`)

## What this module is responsible for

The Incidents module tracks security/emergency incidents for dashboard workflows:

- Create an incident record (with optional unit link and attachments).
- Dashboard summary metrics (cards).
- Paginated searchable incident listing.
- Resolve an incident and store response time.

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `Incident`
  - `incidentNumber` is generated from a DB-backed sequence (`IncidentSequence`) as `INC-0001`, `INC-0002`, ...
  - `status`: `OPEN` -> `RESOLVED`
  - `reportedAt`, `resolvedAt`
  - `responseTime` (stored in seconds in implementation)
  - optional `unitId`
  - `attachments`: linked via `Attachment.incidentId`
- `IncidentSequence`
  - Atomic counter used to generate sequential incident numbers

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

Permissions are defined in `src/modules/incidents/incidents.controller.ts`.

## API surface (controller)

Base route: `/incidents`

- `POST /incidents` (permissions: `incidents.create`)
- `GET /incidents/cards` (permissions: `incidents.view`)
- `GET /incidents/list` (permissions: `incidents.view`)
- `PATCH /incidents/:id/resolve` (permissions: `incidents.resolve`)

## Flow: Create incident (`POST /incidents`)

Implementation notes (`IncidentsService.create`):

- Generates `incidentNumber`.
- Sets `status=OPEN` and `reportedAt=now()`.
- If `unitId` is provided, the unit is validated to exist.
- If `attachmentIds` are provided, creates `Attachment` rows linked to the incident (via `incidentId` and `entity/entityId`).
- Emits event `incident.created`.

## Flow: Resolve incident (`PATCH /incidents/:id/resolve`)

Implementation notes (`IncidentsService.resolve`):

- Only incidents with `status=OPEN` can be resolved.
- Calculates `responseTime` as seconds between `reportedAt` and now.
- Sets `status=RESOLVED` and `resolvedAt=now()`.
- Emits event `incident.resolved`.

## Listing (`GET /incidents/list`)

Uses shared `paginate(...)` helper with:

- Search fields: `type`, `location`, `residentName`, `description`, `incidentNumber`
- Filters: `status`, `priority`, `unitId`, `reportedAtFrom/reportedAtTo`

## Relevant code entry points

- `src/modules/incidents/incidents.controller.ts`
- `src/modules/incidents/incidents.service.ts`
- `src/modules/incidents/dto/*.ts`

