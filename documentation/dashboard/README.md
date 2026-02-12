# Dashboard Module (`src/modules/dashboard`)

## What this module is responsible for

This module powers the admin/dashboard analytics views:

- Summary KPIs (cards).
- Paginated incident and complaint lists for dashboard screens.
- Revenue charts and occupancy breakdowns.
- Smart device health breakdowns.

It aggregates data from many models; it does not own the domain workflows.

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` with `@Permissions('dashboard.view')`

## API surface (controller)

Base route: `/dashboard`

- `GET /dashboard/summary`
- `GET /dashboard/incidents`
- `GET /dashboard/complaints`
- `GET /dashboard/revenue`
- `GET /dashboard/occupancy`
- `GET /dashboard/devices`

All require permission: `dashboard.view`.

## Endpoint behaviors

### Summary (`GET /dashboard/summary`)

Returns:

- incident KPIs: active count, resolved today, avg response time
- open complaints count
- pending registrations count (feature-flagged; see below)
- occupancy rate (uses `Unit.status === OCCUPIED`)
- revenue totals (paid invoices) this month + this year
- smart devices breakdown (`ONLINE`, `OFFLINE`, `ERROR`)
- CCTV cameras breakdown (device type `CAMERA`)

Feature flag:

- Pending registrations are currently “on the shelf”.
- If `ENABLE_PENDING_REGISTRATIONS !== 'true'`, the summary returns `pendingRegistrations=0`.

### Incidents list (`GET /dashboard/incidents`)

Uses shared `paginate(...)` helper with:

- Search fields: `incidentNumber`, `type`, `location`, `residentName`, `description`
- Filters: `status`, `priority`, `unitId`, plus optional unit scoping via `projectName` and `block`
- Date range: `dateFrom/dateTo` mapped to `reportedAt`

### Complaints list (`GET /dashboard/complaints`)

Uses shared `paginate(...)` helper with:

- Search fields: `complaintNumber`, `category`, `description`
- Filters: `status`, `priority`, `unitId`, plus optional unit scoping via `projectName` and `block`
- Date range: `dateFrom/dateTo` mapped to `createdAtFrom/createdAtTo`

### Revenue (`GET /dashboard/revenue`)

- Uses only paid invoices (`Invoice.status = PAID`) and groups them by month.
- Supports scoping by unit/project/block and by paidDate range (`dateFrom/dateTo`).

### Occupancy (`GET /dashboard/occupancy`)

- Groups units by `projectName` + `block` and computes occupancy rate (occupied / total).
- “Occupied” means `Unit.status === OCCUPIED`.

### Devices (`GET /dashboard/devices`)

- Breaks down smart devices by type and status.
- Supports scoping by unit/project/block and filtering by `DeviceType`.

## Relevant code entry points

- `src/modules/dashboard/dashboard.controller.ts`
- `src/modules/dashboard/dashboard.service.ts`
- `src/modules/dashboard/dto/*.ts`

