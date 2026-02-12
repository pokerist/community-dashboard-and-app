# Service Module (`src/modules/service`)

## What this module is responsible for

This module manages the **service catalog** (the list of services residents can request), for example:

- Maintenance
- Security
- Admin / facilities requests

It does not create service requests; that is handled by the Service Request module.

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `Service`
  - `name`, `category`, `description`
  - `status` (visibility toggle: `true` = active/visible)
  - `unitEligibility` (`ALL`, `DELIVERED_ONLY`, `NON_DELIVERED_ONLY`)
  - `startingPrice` (Decimal)
  - relation: `formFields` (`ServiceField[]`)
  - relation: `requests` (`ServiceRequest[]`)

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

Permissions are defined per endpoint in `src/modules/service/service.controller.ts`.

## API surface (controller)

Base route: `/services`

- `POST /services` (permissions: `service.create`)
- `GET /services?status=active|inactive|all` (permissions: `service.read`)
- `GET /services/:id` (permissions: `service.read`)
- `PATCH /services/:id` (permissions: `service.update`)
- `DELETE /services/:id` (permissions: `service.delete`)

Notes:

- `GET /services` includes `formFields` ordered by `order` (used by the Community App to render a dynamic form).
- `DELETE /services/:id` is blocked if there are existing `ServiceRequest`s linked to the service; use `PATCH` to set `status=false` instead.

## DTOs

- `CreateServiceDto` (`src/modules/service/dto/create-service.dto.ts`)
  - `startingPrice` is a **string** in the DTO (stored as Decimal in DB).
- `UpdateServiceDto` (`src/modules/service/dto/update-service.dto.ts`) is a `PartialType(CreateServiceDto)`.

## Relevant code entry points

- `src/modules/service/service.controller.ts`
- `src/modules/service/service.service.ts`
- `src/modules/service/dto/*.ts`
