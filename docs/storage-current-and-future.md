# Storage Current and Future

## Non-Negotiable Constraint (current phase)
Do not force migration to S3 now. Local development storage must stay functional.

## Current Implementation
- Storage provider is resolved at runtime through integration settings (`IntegrationConfigService.getStorageRuntimeConfig`).
- `FileService` chooses adapter in this order:
  1. S3 adapter when provider is `S3` and fully configured.
  2. Supabase adapter when provider is `SUPABASE` and fully configured.
  3. Local fallback when provider is incomplete or local is selected.
- If enabled provider config is incomplete, backend logs warning and falls back to local mode.

## Why Local Still Works
- Runtime config marks `LOCAL` provider as configured.
- File operations continue through local-compatible adapter mode without external credentials.
- Deploy script also auto-enables mock/provider-safe defaults when credentials are missing.

## Stabilization Actions (now)
- Keep local fallback behavior explicit and documented.
- Prevent production assumptions from leaking into local dev.
- Keep bucket/category resolution centralized in `FileService`.

## Production-Ready Later (without breaking now)
1. Add pre-signed upload/download endpoints for S3-compatible providers.
2. Move large file transfer path from backend relay to direct object storage URLs.
3. Keep metadata persistence in DB unchanged.
4. Keep local mode for CI/dev as fallback profile.

## Classification
- `safe now`: document and preserve local fallback, tighten adapter boundaries.
- `safe with verification`: add provider health checks to startup diagnostics.
- `defer`: mandatory pre-signed URL migration.
- `risky/manual review`: removing local storage path before CI/dev replacement is proven.
