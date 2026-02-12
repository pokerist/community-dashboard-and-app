# Service Field Module (`src/modules/service-field`)

## What this module is responsible for

This module configures the **dynamic form fields** that appear when creating a Service Request.

Each `Service` can have many `ServiceField`s (ordered by `order`), which the Community App uses to render the request form.

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `ServiceField`
  - belongs to `Service` via `serviceId`
  - `label` (user-facing field label)
  - `type` (input type)
  - `placeholder` (optional UI hint)
  - `required` (whether a value is mandatory when submitting a request)
  - `order` (display ordering in the UI)
- `ServiceRequestFieldValue`
  - stores submitted values per request/field
  - supports different value columns: `valueText`, `valueNumber`, `valueBool`, `valueDate`, `fileAttachmentId`

## Field types

Enum `ServiceFieldType` (from Prisma):

- `TEXT`
- `TEXTAREA`
- `NUMBER`
- `DATE`
- `BOOLEAN`
- `MEMBER_SELECTOR`
- `FILE`

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

Permissions are defined per endpoint in `src/modules/service-field/service-field.controller.ts`.

## API surface (controller)

Base route: `/service-fields`

- `POST /service-fields` (permissions: `service_field.create`)
- `GET /service-fields?serviceId=<uuid>` (permissions: `service_field.read`)
- `PATCH /service-fields/:id` (permissions: `service_field.update`)
- `DELETE /service-fields/:id` (permissions: `service_field.delete`)

Notes:

- `GET /service-fields` requires `serviceId` as a query parameter.
- `DELETE /service-fields/:id` is blocked if there are existing `ServiceRequestFieldValue` rows linked to that field.

## DTOs

- `CreateServiceFieldDto` (`src/modules/service-field/dto/create-service-field.dto.ts`)
- `UpdateServiceFieldDto` (`src/modules/service-field/dto/update-service-field.dto.ts`) is a `PartialType(CreateServiceFieldDto)`.

## Relevant code entry points

- `src/modules/service-field/service-field.controller.ts`
- `src/modules/service-field/service-field.service.ts`
- `src/modules/service-field/dto/*.ts`
