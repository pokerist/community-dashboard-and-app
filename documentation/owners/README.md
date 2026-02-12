# Owners Module (`src/modules/owners`)

## What this module is responsible for

The Owners module provides API endpoints and business logic for:

- Creating an owner account and assigning them to a unit (admin-driven onboarding).
- Basic CRUD around `Owner` records.
- Profile updates (owner updating their own profile, and owner updating a family member profile).
- Family member lifecycle on a unit:
  - Add a family member (authority-aware: owner vs tenant depending on active lease).
  - List family members for the *current resident* of a unit.
  - Revoke a family member's access to a unit.

This module relies heavily on `UnitAccess` as the *actual* access-control record, and uses `Lease` to decide who the *current resident* is for family actions.

## Key data model concepts (Prisma)

These are the most important models involved (see `prisma/schema.prisma`):

- `User`: authentication identity + base profile fields.
- `Owner`: a role record that links `User` -> Owner.
- `Resident`: resident profile linked 1:1 with `User`. Also stores relationship/dateOfBirth/nationalId.
- `Unit`: the property unit; `Unit.status` is used as a workflow/status cache.
- `UnitAccess`: the source of truth for who can access a unit and what they can do.
- `ResidentUnit`: legacy mapping; still used to mark the **primary owner resident** for a unit and to find “active units” for a resident.
- `FamilyMember`: links a primary resident (owner/tenant resident) to a family resident.
- `ResidentDocument`: links required documents to a resident (birth certificate, marriage certificate, national ID).
- `File`: uploaded file records; file category is validated for onboarding/family flows.
- `Lease` (Leases module): used to determine current authority (tenant vs owner).

## Authentication / authorization

All Owners routes are guarded by:

- `JwtAuthGuard`: requires `Authorization: Bearer <accessToken>`.
- `PermissionsGuard`: currently **no Owners endpoints set `@Permissions(...)` metadata**, so permission checks are effectively a no-op here.

Service-level authorization is implemented for specific operations (notably family operations and “remove user from unit”).

## API surface (controller)

Base route: `/owners`

- `POST /owners/create-with-unit`
- `GET /owners`
- `GET /owners/:id`
- `DELETE /owners/:id`
- `PATCH /owners/profile`
- `POST /owners/family/:unitId?targetResidentId=<residentId>`
- `GET /owners/family/:unitId`
- `PATCH /owners/family/:userId`
- `POST /owners/units/:unitId/remove-user/:userId`

Note: `/owners/upload/profile-photo` and `/owners/upload/national-id-photo` are implemented and will upload the file **and** attach it to the authenticated user:

- Profile photo: updates `User.profilePhotoId`
- National ID: updates `User.nationalIdFileId`

If you need to upload a file without mutating the current user (e.g., admin uploads documents for another user), use the File module endpoints (`/files/upload/...`) and pass the resulting file IDs to the relevant flows.

## Flow 1: Admin creates owner + assigns unit (`POST /owners/create-with-unit`)

### Goal
Create an owner `User` + `Resident` + `Owner`, assign them to a unit, and create `UnitAccess(role=OWNER)`.

### Inputs
DTO: `CreateOwnerWithUnitDto` (`src/modules/owners/dto/create-owner-with-unit.dto.ts`)

- `name` (string)
- `email` (string) *(see “Gotchas” below)*
- `phone` (string)
- `nationalId` (string)
- `nationalIdPhotoId` (uuid of `File` with `category = NATIONAL_ID`)
- `unitId` (uuid)

### Main validations / rules (as implemented)

Inside a Prisma transaction (`timeout: 20000`):

1. Unit must exist and be `Unit.status === AVAILABLE`.
2. Email uniqueness: enforced if `dto.email` is set.
3. Phone uniqueness: `User.phone` must not already exist.
4. Unit must not already have a primary owner mapping: no `ResidentUnit` with `unitId` and `isPrimary: true`.
5. National ID uniqueness: checked against `Resident.nationalId` if `dto.nationalId` is set.
6. `nationalIdPhotoId` must exist and have `File.category === NATIONAL_ID`.

### Side effects (as implemented)

Inside the transaction:

- Create `User` (password is auto-generated; hashed with bcrypt **outside** the transaction).
  - `userStatus` is set to `ACTIVE` when email exists, else `INVITED`.
  - `nationalIdFileId` is set to `dto.nationalIdPhotoId` (validated as `File.category = NATIONAL_ID`).
- Create `Resident` (with `nationalId` if provided).
- Create `Owner` role record.
- Create `ResidentUnit` record with `isPrimary: true` (marks this resident as the primary owner resident for the unit).
- Create `UnitAccess` record:
  - `role: OWNER`, `status: ACTIVE`, `source: ADMIN_ASSIGNMENT`
  - `startsAt: now()`
  - permission flags are set to `true` for most capabilities.
- Update `Unit.status` to `NOT_DELIVERED` and `Unit.isDelivered = false`.
- Create `UserStatusLog` entry (sets `newStatus: ACTIVE`).

Outside the transaction:

- Send a welcome email *if* an email exists.

Returned response includes:

- `userId`, `userEmail`, `userName`
- `randomPassword` (admin is expected to share it with the owner)

## Flow 2: Update own profile (`PATCH /owners/profile`)

Updates the authenticated user’s own `User` profile fields and (optionally) their `Resident.nationalId`.

Validations (transactional):

- `Resident.nationalId` must be unique (excluding current user).
- `User.email` must be unique (excluding current user).
- `User.phone` must be unique (excluding current user).

Side effects:

- Updates `User.nameEN`, `User.nameAR`, `User.email`, `User.phone`, `User.profilePhotoId`.
- If `dto.nationalId` is provided, updates `Resident.nationalId`.

## Flow 3: Family operations (authority-aware)

The module treats family operations as belonging to the **current resident** of a unit:

- If there is an `ACTIVE` lease for the unit, the **tenant** is the current resident.
- Otherwise, the **primary owner** (from `ResidentUnit(isPrimary=true)`) is the current resident.

This same rule is used in:

- `addFamilyMember(...)`
- `getFamilyMembers(...)`
- `removeUserFromUnit(...)` (for non-admin callers)

### 3.1 Add family member (`POST /owners/family/:unitId`)

High-level:

1. Unit must be “delivered enough”: unit status must be one of `DELIVERED`, `OCCUPIED`, `LEASED`.
2. Determine current resident (owner vs tenant).
3. If caller is not admin: caller must have `UnitAccess` for the unit with `role === currentResidentType` and `status === ACTIVE`.
4. Create a new `User` + `Resident` for the family member.
5. Create `ResidentDocument` rows depending on relationship/age.
6. Create `FamilyMember` link: `primaryResidentId -> familyResidentId`.
7. Outside the transaction: create `UnitAccess(role=FAMILY, source=FAMILY_AUTO)` for the family user on **all units** associated with the primary resident (via `ResidentUnit`).

Admin override:

- Admin can force linking to a specific resident by passing `targetResidentId` query param.

Required files (validated by category):

- Always required:
  - `personalPhotoId` with `File.category === PROFILE_PHOTO`
- If `relationship === CHILD`:
  - If age < 16: `birthCertificateFileId` with `File.category === BIRTH_CERTIFICATE`
  - If age >= 16: `nationalId` + `nationalIdFileId` with `File.category === NATIONAL_ID`
- If `relationship === SPOUSE`:
  - `marriageCertificateFileId` with `File.category === MARRIAGE_CERTIFICATE`

Important: A family member is granted unit access using `UnitAccess`. The implementation does **not** add a `ResidentUnit` mapping for family members.

### 3.2 List family members (`GET /owners/family/:unitId`)

Returns active family members for the **current resident** of the unit:

1. Determine current resident ID (tenant resident if active lease else primary owner resident).
2. Find `FamilyMember` links where `primaryResidentId` is that resident and `status === ACTIVE`.
3. Return `UnitAccess` rows on that unit with:
   - `role === FAMILY`, `status === ACTIVE`, `userId` in the resolved family user IDs.

### 3.3 Update family profile (`PATCH /owners/family/:userId`)

Allows an owner to update a family member’s profile if:

- The target user currently has an active `UnitAccess(role=FAMILY)`.
- The caller has an active `UnitAccess(role=OWNER)` on the same unit as that family access.

Updates:

- Same fields as `updateOwnProfile` (user profile + optional resident national ID).

### 3.4 Revoke family access for a unit (`POST /owners/units/:unitId/remove-user/:userId`)

This endpoint is intentionally limited:

- It can revoke only `UnitAccess(role=FAMILY)` records.
- It **will not** remove tenant access (tenants must be removed by terminating the lease).
- It **will not** remove owner access (ownership flows handle that).

Authorization (as implemented):

- Admin can revoke any family access on the unit.
- Non-admin:
  - If unit has an active lease, only the active tenant can remove family from that unit.
  - Otherwise, only an owner with active owner access can remove family.
  - Additionally, non-admin can only revoke access for family members that are linked (via `FamilyMember`) to the current resident.

Side effect:

- Sets `UnitAccess.status = REVOKED` and `endsAt = now()` for the matching unit access record.

## Gotchas / inconsistencies to be aware of

- `CreateOwnerWithUnitDto.email` is typed optional (`email?: string`) but is decorated with `@IsNotEmpty()` and not `@IsOptional()`, so validation may treat it as required.
- `CreateOwnerWithUnitDto.nationalId` is required by validation, but service code checks `if (dto.nationalId)` (suggesting it was once optional).
- `UpdateProfileDto` contains `nationalIdPhotoId`, but the service does not use it.
- `DELETE /owners/:id` deletes the `Owner` record and flips the unit to `UNRELEASED` (as `any`), but does **not** revoke unit access, remove resident mappings, or clean up related records. Treat this endpoint carefully.
- The module provides `/owners/upload/...` endpoints; they upload the file and attach it to the authenticated user. For uploads that should not mutate the current user, use the File module (`/files/upload/...`) and pass the resulting IDs.

## Relevant code entry points

- `src/modules/owners/owners.controller.ts`
- `src/modules/owners/owners.service.ts`
- `src/modules/owners/dto/create-owner-with-unit.dto.ts`
- `src/modules/owners/dto/add-family-member.dto.ts`
- `src/modules/owners/dto/update-profile.dto.ts`
