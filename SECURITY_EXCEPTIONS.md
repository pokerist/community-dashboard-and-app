# Security Exceptions (Production Dependencies)

## Policy
- Target: `0 critical`, `0 high`, `0 moderate` in `npm audit --omit=dev`.
- Low vulnerabilities are only allowed when explicitly documented and approved.
- CI enforces this policy via `npm run audit:prod:gate`.

## Current Approved Exception
- Scope: Firebase OTP/Auth dependency chain
- Direct package: `firebase-admin`
- Transitive packages:
  - `@google-cloud/firestore`
  - `@google-cloud/storage`
  - `google-gax`
  - `retry-request`
  - `teeny-request`
  - `http-proxy-agent`
  - `@tootallnate/once`
- Advisory in chain:
  - `GHSA-vpq2-c234-7xj6` (`@tootallnate/once`)

## Justification
- Firebase OTP verification is a required core auth path.
- `npm audit` suggests downgrading to `firebase-admin@10.3.0` for a clean tree, which is a breaking and unsupported regression for current implementation.
- No high/moderate/critical vulnerabilities remain in production dependencies.

## Reevaluation Cadence
- Re-check weekly during dependency maintenance.
- Re-check on each Firebase or Nest dependency upgrade.
- Remove this exception immediately when upstream fixes are available without breaking the auth flow.
