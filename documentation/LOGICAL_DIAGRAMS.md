# Logical Diagrams (Backend + Admin)

This document maps system logic for handover and implementation alignment.

## L0) System Context
```mermaid
flowchart LR
  AW[Admin Web\nReact/Vite] -->|REST + JWT| API[NestJS Backend]
  API --> DB[(PostgreSQL + Prisma)]

  API --> FS[File Storage\nLOCAL/S3/Supabase]
  API --> NTF[Notification Providers\nSMTP/SMS/FCM/Expo]
  API --> ACC[Access Integrations\nHikCentral/QR]

  OPS[PM2 + Deploy Scripts] --> API
  OPS --> AW
```

## L1) Domain Flow - Auth and Identity
```mermaid
flowchart TD
  U[User/Admin] --> L[POST /auth/login]
  L --> T[Access + Refresh Tokens]
  T --> M[GET /auth/me]
  M --> P[Resolved Persona + Permissions + Units + FeatureAvailability]

  T --> R[POST /auth/refresh]
  R --> T

  subgraph Approval Onboarding
    S[POST /signup] --> PR[PendingRegistration]
    A[Admin Approval Flow] --> CU[Create User + Profile + Unit Links]
  end
```

## L1) Domain Flow - Property Authority Chain
```mermaid
flowchart TD
  C[Community/Cluster] --> U[Unit]
  U --> UA[UnitAccess]
  U --> LS[Lease]

  USR[User] --> UA
  USR --> LS

  UA --> R1[Role on Unit\nOWNER/TENANT/FAMILY/DELEGATE]
  UA --> CAP[Capabilities\nQR/Bookings/Finance/Workers]

  R1 --> PH[Persona Resolution in /auth/me]
  CAP --> PH
```

## L1) Domain Flow - Operations Lifecycle
```mermaid
flowchart LR
  RES[Resident/Authorized User] --> SR[Service Request]
  RES --> CP[Complaint]
  RES --> BK[Booking]
  RES --> QR[Access QR]

  ADM[Admin/Staff] --> MG[Operational Management]
  MG --> SR
  MG --> CP
  MG --> VL[Violation]
  MG --> BK
  MG --> GT[Gates/Logs]

  SR --> EV[Domain Events]
  CP --> EV
  VL --> EV
  BK --> EV
  GT --> EV
```

## L1) Domain Flow - Finance Lifecycle
```mermaid
flowchart TD
  SRC[Operational Source\nService/Violation/Booking/Manual/Fee] --> INV[Invoice]
  INV --> ST[Status\nPENDING/PAID/OVERDUE/CANCELLED]
  ST --> REP[Stats + Dashboard + Reports]

  UF[Unit Fees] --> GEN[Invoice Generation]
  GEN --> INV
```

## L1) Domain Flow - Notifications and Delivery
```mermaid
flowchart TD
  TR[Trigger\n(Admin action or domain event)] --> N[Notification]
  N --> PAY[Payload\nroute/entityType/entityId]
  N --> AUD[Audience + channel rules]
  N --> LOG[NotificationLog records]
  LOG --> CH[Delivery Providers]
```

## L1) Domain Flow - Settings, Branding, Mobile Config
```mermaid
flowchart TD
  ADM[Admin Settings UI] --> SB[PATCH /system-settings/brand]
  ADM --> SM[PATCH /system-settings/mobile-access]
  ADM --> SO[PATCH /system-settings/onboarding/offers]

  SB --> SS[(SystemSetting sections)]
  SM --> SS
  SO --> SS

  SS --> AC[GET /mobile/app-config]
  SS --> MF[GET /mobile/screen-manifest]
  AUTH[GET /auth/me] --> MF

  MF --> CL[Client UI Visibility + Actions]
```

## L2) Data Logic Map (Core Models)
```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : assigned_to
  ROLE ||--o{ ROLE_PERMISSION : has
  PERMISSION ||--o{ ROLE_PERMISSION : grants

  USER ||--o{ UNIT_ACCESS : granted
  UNIT ||--o{ UNIT_ACCESS : scoped_by

  USER ||--o{ LEASE : owner_or_tenant
  UNIT ||--o{ LEASE : leased_for

  USER ||--o{ SERVICE_REQUEST : creates
  UNIT ||--o{ SERVICE_REQUEST : for_unit

  UNIT ||--o{ INVOICE : has
  USER ||--o{ INVOICE : billed_to
  SERVICE_REQUEST ||--o{ INVOICE : source

  USER ||--o{ NOTIFICATION : sends
  NOTIFICATION ||--o{ NOTIFICATION_LOG : delivered_as

  SYSTEM_SETTING ||--|| CONFIG_JSON : stores_sections
```

## Manifest Logic Notes
`GET /mobile/screen-manifest` should be treated as the canonical visibility contract for clients.

Inputs:
- `GET /auth/me` output (`resolvedPersona`, `permissions`, `featureAvailability`)
- settings section `mobileAccess`

Outputs per screen:
- screen key
- visibility boolean
- enabled actions
- required permission keys
- persona guards
- feature-flag source
