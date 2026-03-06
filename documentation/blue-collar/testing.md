# Blue Collar Testing

## Unit tests

Run:

```bash
npm test -- src/modules/workers/blue-collar.service.spec.ts
```

Covers:

- settings upsert
- request submission
- admin approval
- admin rejection
- forbidden review for non-admin

## Integration tests

Run:

```bash
npm run test:e2e -- test/workers/blue-collar.e2e-spec.ts
```

Covers:

- `PUT /blue-collar/settings`
- `POST /blue-collar/requests`
- `PUT /blue-collar/requests/:id/review`
- `GET /blue-collar/requests`
