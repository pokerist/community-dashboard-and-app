# Compound Staff Module (`src/modules/compound-staff`)

## Scope

This module manages internal compound employees and their operational permissions.

Core responsibilities:

- Create and maintain staff records.
- Store profession, optional work schedule, and optional contract period.
- Manage capability permissions per staff member.
- Soft-delete records with `deletedAt` for audit safety.

## Data Model

Prisma models:

- `CompoundStaff`
  - `userId`
  - `profession`
  - `workSchedule` (JSON)
  - `contractFrom`, `contractTo`
  - `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `TERMINATED`)
  - `createdAt`, `updatedAt`, `deletedAt`

- `CompoundStaffAccess`
  - `staffId`
  - `permission` (`ENTRY_EXIT`, `WORK_ORDERS`, `ATTENDANCE`, `RESIDENT_COMMUNICATION`, `TASK_REMINDERS`)
  - `isGranted`
  - `grantedById`
  - `createdAt`, `updatedAt`, `deletedAt`

## API Endpoints

Base route: `/compound-staff`

- `GET /compound-staff`
- `POST /compound-staff`
- `GET /compound-staff/:id`
- `PATCH /compound-staff/:id`
- `DELETE /compound-staff/:id`
- `GET /compound-staff/:id/access`
- `PUT /compound-staff/:id/access`

## Business Rules

- One active (non-deleted) compound staff profile per user.
- Contract range is validated (`contractTo` must be after `contractFrom`).
- Access permissions are replaced atomically in one transaction.
- Removing staff soft-deletes the staff profile and all active access entries.
