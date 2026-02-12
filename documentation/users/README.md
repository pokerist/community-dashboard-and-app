# Users Module (Admin User Management) (`src/modules/users`)

## What this module is responsible for

Despite historically being named “Residents”, this module’s responsibility is **admin-side user management** under the `/admin/users` route:

- Create, list, read, update, and deactivate `User` accounts.
- Create and manage profile records for:
  - `Resident`
  - `Owner`
  - `Tenant`
  - `Admin`
- Manage role assignments through the `UserRole` join table.

Important: This module does **not** replace the domain model `Resident` in Prisma. `Resident` is still a real entity representing the “resident profile” attached to a `User`.

## Key data model concepts (Prisma)

Primary models involved (see `prisma/schema.prisma`):

- `User`: authentication + base identity fields, account status (`userStatus`), and role links (`UserRole`).
- `Resident`: resident profile linked 1:1 to `User` (`Resident.userId` is unique).
- `Owner`, `Tenant`, `Admin`: role/profile tables linked 1:1 to `User`.
- `Role`, `Permission`, `UserRole`: RBAC tables.

## Authentication / authorization

All routes are guarded by:

- `JwtAuthGuard` (JWT required).
- `PermissionsGuard` using `@Permissions(...)` metadata.

Most endpoints require “read/write” permissions such as:

- `user.create`, `user.read`, `user.update`, `user.delete`
- `resident.create`, `resident.view`, `resident.update`, `resident.delete`
- `owner.create`, `owner.view`, `owner.update`, `owner.delete`
- `tenant.create`, `tenant.view`, `tenant.update`, `tenant.delete`
- `admin.create`, `admin.view`, `admin.update`, `admin.delete`

### Direct creation policy (`user.create.direct`)

The service enforces an additional rule for “direct creation” flows:

- Creating a user where `signupSource === 'dashboard'` requires the caller to also have `user.create.direct`.
- Creating Resident/Owner/Tenant/Admin profiles also requires `user.create.direct`.

This is enforced in service code (not only by `@Permissions(...)`).

## API surface (controller)

Base route: `/admin/users`

Users:

- `POST /admin/users`
- `GET /admin/users?userType=<resident|owner|tenant|admin>&skip=<n>&take=<n>`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id`
- `DELETE /admin/users/:id` (soft-deactivate)

Resident profiles:

- `POST /admin/users/residents`
- `GET /admin/users/residents?skip=<n>&take=<n>`
- `GET /admin/users/residents/:id`
- `PATCH /admin/users/residents/:id`
- `DELETE /admin/users/residents/:id`

Owner profiles:

- `POST /admin/users/owners`
- `GET /admin/users/owners?skip=<n>&take=<n>`
- `GET /admin/users/owners/:id`
- `PATCH /admin/users/owners/:id`
- `DELETE /admin/users/owners/:id`

Tenant profiles:

- `POST /admin/users/tenants`
- `GET /admin/users/tenants?skip=<n>&take=<n>`
- `GET /admin/users/tenants/:id`
- `PATCH /admin/users/tenants/:id`
- `DELETE /admin/users/tenants/:id`

Admin profiles:

- `POST /admin/users/admins`
- `GET /admin/users/admins?skip=<n>&take=<n>`
- `GET /admin/users/admins/:id`
- `PATCH /admin/users/admins/:id`
- `DELETE /admin/users/admins/:id`

## Flow 1: Create user (`POST /admin/users`)

DTO: `CreateUserDto` (`src/modules/users/dto/create-user.dto.ts`)

Behavior:

- Creates a `User` row with `userStatus = ACTIVE`.
- If `roles` is provided, creates `UserRole` rows for those role IDs.

Password behavior:

- If `password` is provided, it is hashed with bcrypt (12 rounds) and stored as `User.passwordHash`.
- If no password is provided, `passwordHash` remains `null`/`undefined` (login flow must handle this).

Direct creation policy:

- If `signupSource === 'dashboard'`, the caller must also have permission `user.create.direct`.

## Flow 2: Update user (`PATCH /admin/users/:id`)

DTO: `UpdateUserDto` (`src/modules/users/dto/update-user.dto.ts`)

Behavior highlights:

- If `password` is provided, it is re-hashed and stored as `passwordHash`.
- If `roles` is provided:
  - existing roles are deleted (`userRole.deleteMany`)
  - new roles are created (`userRole.createMany`)
- All other provided fields are passed directly to `prisma.user.update`.

## Flow 3: Deactivate user (`DELETE /admin/users/:id`)

This is a soft delete:

- Sets `User.userStatus = DISABLED`.

## Flow 4: Profile creation (Resident / Owner / Tenant / Admin)

These endpoints create the corresponding profile table row for an existing user.

General rules (as implemented):

- The referenced `userId` must exist.
- The profile must not already exist for that user.
- Caller must pass the `user.create.direct` gate (service-level rule).

IDs to be aware of:

- Resident endpoints use `Resident.id` in the URL (not `User.id`).
- Owner endpoints use `Owner.id` in the URL.
- Tenant endpoints use `Tenant.id` in the URL.
- Admin endpoints use `Admin.id` in the URL.

## Resident deletion notes (`DELETE /admin/users/residents/:id`)

The current implementation tries to cascade cleanup:

- Deletes `ResidentUnit` rows for that `residentId`.
- Deletes bookings for that `residentId`.
- Deletes the `Resident` profile row.

It does not currently remove other resident-linked entities (family links, unit access, etc.). Be cautious when deleting resident profiles in production.

## Relevant code entry points

- `src/modules/users/users.controller.ts`
- `src/modules/users/users.service.ts`
- `src/modules/users/users.module.ts`
- `src/modules/users/dto/*.ts`

