# Owners Module - Postman Testing Guide

This file is meant to be used as a practical testing checklist for `src/modules/owners`.

## Postman environment variables

Recommended variables:

- `baseUrl` (example: `http://localhost:3000`)
- `adminToken`
- `ownerToken`
- `unitId_available` (a unit with `status=AVAILABLE`)
- `unitId_delivered` (a unit with `status` in `DELIVERED | OCCUPIED | LEASED`)
- `ownerId` (note: this is **Owner.id**, not User.id)
- `ownerUserId` (User.id for the owner)
- `familyUserId`
- `fileId_nationalId` (File.id with category `NATIONAL_ID`)
- `fileId_profilePhoto` (File.id with category `PROFILE_PHOTO`)
- `fileId_birthCert` (File.id with category `BIRTH_CERTIFICATE`)
- `fileId_marriageCert` (File.id with category `MARRIAGE_CERTIFICATE`)

## Authentication

All routes require:

- Header: `Authorization: Bearer {{adminToken}}` (or `{{ownerToken}}`)
- Header: `Content-Type: application/json` (unless uploading files)

To get a token:

`POST {{baseUrl}}/auth/login`

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

## File uploads (prerequisite for most Owners flows)

The Owners module validates files by `File.category`:

- Upload national ID document: `POST {{baseUrl}}/files/upload/national-id` (form-data key `file`)
- Upload profile photo: `POST {{baseUrl}}/files/upload/profile-photo` (form-data key `file`)
- Upload birth certificate: `POST {{baseUrl}}/files/upload/birth-certificate` (form-data key `file`)
- Upload marriage certificate: `POST {{baseUrl}}/files/upload/marriage-certificate` (form-data key `file`)

Each returns an object including `id` (use it as the `...FileId` field).

## 1) Create owner with unit

`POST {{baseUrl}}/owners/create-with-unit`

Headers:

- `Authorization: Bearer {{adminToken}}`

Body:

```json
{
  "name": "Owner Name",
  "email": "owner@example.com",
  "phone": "+201234567890",
  "nationalId": "12345678901234",
  "nationalIdPhotoId": "{{fileId_nationalId}}",
  "unitId": "{{unitId_available}}"
}
```

Expected:

- `200/201` with `userId` and `randomPassword`.
- Unit is updated to `status=NOT_DELIVERED`.
- `UnitAccess(role=OWNER, status=ACTIVE)` exists for this unit and user.

Negative test cases:

- Unit is not `AVAILABLE` -> `400 Unit not available for assignment`
- Duplicate phone -> `409 Phone already registered`
- Duplicate email -> `409 Email already registered`
- Duplicate national ID -> `409 National ID already exists`
- `nationalIdPhotoId` missing/invalid/wrong category -> `400`

## 2) List owners

`GET {{baseUrl}}/owners`

Expected:

- `200` array of owners including `user`.

## 3) Get owner by Owner.id

`GET {{baseUrl}}/owners/{{ownerId}}`

Expected:

- `200` owner object including `user`.

Negative:

- Invalid ID -> `400 Owner not found`

## 4) Delete owner by Owner.id (use with caution)

`DELETE {{baseUrl}}/owners/{{ownerId}}`

Expected:

- `200` with deleted owner data.

Notes:

- Current implementation does not clean up `UnitAccess`/`ResidentUnit`.
- Unit status may be set to `UNRELEASED`.

## 5) Update own profile

`PATCH {{baseUrl}}/owners/profile`

Headers:

- `Authorization: Bearer {{ownerToken}}`

Body example:

```json
{
  "nameEN": "Updated Owner Name",
  "phone": "+201234567891",
  "profilePhotoId": "{{fileId_profilePhoto}}",
  "nationalId": "12345678901235"
}
```

Expected:

- `200` updated `User` including `resident`.

Negative test cases:

- Duplicate email/phone/nationalId -> `409`

## 6) Add family member to a unit (authority-aware)

Endpoint:

`POST {{baseUrl}}/owners/family/{{unitId_delivered}}`

Headers:

- `Authorization: Bearer {{ownerToken}}` (or tenant token if the unit has an active lease)

### 6.1 Add SPOUSE

```json
{
  "relationship": "SPOUSE",
  "name": "Spouse Name",
  "email": "spouse@example.com",
  "phone": "+201111111111",
  "personalPhotoId": "{{fileId_profilePhoto}}",
  "marriageCertificateFileId": "{{fileId_marriageCert}}"
}
```

Expected:

- `200` with `userId` and `randomPassword`.
- A `FamilyMember` link exists for the current resident.
- `UnitAccess(role=FAMILY, source=FAMILY_AUTO)` is created for the family user on **all units** of the current resident (via `ResidentUnit`).

### 6.2 Add CHILD (under 16)

```json
{
  "relationship": "CHILD",
  "name": "Child Name",
  "email": "child@example.com",
  "phone": "+201222222222",
  "personalPhotoId": "{{fileId_profilePhoto}}",
  "birthDate": "2015-01-01",
  "birthCertificateFileId": "{{fileId_birthCert}}"
}
```

Expected:

- `200` with `userId` and `randomPassword`.
- `ResidentDocument(type=BIRTH_CERTIFICATE)` is created for the new resident.

### 6.3 Add CHILD (16+)

```json
{
  "relationship": "CHILD",
  "name": "Teen Name",
  "email": "teen@example.com",
  "phone": "+201333333333",
  "personalPhotoId": "{{fileId_profilePhoto}}",
  "birthDate": "2000-01-01",
  "nationalId": "11112222333344",
  "nationalIdFileId": "{{fileId_nationalId}}"
}
```

Expected:

- `200`
- `ResidentDocument(type=NATIONAL_ID)` is created for the new resident.

### 6.4 Admin override (linking to a specific resident)

`POST {{baseUrl}}/owners/family/{{unitId_delivered}}?targetResidentId=<residentId>`

Headers:

- `Authorization: Bearer {{adminToken}}`

Body: same as above.

Negative test cases:

- Unit not delivered (`status=NOT_DELIVERED`, etc.) -> `400 Unit must be delivered to add family members`
- Caller is not current authority -> `403 You do not have permission to add family members`
- Missing required file IDs -> `400`
- File category mismatch (wrong upload endpoint) -> `400 File <id> has category X, expected Y`

## 7) List family members for a unit (current resident only)

`GET {{baseUrl}}/owners/family/{{unitId_delivered}}`

Expected:

- `200` array of `UnitAccess` records with `role=FAMILY` for the current resident’s family.

Negative:

- Caller has no `UnitAccess(role=OWNER|TENANT)` for that unit -> `403 You do not have access to this unit`

## 8) Update family member profile

`PATCH {{baseUrl}}/owners/family/{{familyUserId}}`

Headers:

- `Authorization: Bearer {{ownerToken}}`

Body:

```json
{
  "nameEN": "Updated Family Name",
  "phone": "+201444444444",
  "profilePhotoId": "{{fileId_profilePhoto}}"
}
```

Expected:

- `200` updated family `User` including `resident`.

Negative:

- Owner doesn’t have `UnitAccess(role=OWNER)` on the same unit -> `403`
- Duplicate email/phone/nationalId -> `409`

## 9) Revoke family access for a unit

`POST {{baseUrl}}/owners/units/{{unitId_delivered}}/remove-user/{{familyUserId}}`

Expected:

- `200 { \"message\": \"User access revoked successfully\" }`
- The family member’s `UnitAccess` for this unit is updated to `status=REVOKED` and `endsAt` is set.

Negative:

- Trying to revoke a TENANT -> `400 Cannot remove tenant access from here. Terminate the lease instead.`
- Trying to revoke an OWNER -> `400 Cannot remove owner access from here. Use the ownership management flow instead.`
- Non-admin revoking someone not linked to their family -> `403 You can only remove your own family members from this unit`

