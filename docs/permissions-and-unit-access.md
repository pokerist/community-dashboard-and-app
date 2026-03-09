# Permissions and Unit Access

## Source of Truth
Use `UnitAccess` as the single source of truth for resident/owner/tenant/family/delegate access.

Do not base access decisions on `ResidentUnit`.

## Access Resolution (current)
1. JWT validated (`JwtStrategy`) and user loaded with role assignments.
2. Permissions are resolved from role->permission cache.
3. Domain services apply permission checks (`@Permissions`) and ownership checks.
4. For unit-scoped actions, active `UnitAccess` records are used.

## JWT and Session Invalidation
JWT includes `sv` (session version). On validation, token `sv` must match DB `user.sessionVersion`.

If mismatched, the session is invalidated by design (e.g., takeover/new login flow).

## Role Layers
- Platform roles: `SUPER_ADMIN`, `MANAGER`, `COMPOUND_STAFF`, etc.
- Domain role capabilities from permission map.
- Unit-level persona from `UnitAccess.role`.

## Practical Rules
- Admin-only actions should rely on permission guards, not just role-name string checks.
- Mobile feature gating should read:
  - `/auth/me` featureAvailability
  - `/mobile/screen-manifest` screen/action guards
- Every new unit-linked feature should require unit access validation before data access.

## Refactor Safety Notes
- Safe now: centralize repeated unit-access guard logic in shared helpers.
- Safe with verification: replace direct role-name checks with permission checks where possible.
- Defer: removing `ResidentUnit` physically from DB until all historical reads are audited.
- Risky/manual review: bulk permission rewrites across modules without contract tests.
