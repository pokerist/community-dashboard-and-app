# Cleanup Report

This report is code-truth based and preserves the current working local flow.

## Summary
- Backend and admin both build successfully in current state.
- Core hierarchy refactor (`Community -> Phase -> Cluster`) is implemented and active in schema/services.
- Main cleanup priority is contract stabilization and module boundary clarity, not aggressive rewrites.

## Findings and Actions

### 1) Admin settings route drift
- Exists now: admin page calls `/admin/settings`.
- Problem/risk: backend canonical controller is `/system-settings`; call drift causes 404 fallback behavior and hidden failures.
- Proposed cleanup: switch admin calls to `/system-settings` routes only.
- Classification: `safe now`.

### 2) Rental request route duplication
- Exists now: admin code references `/rental/rent-requests/*`, `/rental/requests/*`, and `/rent-requests/*` families.
- Problem/risk: duplicate route families increase regression risk and confusion.
- Proposed cleanup: choose one canonical family for admin and mark others deprecated.
- Classification: `safe with verification`.

### 3) Legacy `ResidentUnit` still present
- Exists now: schema includes `ResidentUnit` and marks it legacy.
- Problem/risk: accidental permission reads from legacy table can cause inconsistent access behavior.
- Proposed cleanup: keep model for compatibility, enforce `UnitAccess` usage in new/updated code and docs.
- Classification: `safe now` (documentation + guardrails), deletion is `defer`.

### 4) Oversized orchestration services
- Exists now: large `AuthService` and `NotificationsService`.
- Problem/risk: high coupling, harder testing, regression-prone edits.
- Proposed cleanup: split by responsibility (token/session, OTP, profile-change; audience-resolver, dispatchers, aggregation).
- Classification: `safe with verification`.

### 5) Circular dependency hotspots
- Exists now: `forwardRef` around Auth <-> Notifications / Referrals / SystemSettings.
- Problem/risk: hidden init-order coupling and harder reasoning.
- Proposed cleanup: introduce ports/interfaces and event-driven boundaries where feasible.
- Classification: `defer until after launch` unless active bug forces change.

### 6) Historical documentation drift
- Exists now: `documentation/` includes historical audits and references that may diverge.
- Problem/risk: onboarding decisions based on stale assumptions.
- Proposed cleanup: treat new `/docs` pack as handover baseline and mark older docs as historical.
- Classification: `safe now`.

### 7) `apps/community-mobile` ambiguity
- Exists now: repo contains both `community-mobile` and `community-mobile-native`.
- Problem/risk: accidental contract work against non-runtime client.
- Proposed cleanup: explicitly label `community-mobile` as reference-only in docs and handover.
- Classification: `safe now`.

### 8) Deploy/seed coupling
- Exists now: deploy can run demo/professional seeds depending on flags.
- Problem/risk: wrong seed path in production-like environments.
- Proposed cleanup: strict runbook separating required baseline seed vs optional demo seed.
- Classification: `safe now`.

### 9) Prisma production path
- Exists now: deploy path uses `prisma db push`.
- Problem/risk: schema drift and reduced migration auditability in long-lived production.
- Proposed cleanup: keep current local/dev path, add staged production path with `prisma migrate deploy`.
- Classification: `safe with verification`.

### 10) Storage migration pressure
- Exists now: storage abstraction supports S3/SUPABASE/LOCAL with local fallback.
- Problem/risk: forcing S3 now would break local/dev reliability.
- Proposed cleanup: preserve local mode; plan presigned URL rollout later.
- Classification: `defer until after launch` for mandatory S3 migration.

## Items Requiring Manual Review
- Any deletion of old controllers/routes currently called by admin.
- Any auth policy changes affecting session takeover behavior.
- Any table removal (`ResidentUnit`, legacy route support) before full usage audit.

## Verification Performed
- Backend build: passed (`npm run build`).
- Admin build: passed (`npm run build` in `apps/admin-web`).
