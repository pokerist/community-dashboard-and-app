# Gates Module (`src/modules/gates`)

## Scope

Implements gate configuration and operational mappings required by Phase 1:

- Gate records per community
- Gate-level allowed roles and ETA configuration
- Unit-to-gate access mapping (for QR scope)
- Persistent gate entry/exit logs

## Models

- `Gate`
  - `allowedRoles` (`GateAccessRole[]`)
  - `etaMinutes`
  - `isVisitorRequestRequired`
  - soft delete via `deletedAt`
- `GateUnitAccess`
  - maps unit access to specific gates
  - soft delete via `deletedAt`
- `GateEntryLog`
  - immutable scan event row for ENTRY / EXIT
  - includes scan role, operator, and QR linkage

## API Endpoints

Base route: `/gates`

- `GET /gates`
- `POST /gates`
- `GET /gates/:id`
- `PATCH /gates/:id`
- `DELETE /gates/:id`
- `GET /gates/:id/units`
- `PUT /gates/:id/units`
- `GET /gates/units/:unitId`
- `GET /gates/logs`

## AccessControl integration

`AccessControlService` now uses gate configuration in these flows:

- Visitor QR generation:
  - If no gates are provided, QR gates are auto-filled from `GateUnitAccess` for that unit.
- Gate check-in/check-out:
  - Optional `gateId` accepted.
  - Every check-in/check-out creates a `GateEntryLog` row.
- Mark-used flow:
  - Optional `gateId` accepted and logged.


