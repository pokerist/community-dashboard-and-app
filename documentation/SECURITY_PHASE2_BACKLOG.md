# Security Phase 2 Backlog

This backlog tracks intentionally deferred security upgrades that are likely to require framework or library migration work.

## Deferred items

- Nest 10 dependency chain advisories (`@nestjs/platform-express` transitive `multer`, `qs`, etc.)
  - Target approach: framework-aligned upgrade path instead of `npm audit fix --force`.
  - Acceptance: backend boot + smoke endpoints + upload flows pass after upgrade.

- `xlsx` advisory (`GHSA-4r6h-8v6p-xvw6`, `GHSA-5pgg-2g8v-p4x9`) with no upstream fix in current package
  - Target approach: replace SheetJS usage with `exceljs` (or equivalent maintained alternative).
  - Acceptance: report export parity (columns, formatting, file download behavior) + regression test for export endpoints.

## Execution guardrails

- Keep upgrades in dedicated PRs (one topic per PR).
- No `audit fix --force` in production branch.
- Each PR must include:
  - `npm audit` before/after snapshot
  - backend startup validation
  - export/report regression checks when applicable
