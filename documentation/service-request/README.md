# Service Request Module (`src/modules/service-request`)

## What this module is responsible for

This module handles service requests created by community app users and processed by dashboard/staff users.

It supports:

- Creating a request for a specific `Service` and `Unit`
- Submitting dynamic field values based on `ServiceField` configuration
- Linking attachments to a request
- Listing "my requests" for the authenticated user
- Internal dashboard operations: list all requests and update assignment/status

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `ServiceRequest`
  - belongs to `Service` via `serviceId`
  - belongs to `Unit` via `unitId`
  - created by `User` via `createdById`
  - `status` (`NEW`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`)
  - `priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `assignedToId` (optional staff user id)
  - relations:
    - `fieldValues` (`ServiceRequestFieldValue[]`)
    - `attachments` (`Attachment[]`) (linked via `Attachment.serviceRequestId`)
    - `invoices` (`Invoice[]`)
- `ServiceRequestFieldValue`
  - belongs to `ServiceRequest` via `requestId`
  - belongs to `ServiceField` via `fieldId`
  - stores one of:
    - `valueText`, `valueNumber`, `valueBool`, `valueDate`, `fileAttachmentId`
- `Attachment`
  - for service requests, linked through `serviceRequestId`
  - also stores a polymorphic `entity/entityId` pair (`SERVICE_REQUEST`)

## Authentication / authorization

All routes require:

- `JwtAuthGuard`
- `PermissionsGuard` via `@Permissions(...)`

In addition, `GET /service-requests/:id` enforces ownership rules in the service layer:

- if you only have `service_request.view_own`, you can only view requests where `createdById === yourUserId`
- if you have `service_request.view_all` (or SUPER_ADMIN role), you can view any request

## API surface (controller)

Base route: `/service-requests`

Community app:

- `POST /service-requests` (permissions: `service_request.create`)
- `GET /service-requests/my-requests` (permissions: `service_request.view_own`)
- `GET /service-requests/:id` (permissions: `service_request.view_own` OR `service_request.view_all`)

Dashboard/staff:

- `GET /service-requests` (permissions: `service_request.view_all`)
- `PATCH /service-requests/:id` (permissions: `service_request.assign` OR `service_request.resolve` OR `service_request.close`)

## Flow: Create a service request (`POST /service-requests`)

Key validations and rules (see `ServiceRequestService.create`):

1. Unit access check: user must have ACTIVE access to the unit (`getActiveUnitAccess`).
2. Service must exist and be active (`Service.status === true`).
3. Unit eligibility enforced based on the service's `unitEligibility`:
   - `ALL`: allowed for any unit status
   - `DELIVERED_ONLY`: allowed only when `Unit.status` is one of `DELIVERED`, `OCCUPIED`, `LEASED`
   - `NON_DELIVERED_ONLY`: allowed only when `Unit.status` is not delivered (anything other than the delivered statuses above)
4. Dynamic fields validation:
   - every submitted `fieldId` must belong to the service's `formFields`
   - required fields must be provided
   - each field value must set exactly one value column (based on the field type)
5. Attachments:
   - `attachmentIds` are `File.id` values
   - the service stores them as `Attachment` rows linked to the request

## Flow: Update request (dashboard) (`PATCH /service-requests/:id`)

Update DTO: `UpdateServiceRequestInternalDto` allows:

- `assignedToId`
- `status`

Additional permission rules are enforced server-side (see `ServiceRequestService.updateForActor`):

- changing `assignedToId` requires `service_request.assign`
- setting `status=RESOLVED` requires `service_request.resolve`
- setting `status=CLOSED` requires `service_request.close`
- setting `status=NEW` or `IN_PROGRESS` requires `service_request.assign`

## Relevant code entry points

- `src/modules/service-request/service-request.controller.ts`
- `src/modules/service-request/service-request.service.ts`
- `src/modules/service-request/dto/*.ts`

