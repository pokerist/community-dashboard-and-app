# Compound Staff - Testing

## Automated

Unit tests:

```bash
npm test -- compound-staff.service.spec.ts
```

E2E tests:

```bash
npm run test:e2e -- test/compound-staff/compound-staff.e2e-spec.ts
```

## Manual API Flow

1. Create staff profile:

`POST /compound-staff`

```json
{
  "userId": "user-uuid",
  "profession": "Security Guard",
  "workSchedule": {
    "shift": "Sun-Thu 08:00-16:00"
  },
  "contractFrom": "2026-03-10T00:00:00.000Z",
  "contractTo": "2027-03-10T00:00:00.000Z",
  "permissions": ["ENTRY_EXIT", "ATTENDANCE"]
}
```

2. Update profile:

`PATCH /compound-staff/:id`

3. Replace permissions:

`PUT /compound-staff/:id/access`

```json
{
  "permissions": ["ENTRY_EXIT", "WORK_ORDERS"]
}
```

4. Soft delete profile:

`DELETE /compound-staff/:id`
