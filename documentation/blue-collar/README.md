# Blue Collar Module Expansion (`src/modules/workers`)

## Scope

This expansion adds the missing blue-collar operational workflow requested by management:

- Community-level blue-collar settings
  - Work calendar (`workDays`)
  - Working hours (`workStartTime`, `workEndTime`)
  - Holidays list
  - Terms and conditions
  - Admin approval toggle
- Delegate/owner request flow
  - Submit worker access request with validity window + gate scope
  - Attach worker ID reference (`idDocumentRef`)
- Admin review flow
  - Approve request -> issue `AccessGrant` + HikCentral QR + `AccessQRCode`
  - Reject request with explicit reason

## Data Model

New Prisma entities:

- `BlueCollarSetting`
- `BlueCollarAccessRequest`

New enums:

- `BlueCollarRequestStatus`: `PENDING | APPROVED | REJECTED | CANCELLED`
- `BlueCollarWeekDay`: `MONDAY ... SUNDAY`

Both entities include:

- `createdAt`
- `updatedAt`
- `deletedAt` (soft-delete support)

## Endpoints

Base route: `/blue-collar`

- `GET /blue-collar/settings/:communityId`
- `PUT /blue-collar/settings` (admin only)
- `POST /blue-collar/requests`
- `GET /blue-collar/requests`
- `PUT /blue-collar/requests/:id/review` (admin only)

## Authorization Behavior

- Settings + review endpoints require admin account.
- Request creation:
  - Admin allowed.
  - Owner/delegate allowed if unit access is active and `canManageWorkers=true`.
  - Delegate also needs ACTIVE contractor membership (`ADMIN` or `SUPERVISOR`).

## Validation Rules

- Request window must be valid (`requestedValidTo > requestedValidFrom`).
- Overlapping pending request for same worker is blocked.
- If settings exist, request must obey:
  - Allowed work days
  - Working-hour window
  - Non-holiday dates

