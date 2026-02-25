# Community Dashboard Backend - System Flows Map

This file maps the implemented business flows across the backend.
For endpoint-level technical details, see each module in `documentation/*/README.md`.

## 1) Onboarding and Identity Flows

| Flow ID | Flow | Main Actors | Core Endpoints | Main Outcome |
|---|---|---|---|---|
| F-01 | Pending signup request | Public user | `POST /signup` | Creates `PendingRegistration` with `PENDING` status. |
| F-02 | Pending signup approval | Admin | `GET /admin/pending-registrations`, `PATCH /admin/pending-registrations/:id/approve` | Converts pending record into `User` + role/profile + unit assignment. |
| F-03 | Pending signup rejection | Admin | `PATCH /admin/pending-registrations/:id/reject` | Marks pending registration as `REJECTED`. |
| F-04 | Login | Any user | `POST /auth/login` | Issues `{accessToken, refreshToken}` after credential and access checks. |
| F-05 | Session refresh | Any user | `POST /auth/refresh` | Rotates refresh token and returns new token pair. |
| F-06 | Forgot/reset password | Any user | `POST /auth/forgot-password`, `POST /auth/reset-password` | Secure password reset with token/OTP. |
| F-07 | Email verification | Authenticated user | `POST /auth/send-email-verification`, `POST /auth/verify-email` | Sets `emailVerifiedAt`. |
| F-08 | Phone OTP verification | Authenticated user | `POST /auth/send-phone-otp`, `POST /auth/verify-phone-otp` | Sets `phoneVerifiedAt`. |
| F-09 | Referral invitation | Community user | `POST /referrals` | Creates referral invitation in `NEW` status. |
| F-10 | Referral signup conversion | Referred user | `POST /auth/signup-with-referral` | Creates user, marks referral as `CONVERTED`, issues tokens. |

## 2) Property and Access Authority Flows

| Flow ID | Flow | Main Actors | Core Endpoints | Main Outcome |
|---|---|---|---|---|
| F-11 | Unit lifecycle CRUD | Admin/manager | `GET/POST/PATCH/DELETE /units` | Maintains core `Unit` records and unit status. |
| F-12 | Unit resident assignment (legacy mapping) | Admin/manager | `POST /units/:id/assign-user`, `DELETE /units/:id/assigned-users/:userId` | Maintains `ResidentUnit` mapping for residency links. |
| F-13 | Owner onboarding with unit | Admin | `POST /owners/create-with-unit` | Creates owner user/profile and grants `UnitAccess(role=OWNER)`. |
| F-14 | Owner profile/family management | Owner/admin | `PATCH /owners/profile`, `POST/GET/PATCH /owners/family/:unitId` | Manages family members and access grants for unit authority chain. |
| F-15 | Lease lifecycle | Owner/admin | `POST/GET/PATCH/DELETE /leases`, `POST /leases/:leaseId/terminate` | Controls tenant assignment, lease state, and tenant/family access cascades. |
| F-16 | Add tenant to existing lease | Owner/admin | `POST /leases/:leaseId/add-tenant` | Creates tenant user/profile and links tenant access to lease unit. |
| F-17 | Delegate request/approval/revocation | Owner/admin | `POST /delegates/request`, `POST /delegates/:id/approve`, `POST /delegates/:id/revoke` | Creates and governs `UnitAccess(role=DELEGATE)` lifecycle. |
| F-18 | Clubhouse access approval gate | User/admin | `POST /clubhouse/request-access`, `POST /clubhouse/approve/:id`, `POST /clubhouse/reject/:id` | Adds/denies clubhouse eligibility for selected unit. |

## 3) Community Service and Operations Flows

| Flow ID | Flow | Main Actors | Core Endpoints | Main Outcome |
|---|---|---|---|---|
| F-19 | Facility catalog and slot rules | Admin/staff | `GET/POST/PATCH/DELETE /facilities` | Maintains facility availability, slot config, and exceptions. |
| F-20 | Booking creation and self-cancel | Community user | `POST /bookings`, `GET /bookings/me`, `PATCH /bookings/:id/cancel` | Creates booking after unit and slot policy checks; user can cancel own booking. |
| F-21 | Booking review/status | Staff/admin | `GET /bookings`, `PATCH /bookings/:id/status`, `GET /bookings/facility/:facilityId` | Staff controls booking status and dispatches related notifications. |
| F-22 | Service catalog management | Admin/staff | `GET/POST/PATCH/DELETE /services` | Maintains requestable service types. |
| F-23 | Service dynamic form management | Admin/staff | `GET/POST/PATCH/DELETE /service-fields` | Maintains service-specific dynamic form definitions. |
| F-24 | Service request creation | Community user | `POST /service-requests` | Creates request with field validation, unit-access checks, attachments. |
| F-25 | Service request processing | Staff/admin | `GET /service-requests`, `PATCH /service-requests/:id` | Assigns and transitions request status (`NEW` -> `IN_PROGRESS` -> `RESOLVED`/`CLOSED`). |
| F-26 | Complaint reporting lifecycle | Community/staff | `POST /complaints`, `GET /complaints`, `PATCH /complaints/:id/status`, `DELETE /complaints/:id` | Handles complaint submission, staff workflow, and deletion rules. |
| F-27 | Violation issuance lifecycle | Staff/admin | `POST /violations`, `GET /violations`, `PATCH /violations/:id`, `DELETE /violations/:id` | Issues violations, tracks status/appeals, handles cancellation constraints. |
| F-28 | Incident lifecycle | Staff/admin | `POST /incidents`, `GET /incidents/cards`, `GET /incidents/list`, `PATCH /incidents/:id/resolve` | Tracks incident creation, analytics list/cards, and response-time resolution. |

## 4) Financial and Notification Flows

| Flow ID | Flow | Main Actors | Core Endpoints | Main Outcome |
|---|---|---|---|---|
| F-29 | Manual invoice management | Staff/admin | `POST/GET/PATCH/DELETE /invoices`, `POST /invoices/:id/pay` | Handles invoice CRUD and payment state updates. |
| F-30 | Utility fee inputs and generation | Staff/admin | `POST/GET/DELETE /invoices/fees`, `POST /invoices/generate` | Builds monthly utility invoices from `UnitFee` records. |
| F-31 | Resident billing access | Community user | `GET /invoices/resident/:residentId`, `GET /invoices/:id` | Allows owned/resident invoice visibility with access checks. |
| F-32 | Notification creation and scheduling | Staff/admin | `POST /notifications` | Creates immediate or scheduled notifications with audience targeting. |
| F-33 | User notification consumption | Community user | `GET /notifications/me`, `PATCH /notifications/:id/read` | Reads in-app notifications and marks them as read. |
| F-34 | Admin notification operations | Admin/staff | `GET /notifications/admin/all`, `POST /notifications/admin/resend/:id` | Reviews deliveries and retries failed EMAIL logs. |

## 5) Access QR and Operational Workforce Flows

| Flow ID | Flow | Main Actors | Core Endpoints | Main Outcome |
|---|---|---|---|---|
| F-35 | Generic access QR lifecycle | User with QR right | `POST /access-qrcodes`, `GET /access-qrcodes`, `PATCH /access-qrcodes/:id/revoke` | Creates/list/revokes unit-scoped QRs (visitor, delivery, etc.). |
| F-36 | Contractor company lifecycle | Delegate/admin | `POST /contractors`, `GET /contractors` | Creates and lists contractor companies tied to operational access. |
| F-37 | Worker identity lifecycle | Delegate/admin | `POST /workers`, `GET /workers`, `PATCH /workers/:id` | Registers and updates worker profiles bound to unit+contractor. |
| F-38 | Worker QR generation | Delegate/admin | `POST /workers/:id/qr` | Issues worker-linked QR with additional authorization checks. |

## 6) Files, Analytics, and Admin User Management Flows

| Flow ID | Flow | Main Actors | Core Endpoints | Main Outcome |
|---|---|---|---|---|
| F-39 | File upload/stream/delete | Authenticated users | `POST /files/upload/*`, `GET /files/:fileId/stream`, `DELETE /files/:fileId` | Central file gateway with category-aware access controls. |
| F-40 | Dashboard analytics views | Admin/staff | `GET /dashboard/*` | Provides KPI summary and charts for incidents, complaints, revenue, occupancy, devices. |
| F-41 | Admin user and profile management | Admin/staff | `POST/GET/PATCH/DELETE /admin/users*` | Manages base users plus resident/owner/tenant/admin profile records. |

## 7) Event-Driven/Asynchronous Side Effects

| Event Source | Trigger | Side Effect |
|---|---|---|
| Bookings | Booking status changed to approved/cancelled/rejected | Notification events emitted and delivered (in-app/email). |
| Incidents | Incident created/resolved | Events emitted for cross-module listeners/automation. |
| Referrals | Referral converted during signup | Conversion event emitted for notifications. |
| Pending registration | Approved by admin | Approval event emitted for downstream actions. |
| Notifications | Immediate/scheduled dispatch | Delivery logs created; EMAIL sent asynchronously by listener. |

## 8) Notes for Integration Teams

- API docs are auto-generated at `/api` (Swagger) at runtime.
- There is no global route prefix configured in `src/main.ts`; endpoints are mounted at root paths.
- Route protection mixes:
  - `@Permissions(...)` + `PermissionsGuard`
  - service-level row/unit access checks (especially for owner/delegate/lease/access flows).
