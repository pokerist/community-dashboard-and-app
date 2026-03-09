# Database, Mobile API, and Notification Audit

This document consolidates three deliverables for this project:

1. Textual ERD / domain map
2. Mobile API inventory
3. End-to-end flow map

Primary code references:
- `prisma/schema.prisma`
- `apps/community-mobile-native/src/features/*`
- `src/modules/*`
- `src/events/listeners/notification.listener.ts`

## 1) Textual ERD

### A. Identity and Access Core

#### `User`
- Central identity table for all actors.
- One-to-one optional role profiles:
  - `Admin`
  - `Resident`
  - `Owner`
  - `Tenant`
  - `Broker`
- One-to-many:
  - `UserRole`
  - `RefreshToken`
  - `PasswordResetToken`
  - `EmailVerificationToken`
  - `PhoneVerificationOtp`
  - `NotificationDeviceToken`
  - `Notification` as sender
  - `UserStatusLog`
- Operational relations:
  - complaints as reporter/assignee
  - violations as issuer/target
  - invoices
  - service requests and comments
  - bookings
  - QR codes generated

#### `Role` / `Permission` / `UserRole` / `RolePermission`
- Standard RBAC layer.
- Grants dashboard and mobile capabilities at permission level.
- Not enough by itself to know unit-scoped access.

#### `UnitAccess`
- Actual source of truth for access to a unit.
- Fields define:
  - `role`
  - `delegateType`
  - `status`
  - `startsAt`, `endsAt`
  - capability flags like `canViewFinancials`, `canGenerateQR`, `canManageWorkers`
  - `featurePermissions`, `qrScopes`
- This is the real permission bridge between `User` and `Unit`.

#### `ResidentUnit`
- Legacy membership mapping between `Resident` and `Unit`.
- Still used in some old flows and ownership/family logic.
- The schema explicitly marks it as legacy for permission checks.

### B. Community and Property Hierarchy

#### `Community`
- Top-level community/compound.
- One-to-many:
  - `Cluster`
  - `Unit`
  - `Gate`
  - `CommercialEntity`
  - `CompoundStaff`
  - blue collar settings/holidays

#### `Cluster`
- Child of `Community`.
- Groups units by physical block/zone.

#### `Unit`
- Central operational entity.
- Belongs to:
  - `Community`
  - optional `Cluster`
- One-to-many:
  - `Lease`
  - `Invoice`
  - `Complaint`
  - `Violation`
  - `Incident`
  - `ServiceRequest`
  - `Booking`
  - `Order`
  - `AccessQRCode`
  - `UnitFee`
  - `Worker`
  - `PermitRequest`
  - household request records
  - `UnitAccess`

### C. Resident / Owner / Tenant / Household

#### `Resident`
- 1:1 with `User`.
- Holds resident-specific profile data.
- One-to-many:
  - `ResidentVehicle`
  - `ResidentDocument`
  - `ResidentUnit`
- Family graph:
  - primary resident -> `FamilyMember[]`
  - family resident -> `FamilyMember?`

#### `FamilyMember`
- Relation between one primary resident and another resident who is family.
- Stores `relationship`, `status`, activation state.

#### `Owner` / `Tenant`
- Simple 1:1 role markers over `User`.
- Real live access still depends on `UnitAccess`.

#### Household request models
- `FamilyAccessRequest`
- `AuthorizedAccessRequest`
- `HomeStaffAccess`
- These are approval-stage records before account/access provisioning.

### D. Leasing, Rental, Ownership, Finance

#### `Lease`
- Contract between owner user and tenant user for a unit.
- Links:
  - `Unit`
  - owner `User`
  - tenant `User`
  - optional contract `File`

#### `RentRequest`
- Owner-side request to approve a tenant before or alongside lease creation.

#### `OwnerUnitContract`
- Owner-unit contract metadata.
- Supports payment mode and document storage.

#### `OwnerInstallment`
- Installment schedule under `OwnerUnitContract`.

#### `UnitOwnershipTransfer`
- Ownership transfer audit between users for a unit.

#### `Invoice`
- Financial aggregation entity.
- Belongs to `Unit`.
- Optionally linked to recipient `User`.
- May reference source records:
  - `Violation`
  - `ServiceRequest`
  - `Complaint`
  - `Booking`
  - `Incident`
- Also linked from `UnitFee` and authorized activation requests.

#### `UnitFee`
- Fee rows per unit and month.
- Can generate or link to an invoice.

### E. Service, Permit, Complaint, Violation

#### Service request domain
- `Service` -> `ServiceField` -> `ServiceRequest` -> `ServiceRequestFieldValue`
- `ServiceRequest` also has:
  - creator `User`
  - assignee `User`
  - comments
  - attachments
  - linked invoices

#### Permit domain
- `PermitType` -> `PermitField` -> `PermitRequest` -> `PermitRequestFieldValue`

#### Complaint domain
- `ComplaintCategory` -> `Complaint` -> `ComplaintComment`
- Complaint belongs to reporter `User`, optional assignee `User`, optional `Unit`.
- Can link to invoices.

#### Violation domain
- `ViolationCategory` -> `Violation` -> `ViolationActionRequest`
- Violation belongs to `Unit`, issuer `User`, target `User`.
- Usually creates a fine invoice.

### F. Facilities, Access, Workers, Commercial

#### Facilities
- `Facility` -> `FacilitySlotConfig` / `FacilitySlotException` -> `Booking`

#### Access control
- `AccessProfile`
- `AccessGrant`
- `AccessQRCode`
- `Gate`
- `GateUnitAccess`
- `GateEntryLog`

#### Workers and contractors
- `Contractor`
- `ContractorMember`
- `Worker`
- `BlueCollarSetting`
- `BlueCollarHoliday`
- `BlueCollarAccessRequest`

#### Commercial and staff
- `CommercialEntity`
- `CommercialEntityMember`
- `Department`
- `CompoundStaff`
- `CompoundStaffAccess`
- `CompoundStaffSchedule`
- `CompoundStaffGateAccess`
- `CompoundStaffActivityLog`
- `AttendanceLog`

### G. Notifications and Media

#### `Notification`
- The master notification record.
- Stores content, channels, audience, payload, schedule, counters.

#### `NotificationLog`
- One row per recipient per channel.
- Tracks send/read/failure state.

#### `NotificationDeviceToken`
- Mobile/web push token registry per user/device.

#### `File`
- Central file registry.
- Reused across user photos, IDs, contracts, resident docs, attachments, branding assets.

#### `Attachment`
- Polymorphic or semi-polymorphic file attachment bridge.

### H. Onboarding and Miscellaneous

#### `PendingRegistration`
- Public signup staging table before approval/provisioning.

#### Other modules
- `Survey`, `SurveyQuestion`, `SurveyResponse`, `SurveyAnswer`
- `Restaurant`, `MenuItem`, `Order`, `OrderItem`
- `Banner`
- `SystemSetting`
- `GeneratedReport`, `ReportSchedule`, `ReportTemplate`, `ScheduledReport`
- `Incident`
- `HelpCenterEntry`
- `DiscoverPlace`
- `Referral`
- `Project`

## 2) Mobile API Inventory

The table below lists APIs consumed by `apps/community-mobile-native`.

| Domain | Method | Path | Used by mobile | Backend route present | Notes |
|---|---|---|---|---|---|
| Auth | POST | `/auth/login` | yes | yes | login |
| Auth | POST | `/auth/login/2fa/verify` | yes | yes | 2FA challenge |
| Auth | POST | `/auth/refresh` | yes | yes | refresh rotation |
| Signup | POST | `/signup` | yes | yes | public signup request |
| Auth | POST | `/auth/forgot-password` | yes | yes | forgot password |
| Auth | GET | `/auth/activation/status` | yes | yes | activation bootstrap |
| Auth | POST | `/auth/send-phone-otp` | yes | yes | Firebase OTP kickoff |
| Auth | POST | `/auth/verify-phone-otp` | yes | yes | verifies Firebase ID token |
| Auth | POST | `/auth/activation/complete` | yes | yes | final activation |
| Auth | PATCH | `/auth/activation/draft` | yes | yes | save draft IDs |
| Auth | GET | `/auth/me` | yes | yes | main bootstrap endpoint |
| Auth | PATCH | `/auth/me/profile` | yes | yes | profile update |
| Auth | PATCH | `/auth/me/profile-photo` | yes | yes | direct photo link |
| Auth | POST | `/auth/me/profile-change-requests` | yes | yes | approval-based changes |
| Auth | GET | `/auth/me/profile-change-requests` | yes | yes | history |
| Auth | PATCH | `/auth/me/security` | yes | yes | security preferences |
| Resident Vehicles | GET | `/resident-vehicles/me` | yes | yes | my vehicles |
| Resident Vehicles | POST | `/resident-vehicles/me` | yes | yes | create vehicle |
| Resident Vehicles | PATCH | `/resident-vehicles/me/:id` | yes | yes | update vehicle |
| Resident Vehicles | DELETE | `/resident-vehicles/me/:id` | yes | yes | delete vehicle |
| Branding | GET | `/mobile/app-config` | yes | yes | public mobile config |
| Notifications | GET | `/notifications/me` | yes | yes | inbox |
| Notifications | GET | `/notifications/me/changes` | yes | yes | incremental sync |
| Notifications | PATCH | `/notifications/:id/read` | yes | yes | mark as read |
| Notifications | POST | `/notifications/device-tokens` | yes | yes | push token register |
| Notifications | DELETE | `/notifications/device-tokens/:id` | yes | yes | revoke token |
| Files | POST | `/files/upload/profile-photo` | yes | yes | multipart |
| Files | POST | `/files/upload/national-id` | yes | yes | multipart |
| Files | POST | `/files/upload/delegate-id` | yes | yes | multipart |
| Files | POST | `/files/upload/contract` | yes | yes | multipart |
| Files | POST | `/files/upload/marriage-certificate` | yes | yes | multipart |
| Files | POST | `/files/upload/birth-certificate` | yes | yes | multipart |
| Files | POST | `/files/upload/service-attachment` | yes | yes | multipart |
| Files | POST | `/files/upload/public-signup-photo` | yes | yes | public multipart |
| Units | GET | `/units/my` | yes | yes | my units |
| Facilities | GET | `/facilities` | yes | yes | active facilities list |
| Banners | GET | `/banners/mobile-feed` | yes | yes | audience/date filtered |
| Bookings | GET | `/bookings/me` | yes | no | mobile expects route not defined in current controller |
| Bookings | POST | `/bookings` | yes | no | current create route not exposed in bookings controller |
| Bookings | PATCH | `/bookings/:id/cancel` | yes | no | backend exposes `POST /bookings/:id/cancel` |
| Services | GET | `/services` | yes | yes | service catalog |
| Service Requests | GET | `/service-requests/my-requests` | yes | yes | user-scoped |
| Service Requests | POST | `/service-requests` | yes | yes | create ticket |
| Service Requests | GET | `/service-requests/:id` | yes | yes | detail |
| Service Requests | GET | `/service-requests/:id/comments` | yes | yes | comments |
| Service Requests | POST | `/service-requests/:id/comments` | yes | yes | add comment |
| Service Requests | PATCH | `/service-requests/:id/cancel` | yes | yes | cancel request |
| Complaints | GET | `/complaints/me` | yes | no | docs say present; current controller does not expose it |
| Complaints | POST | `/complaints` | yes | yes | payload shape mismatch risk |
| Complaints | DELETE | `/complaints/:id` | yes | no | current controller does not expose it |
| Complaints | GET | `/complaints/:id/comments` | yes | no | current controller does not expose it |
| Complaints | POST | `/complaints/:id/comments` | yes | yes | add comment |
| Access QR | GET | `/access-qrcodes` | yes | yes | list |
| Access QR | POST | `/access-qrcodes` | yes | yes | generate |
| Access QR | PATCH | `/access-qrcodes/:id/revoke` | yes | yes | revoke |
| Access QR | GET | `/access-qrcodes/:id/image` | yes | yes | base64/image payload |
| Invoices | GET | `/invoices/me` | yes | yes | actor-aware |
| Invoices | POST | `/invoices/:id/pay/simulate-self` | yes | yes | demo payment |
| Violations | GET | `/violations/me` | yes | no | current controller does not expose it |
| Violations | GET | `/violations/:id/actions` | yes | no | current controller does not expose it |
| Violations | POST | `/violations/:id/actions` | yes | no | current controller does not expose it |
| Owners | GET | `/owners/family/:unitId` | yes | yes | family list |
| Owners | POST | `/owners/family/:unitId` | yes | yes | add family |
| Owners | POST | `/owners/units/:unitId/remove-user/:userId` | yes | yes | revoke family access |
| Owners | PATCH | `/owners/family/:userId` | yes | yes | update family profile |
| Delegates | GET | `/delegates/unit/:unitId` | yes | yes | delegates list |
| Delegates | PATCH | `/delegates/:id` | yes | yes | update delegate |
| Delegates | POST | `/delegates/:id/revoke` | yes | yes | revoke delegate |
| Delegates | POST | `/delegates/request-by-contact` | yes | yes | mobile delegate creation flow |
| Contractors | GET | `/contractors` | yes | yes | list |
| Contractors | POST | `/contractors` | yes | yes | create |
| Workers | GET | `/workers` | yes | yes | list by unit |
| Workers | POST | `/workers` | yes | yes | create |
| Workers | POST | `/workers/:id/qr` | yes | yes | generate worker QR |
| Fire evacuation | GET | `/fire-evacuation/me` | yes | yes | resident state |
| Fire evacuation | POST | `/fire-evacuation/me/ack` | yes | yes | acknowledge |
| Fire evacuation | POST | `/fire-evacuation/me/help` | yes | yes | ask help |
| Incidents | POST | `/incidents/me/sos` | yes | yes | SOS alert |
| Help center | GET | `/help-center` | yes | yes | public/mobile |
| Discover | GET | `/discover` | yes | yes | public/mobile |
| Rent Requests | POST | `/rent-requests` | yes | yes | owner creates |
| Rent Requests | GET | `/rent-requests/my` | yes | yes | owner list |
| Household | GET | `/household/my-requests` | yes | yes | grouped household requests |
| Household | POST | `/household/family-requests` | yes | yes | create family access request |
| Household | POST | `/household/authorized-requests` | yes | yes | create delegate-like request |
| Household | POST | `/household/home-staff` | yes | yes | create staff request |

### Mobile API mismatch notes

- The mobile client and current backend controllers are not fully aligned for bookings, complaints, and violations.
- Validation is strict (`whitelist=true`, `forbidNonWhitelisted=true`), so even near-match payloads can fail.
- Example:
  - mobile complaint creation sends `team` and `category`
  - backend DTO currently accepts `categoryId`, `title`, `description`, `priority`

## 3) Flow Map

### Flow A: Login and session

1. Mobile calls `POST /auth/login`.
2. Backend validates user credentials and active access.
3. If 2FA is enabled, backend returns challenge flow.
4. Mobile stores `accessToken` and `refreshToken`.
5. Mobile bootstraps user context via `GET /auth/me`.
6. Background refresh uses `POST /auth/refresh`.

### Flow B: Activation / first login

1. User logs in with invited/pending account.
2. Mobile checks `GET /auth/activation/status`.
3. Mobile uploads profile photo / national ID through file endpoints.
4. Mobile saves draft via `PATCH /auth/activation/draft`.
5. Mobile verifies phone via Firebase-backed OTP flow.
6. Mobile completes activation via `POST /auth/activation/complete`.
7. Backend sets `User.userStatus = ACTIVE`.

### Flow C: Public signup

1. Mobile uploads public signup photo via `/files/upload/public-signup-photo`.
2. Mobile calls `POST /signup`.
3. Backend creates `PendingRegistration`.
4. Admin later approves/rejects via admin pending-registration routes.
5. Approval creates actual `User` + `Resident` + unit assignment.

### Flow D: Unit bootstrap

1. Mobile calls `GET /units/my`.
2. Backend resolves current units from `UnitAccess` or legacy resident mapping.
3. Each selected unit drives:
  - banners
  - services
  - household
  - invoices
  - complaints
  - worker permissions

### Flow E: Service request

1. Mobile calls `GET /services`.
2. User submits `POST /service-requests`.
3. Backend validates unit access + service rules + dynamic fields.
4. Backend stores `ServiceRequest` and optional attachments/comments.
5. Event listener emits notifications to resident/admin.
6. Admin updates request status.
7. Resident receives deep-linkable notification and sees status/comments.

### Flow F: Complaint

1. Mobile creates complaint.
2. Backend stores `Complaint`.
3. Admin assigns and changes status.
4. Resident receives notification when complaint is updated or returned.
5. Comment thread continues through complaint comments.

### Flow G: Violation and finance

1. Admin issues violation.
2. Backend stores `Violation`.
3. Backend often creates fine `Invoice`.
4. Event system sends resident notification.
5. Mobile finance screen consumes invoices and violations.
6. Demo payment can mark invoice paid via simulate endpoint.

### Flow H: Booking

1. Mobile lists facilities.
2. User creates booking.
3. Admin reviews/approves/rejects booking.
4. If prepayment is required, backend may create booking fee invoice.
5. Notifications are emitted on approval/cancellation.

### Flow I: Household and delegation

1. Owner/tenant submits family / authorized / home-staff request.
2. Backend stores pending household request row.
3. Admin reviews request.
4. On approval:
  - backend may create `User`
  - may create `Resident`
  - creates `UnitAccess`
  - may generate activation invoice for authorized users
  - may send credentials email

### Flow J: QR and gate access

1. User creates QR through `/access-qrcodes` or worker QR flow.
2. Backend stores `AccessQRCode`.
3. Gate scans create `GateEntryLog`.
4. Status transitions include active, used, revoked, checked-in/out.
5. Related notifications may be emitted.

### Flow K: Notification lifecycle

1. Code or admin calls `NotificationsService.sendNotification(...)`.
2. Backend creates `Notification`.
3. Audience is resolved to user IDs.
4. Backend creates `NotificationLog` rows per recipient and channel.
5. `IN_APP` becomes available immediately in `/notifications/me`.
6. Push/email/SMS channels are delivered asynchronously.
7. Mobile polls `/notifications/me/changes` and registers push tokens.
8. Mobile marks read via `/notifications/:id/read`.

### Flow L: Fire evacuation

1. Admin triggers evacuation.
2. Backend stores state in `SystemSetting`.
3. Backend emits push/in-app notification to target users.
4. Mobile checks `/fire-evacuation/me`.
5. Resident can acknowledge safe or request help.
6. Admin resolves incident and sends follow-up notification.

## 4) Notification subsystem summary

### Core models
- `Notification`
- `NotificationLog`
- `NotificationDeviceToken`

### Delivery behavior
- In-app: tracked through `NotificationLog(channel=IN_APP)`
- Push: Expo or FCM depending on token
- Email: Resend or SMTP, with mock fallback
- SMS: currently mock/disabled for general transport; OTP relies on Firebase Auth flow

### Important implementation details
- Scheduled notifications are dispatched every minute.
- Many domain events create notifications automatically:
  - invoices
  - bookings
  - incidents
  - violations
  - service request creation/status changes
- Payload keys used by mobile:
  - `route`
  - `entityType`
  - `entityId`
  - `eventKey`

### Current inconsistency notes
- Some backend notification payloads still use web-style routes like `#complaints` and `#permits`.
- The mobile app is tolerant because it routes by substring matching, but normalized mobile-style routes are preferable.

## 5) Best files to start with

- Domain schema:
  - `prisma/schema.prisma`
- Backend module wiring:
  - `src/app.module.ts`
- Runtime and validation:
  - `src/main.ts`
- Mobile auth bootstrap:
  - `src/modules/auth/auth.controller.ts`
  - `src/modules/auth/auth.service.ts`
- Mobile API usage:
  - `apps/community-mobile-native/src/features/auth/service.ts`
  - `apps/community-mobile-native/src/features/auth/profile.ts`
  - `apps/community-mobile-native/src/features/community/service.ts`
  - `apps/community-mobile-native/src/features/notifications/service.ts`
- Notifications:
  - `src/modules/notifications/notifications.controller.ts`
  - `src/modules/notifications/notifications.service.ts`
  - `src/modules/notifications/notification-delivery.listener.ts`
  - `src/modules/notifications/notifications.scheduler.ts`
  - `src/events/listeners/notification.listener.ts`
