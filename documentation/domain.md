# domain

## Domain Boundaries

- `Identity`: authentication, sessions, refresh tokens, profile/security settings.
- `Authorization (RBAC)`: roles, permissions, role-module access, status-aware permission extensions, user overrides.
- `Persona Governance`: persona catalog, role-persona links, user persona overrides.
- `Screen Governance`: screen catalog + visibility matrix by `persona x surface x unitStatus`.
- `Property Model`: community/phase/cluster/unit + dynamic unit status.
- `Membership Model`: unit access roles + commercial entity membership roles.

## Canonical RBAC Tables

- `Role`
- `Permission`
- `RolePermission`
- `RoleStatusPermission`
- `RoleModuleAccess`
- `UserRole`
- `UserPermissionOverride`
- `Persona`
- `RolePersona`
- `UserPersonaOverride`
- `ScreenDefinition`
- `ScreenVisibilityRule`

## Resolution Rules

1. `effectivePermissions` = role base permissions + role status permissions (unit status scoped) + user overrides.
2. `effectiveModules` = permission cache module derivation from role names.
3. `effectivePersonas` =
   - built-in inferred personas (`ADMIN`, `OWNER`, `TENANT`, `RESIDENT`, etc.),
   - `RolePersona` links,
   - `UserPersonaOverride` grants/removals.
4. `visibleScreens` = rules in `ScreenVisibilityRule` filtered by `surface + personaIds + unitStatuses`.
5. `SUPER_ADMIN` bypass = all active screen sections visible.

## User Segments

- `Dashboard/Admin users`: super admin, manager/admin staff, operations staff.
- `Resident-side users`: owner, tenant, family, delegate/authorized, contractor, pre-delivery owner.
- `Commercial users`: commercial owner/staff members through `CommercialEntityMember`.

## Surface Strategy

- `ADMIN_WEB`: same app can serve admin/staff and regular accounts.
  - Regular accounts default to `my-account` when privileged sections are not visible.
- `MOBILE_APP`: screen manifest visibility is now matrix-aware through `AccessResolver` with fallback to feature flags.

## Unit Status Strategy

Canonical statuses used by matrix policies:

- `OFF_PLAN`
- `UNDER_CONSTRUCTION`
- `DELIVERED`

Rules are stored per status in `ScreenVisibilityRule`, so visibility can shift automatically when unit status changes.

## API Contract (RBAC)

Canonical:

- `GET /auth/me/access`
- `GET/POST/PATCH/DELETE /admin/users/personas`
- `GET/POST/PATCH/DELETE /admin/users/screens`
- `GET/PUT /admin/users/screen-visibility-rules`
- `GET/PATCH /admin/users/:id/persona-override`
- `GET/PUT /admin/users/:id/permission-overrides`
- `GET/POST/PATCH/DELETE /admin/users/roles`
- `GET/PATCH /admin/users/dashboard/*`

Removed duplicate compat:

- `/admin/system-users*`
- `/admin/roles*`
