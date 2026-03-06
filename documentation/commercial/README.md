# Commercial Module (`src/modules/commercial`)

## Scope

This module implements the commercial tenant hierarchy:

- `Community -> CommercialEntity -> CommercialBranch -> CommercialStaff`

It supports:

- Commercial business creation under a community.
- Branch management (optionally linked to a `Unit`).
- Staff assignment by role (`OWNER`, `HR`, `MANAGER`, `EMPLOYEE`).
- Staff capability permissions through `CommercialAccess`.
- Soft delete for all commercial records using `deletedAt`.

## Data Model

Primary Prisma models:

- `CommercialEntity`
  - Business tenant in a community.
  - Owner linked through `ownerUserId -> User`.
- `CommercialBranch`
  - Physical branch for a business.
  - Optional `unitId` link to `Unit`.
- `CommercialStaff`
  - Staff assignment to a branch with role/state.
- `CommercialAccess`
  - Permission rows per staff member (`WORK_ORDERS`, `ATTENDANCE`, etc.).

All models include:

- `createdAt`
- `updatedAt`
- `deletedAt` (soft delete)

## API Endpoints

Base route: `/commercial`

- `GET /entities`
- `POST /entities`
- `GET /entities/:entityId`
- `PATCH /entities/:entityId`
- `DELETE /entities/:entityId`
- `GET /entities/:entityId/branches`
- `POST /entities/:entityId/branches`
- `GET /branches/:branchId`
- `PATCH /branches/:branchId`
- `DELETE /branches/:branchId`
- `GET /branches/:branchId/staff`
- `POST /branches/:branchId/staff`
- `PATCH /staff/:staffId`
- `DELETE /staff/:staffId`
- `GET /staff/:staffId/access`
- `PUT /staff/:staffId/access`

## Business Rules

- Community and owner user must exist before creating an entity.
- Branch names are unique per active entity (case-insensitive check).
- Entity names are unique per active community (case-insensitive check).
- If a branch is linked to a unit, that unit must be active and in the same community as the entity.
- `OWNER` staff role can only be assigned to the entity owner user.
- Staff access updates replace active permissions atomically in one transaction.
- Deleting entity/branch/staff is soft-delete and cascades to child commercial records.
