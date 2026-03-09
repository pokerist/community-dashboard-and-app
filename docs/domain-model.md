# Domain Model

## Core Data Graph
- `User`
- `Unit`
- `UnitAccess` (source of truth for access)
- `Community`, `Phase`, `Cluster`
- `Lease`, `Invoice`, `ServiceRequest`, `Complaint`, `Violation`, `Notification`, `SystemSetting`

## Hierarchy Model
Canonical structure in schema/service logic:
- `Community` (top parent)
- `Phase` belongs to community
- `Cluster` belongs to phase and community
- `Unit` may be:
  - community-level (`phaseId = null`, `clusterId = null`)
  - phase-level (`phaseId != null`, `clusterId = null`)
  - cluster-level (`phaseId != null`, `clusterId != null`)

Validation is enforced in service layer (`src/modules/units/units.service.ts`):
- cluster without phase is rejected
- phase must belong to selected community
- cluster must belong to selected phase/community

## Access Model
`UnitAccess` stores:
- actor (`userId`)
- unit (`unitId`)
- role (`OWNER`, `TENANT`, `FAMILY`, `DELEGATE`)
- temporal bounds (`startsAt`, `endsAt`)
- status (`ACTIVE`, etc.)
- granular flags (`canViewFinancials`, `canGenerateQR`, ...)

`ResidentUnit` exists for legacy linkage but should not drive permissions.

## Operations Model
- Service lifecycle: `Service` -> `ServiceRequest` -> comments/status/history
- Complaint lifecycle: create -> assign -> status -> comments -> closure
- Violation lifecycle: issue -> action request (appeal/fix) -> review -> status
- Facilities lifecycle: `Facility` -> `Booking` -> approval/rejection/cancellation

## Finance Model
- `Invoice` links to resident/unit and may be generated from rent, fees, bookings, violations, etc.
- Invoice status transitions (`PENDING`, `PAID`, `OVERDUE`, ...)

## Notification Model
- `Notification` + `NotificationLog`
- audience targeting via `audienceMeta`: `communityIds`, `phaseIds`, `clusterIds`, `unitIds`, legacy keys
- delivery channels: `IN_APP`, `PUSH`, `SMS`, `EMAIL`, `WHATSAPP`

## Configuration Model
- `SystemSetting` is central config store
- includes branding, onboarding, offers, integrations, mobile access policy
- mobile-safe config surfaces via `/mobile/app-config` and `/mobile/screen-manifest`
