# Gates Testing

## Unit tests

```bash
npm test -- src/modules/gates/gates.service.spec.ts
```

## Integration tests

```bash
npm run test:e2e -- test/gates/gates.e2e-spec.ts
```

## Coverage focus

- gate create/update/delete behavior
- unit-gate mapping lifecycle
- gate log query
- endpoint wiring and permission guards

