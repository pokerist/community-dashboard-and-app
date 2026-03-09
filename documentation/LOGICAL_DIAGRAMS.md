# LOGICAL_DIAGRAMS

## 1) RBAC Access Resolution

```mermaid
flowchart TD
  A[JWT userId] --> B[AccessResolverService.resolveUserAccess]
  B --> C[Load User + Roles + Overrides]
  C --> D[Resolve Effective Permissions]
  D --> E[Resolve Effective Modules]
  C --> F[Resolve Effective Personas]
  C --> G[Resolve Unit Statuses]
  E --> H[Load ScreenDefinition by surface]
  F --> I[Load ScreenVisibilityRule by persona + unitStatus]
  G --> I
  H --> J[Compute visibleScreens]
  I --> J
  D --> K[effectivePermissions[]]
  E --> L[effectiveModules[]]
  F --> M[effectivePersonas[]]
  J --> N[visibleScreens[]]
```

## 2) Admin Web Navigation Gating

```mermaid
flowchart LR
  A[/auth/me/access?surface=ADMIN_WEB/] --> B[visibleScreens]
  B --> C[App.tsx allowedSections]
  C --> D[AppSidebar filter items]
  C --> E[Route Guard]
  E -->|forbidden section| F[Redirect first allowed section]
  E -->|regular user + has my-account| G[Default to my-account]
```

## 3) Mobile Screen Manifest Gating

```mermaid
flowchart TD
  A[/mobile/screen-manifest] --> B[getCurrentUserBootstrap]
  A --> C[resolveUserAccess surface=MOBILE_APP]
  C --> D[visibleScreens from matrix]
  B --> E[featureAvailability from auth bootstrap]
  D --> F[Matrix gate]
  E --> G[Feature gate]
  F --> H[Final visible screen list]
  G --> H
```

## 4) Core ERD (RBAC + Governance + Units)

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : assigned_to
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : granted
  ROLE ||--o{ ROLE_STATUS_PERMISSION : conditional_grants
  PERMISSION ||--o{ ROLE_STATUS_PERMISSION : granted
  USER ||--o{ USER_PERMISSION_OVERRIDE : overrides
  PERMISSION ||--o{ USER_PERMISSION_OVERRIDE : overridden

  PERSONA ||--o{ ROLE_PERSONA : linked_to_role
  ROLE ||--o{ ROLE_PERSONA : links
  USER ||--o{ USER_PERSONA_OVERRIDE : overrides
  PERSONA ||--o{ USER_PERSONA_OVERRIDE : overridden

  SCREEN_DEFINITION ||--o{ SCREEN_VISIBILITY_RULE : has_rules
  PERSONA ||--o{ SCREEN_VISIBILITY_RULE : scoped_by

  USER ||--o{ UNIT_ACCESS : unit_membership
  UNIT ||--o{ UNIT_ACCESS : access_entries
  COMMUNITY ||--o{ UNIT : contains

  USER ||--o{ COMMERCIAL_ENTITY_MEMBER : commercial_membership
  COMMERCIAL_ENTITY ||--o{ COMMERCIAL_ENTITY_MEMBER : members
  COMMUNITY ||--o{ COMMERCIAL_ENTITY : contains

  USER {
    string id PK
    string email
    string userStatus
  }
  ROLE {
    string id PK
    string name
    bool isSystem
  }
  PERMISSION {
    string id PK
    string key
  }
  PERSONA {
    string id PK
    string key
    bool isSystem
    bool isActive
  }
  SCREEN_DEFINITION {
    string id PK
    string key
    string section
    string surface
    string moduleKey
  }
  SCREEN_VISIBILITY_RULE {
    string id PK
    string surface
    string unitStatus
    bool visible
  }
  UNIT {
    string id PK
    string status
    string communityId
  }
  UNIT_ACCESS {
    string id PK
    string role
    string status
  }
```
