# File Module (`src/modules/file`)

## What this module is responsible for

This module is the backend’s file gateway:

- Upload files to object storage (Supabase adapter) and create a `File` DB record.
- Stream files back to clients.
- Delete files (with category-based restrictions and access checks).

Most other modules do not upload binary data directly; they upload via this module and then pass `fileId` to other endpoints (e.g., `attachmentIds`).

## Key data models (Prisma)

From `prisma/schema.prisma`:

- `File`
  - `key` is the storage key used by the storage adapter (bucket is derived from `category`).
  - optional relations are created by other modules by storing `fileId` on their records:
    - `User.profilePhotoId`
    - `User.nationalIdFileId`
    - `Lease.contractFileId`
    - `Attachment.fileId`
- `Attachment`
  - links `fileId` to a business entity via:
    - explicit relations (`serviceRequestId`, `invoiceId`, `incidentId`)
    - and/or polymorphic `entity/entityId` (e.g., `SERVICE_REQUEST`, `COMPLAINT`, `VIOLATION`, `INCIDENT`)

## Authentication / authorization

All routes require:

- `JwtAuthGuard` (JWT required)

Read access for `GET /files/:fileId/stream` is enforced in `FileService.getFileStreamForActor`:

- SUPER_ADMIN role bypasses checks.
- User can read their own `profilePhotoId` / `nationalIdFileId`.
- Lease contract files can be read by users with ACTIVE `UnitAccess` to the lease unit.
- Attachment-linked files can be read if the user has access to the parent entity:
  - Service Requests: `service_request.view_all` OR `service_request.view_own` + creator match.
  - Complaints: `complaint.view_all` OR `complaint.view_own` + reporter match.
  - Violations: `violation.view_all` OR `violation.view_own` + (direct target OR ACTIVE `UnitAccess` to the unit).
  - Incidents: `incidents.view`.
  - Invoice documents (if `attachment.invoiceId` is used): `invoice.view_all` OR `invoice.view_own` + (direct resident OR ACTIVE `UnitAccess` to the unit).

Delete access for `DELETE /files/:fileId` is enforced in `FileService.deleteFileForActor`:

- Identity docs (`FileCategory.NATIONAL_ID`) cannot be deleted (business rule).
- SUPER_ADMIN role bypasses ownership checks (still blocked by identity-doc rule).
- Users can delete their own profile photo.
- Other deletes require passing the same “read access” checks.

## Storage buckets

Bucket is derived from `File.category`:

- `PROFILE_PHOTO` -> `profile-photos`
- `SERVICE_ATTACHMENT` -> `service-attachments`
- Identity docs (`NATIONAL_ID`, `CONTRACT`, `DELEGATE_ID`, `WORKER_ID`, `MARRIAGE_CERTIFICATE`, `BIRTH_CERTIFICATE`, `DELIVERY`) -> `identity-docs`

## API surface (controller)

Base route: `/files`

Uploads (multipart `file` field):

- `POST /files/upload/profile-photo`
- `POST /files/upload/national-id`
- `POST /files/upload/contract`
- `POST /files/upload/delegate-id`
- `POST /files/upload/worker-id`
- `POST /files/upload/marriage-certificate`
- `POST /files/upload/birth-certificate`
- `POST /files/upload/service-attachment`

Read/delete:

- `GET /files/:fileId/stream`
- `DELETE /files/:fileId`

## Relevant code entry points

- `src/modules/file/file.controller.ts`
- `src/modules/file/file.service.ts`
- `src/modules/file/adapters/supabase-storage.adapter.ts`
- `src/common/interfaces/file-storage.interface.ts`

