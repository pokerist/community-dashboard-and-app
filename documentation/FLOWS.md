# FLOWS

## 1) Login -> Bootstrap -> UI Access

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Admin Web
  participant BE as Auth API
  participant AR as AccessResolver
  participant DB as PostgreSQL

  U->>FE: Login
  FE->>BE: POST /auth/login
  BE-->>FE: access_token + refresh_token

  FE->>BE: GET /auth/me
  BE-->>FE: bootstrap profile + featureAvailability

  FE->>BE: GET /auth/me/access?surface=ADMIN_WEB
  BE->>AR: resolveUserAccess(userId)
  AR->>DB: roles/permissions/personas/rules/units
  AR-->>BE: effectivePermissions/modules/personas/visibleScreens
  BE-->>FE: access map

  FE->>FE: filter sidebar + guard routes
```

## 2) Dashboard Users as Single RBAC Control Plane

```mermaid
sequenceDiagram
  participant FE as Dashboard Users Page
  participant BE as Users API
  participant DB as PostgreSQL

  FE->>BE: GET /admin/users/dashboard
  FE->>BE: GET /admin/users/roles
  FE->>BE: GET /admin/users/permissions
  FE->>BE: GET /admin/users/personas
  FE->>BE: GET /admin/users/screens?surface=ADMIN_WEB
  FE->>BE: GET /admin/users/screen-visibility-rules?surface=ADMIN_WEB
  BE->>DB: read canonical RBAC data
  BE-->>FE: unified payloads

  FE->>BE: PATCH /admin/users/dashboard/:id/roles
  FE->>BE: PUT /admin/users/:id/permission-overrides
  FE->>BE: PATCH /admin/users/:id/persona-override
  FE->>BE: PUT /admin/users/screen-visibility-rules
  BE->>DB: update canonical tables
```

## 3) Role Creation/Update Flow

```mermaid
flowchart TD
  A[Role Dialog Step 1
  Details + Personas] --> B[Step 2 Modules]
  B --> C[Step 3 Base/Status Permissions]
  C --> D[Step 4 Review]
  D --> E[POST/PATCH /admin/users/roles]
  E --> F[Role + RolePermission + RoleModuleAccess + RolePersona]
  F --> G[Success toast + list refresh]
```

## 4) Screen Governance Flow

```mermaid
flowchart TD
  A[Create Persona] --> B[/admin/users/personas]
  C[Create Screen] --> D[/admin/users/screens]
  E[Toggle Matrix Cell
  persona x screen x unitStatus] --> F[Local draft]
  F --> G[PUT /admin/users/screen-visibility-rules]
  G --> H[ScreenVisibilityRule rows replaced for surface]
```

## 5) Mobile Manifest Resolution Flow

```mermaid
sequenceDiagram
  participant APP as Mobile App
  participant API as Mobile Controller
  participant AUTH as AuthService
  participant AR as AccessResolver

  APP->>API: GET /mobile/screen-manifest (JWT)
  API->>AUTH: getCurrentUserBootstrap
  API->>AR: resolveUserAccess(surface=MOBILE_APP)
  AR-->>API: visibleScreens + effectivePersonas + permissions
  AUTH-->>API: featureAvailability
  API->>API: matrix gate AND feature gate
  API-->>APP: resolvedPersona + screens[]
```

## 6) Deprecated/Dropped Duplicate Paths

- Removed compatibility paths:
  - `/admin/system-users*`
  - `/admin/roles*`
- Canonical RBAC endpoints stay under `/admin/users/*`.
