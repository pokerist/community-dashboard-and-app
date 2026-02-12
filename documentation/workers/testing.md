# Workers / Contractors - Postman / API Testing

## Setup

Recommended environment variables:

- `BASE_URL` (example: `http://localhost:3000`)
- `ACCESS_TOKEN` (JWT)
- `UNIT_ID` (a unit where the requester is an ACTIVE DELEGATE/OWNER as required)
- `CONTRACTOR_ID`
- `WORKER_ID`

All requests below require:

- `Authorization: Bearer {{ACCESS_TOKEN}}`

Local testing without HikCentral:

- Set `HIKCENTRAL_MOCK=true` (or leave `HIKCENTRAL_BASE_URL` unset).

Delegate prerequisites (for most flows):

- `UnitAccess` for `UNIT_ID` must be `status=ACTIVE`, `role=DELEGATE`
- `canManageWorkers=true`
- For QR generation: `canGenerateQR=true`

Notes:

- Contractor membership is required for worker write actions; `POST /contractors` auto-creates the caller as an ACTIVE `ContractorMember` with role `ADMIN`.

## 1) Create Contractor

`POST {{BASE_URL}}/contractors`

Body:
```json
{
  "unitId": "{{UNIT_ID}}",
  "name": "ACME Interiors"
}
```

Expected:
- 201/200 with the created `Contractor` row.

Test cases:
- Delegate without ACTIVE unit access -> 403
- Delegate with `canManageWorkers=false` -> 403
- Duplicate contractor name -> 409

## 2) List Contractors

Mine (no unit scope):

`GET {{BASE_URL}}/contractors`

Expected:
- Contractors where requester is an ACTIVE `ContractorMember`.

By unit scope:

`GET {{BASE_URL}}/contractors?unitId={{UNIT_ID}}`

Expected (current behavior):
- Admin/Owner: contractors that have workers registered on that unit.
- Delegate: same, but only contractors the delegate belongs to.

## 3) Register Worker

`POST {{BASE_URL}}/workers`

Body:
```json
{
  "unitId": "{{UNIT_ID}}",
  "contractorId": "{{CONTRACTOR_ID}}",
  "fullName": "Ahmed Ali",
  "nationalId": "29801011234567",
  "phone": "+201234567890",
  "jobType": "Electrician",
  "photoId": "optional-photo-ref"
}
```

Expected:
- 201/200 with created `Worker` including `accessProfile` and `contractor`.

Test cases:
- Delegate not a contractor member (ADMIN/SUPERVISOR) -> 403
- Worker already exists for the same `(unitId, nationalId)` -> 409
- Inactive contractor -> 400

## 4) List Workers (by unit)

`GET {{BASE_URL}}/workers?unitId={{UNIT_ID}}`

Expected:
- Admin/Owner: all workers for the unit.
- Delegate: only workers under contractors the delegate belongs to.

## 5) Update Worker

`PATCH {{BASE_URL}}/workers/{{WORKER_ID}}`

Body:
```json
{
  "jobType": "Painter",
  "status": "SUSPENDED"
}
```

Expected:
- 200 with updated `Worker` (and updated `accessProfile` if identity fields were included).

Test cases:
- Delegate not contractor ADMIN/SUPERVISOR -> 403
- Worker not found -> 404

## 6) Generate Worker QR

`POST {{BASE_URL}}/workers/{{WORKER_ID}}/qr`

Body (optional):
```json
{
  "validFrom": "2026-02-12T09:00:00.000Z",
  "validTo": "2026-02-12T17:00:00.000Z",
  "gates": ["GATE_A"],
  "notes": "Shift access"
}
```

Defaults:
- If `validTo` is omitted, the service generates an 8-hour window starting at `validFrom` (or now).

Expected:
- 201/200 with:
  - `qrCode` (DB row in `AccessQRCode`, `type=WORKER`)
  - `qrImageBase64`

Test cases:
- Worker not ACTIVE -> 400
- Delegate missing `canGenerateQR` -> 403
- Delegate not contractor member -> 403
- `validTo <= validFrom` -> 400

