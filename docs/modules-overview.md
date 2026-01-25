# 📦 Modules Overview - Owner Onboarding Flow

This document provides detailed documentation for each module implemented in the Owner Onboarding & Access Control Flow.

---

## **1. OwnersModule** (`src/modules/owners/`)

### **Purpose**
Manages owner accounts, family/tenant addition, and owner-specific operations.

### **Components**

#### **OwnersService**
**Methods:**
- `createOwnerWithUnit(dto, createdBy)` - Creates owner account for purchased unit
- `addFamilyOrTenant(unitId, dto, addedBy)` - Adds family/tenant after delivery
- `findAll()` - Lists all owners
- `findOne(id)` - Gets owner by ID
- `remove(id)` - Deletes owner (soft delete)

**Key Features:**
- ✅ Unit status validation for family/tenant addition
- ✅ Owner permission checking
- ✅ Email notifications for new accounts
- ✅ Transaction-based operations
- ✅ Unique constraint validation

#### **OwnersController**
**Endpoints:**
- `POST /owners/create-with-unit` - Create owner (Admin only)
- `POST /owners/add-family-tenant/:unitId` - Add family/tenant (Owner only)
- `GET /owners` - List owners (Admin only)
- `GET /owners/:id` - Get owner details (Admin only)
- `DELETE /owners/:id` - Delete owner (Admin only)

#### **DTOs**
**CreateOwnerWithUnitDto:**
```typescript
{
  name: string;
  email?: string;
  phone: string;
  password: string;
  nationalId?: string;
  unitId: string;
}
```

---

## **2. DelegatesModule** (`src/modules/delegates/`)

### **Purpose**
Manages delegate approval workflow and permissions.

### **Components**

#### **DelegatesService**
**Methods:**
- `createDelegateRequest(dto, requestedBy)` - Creates delegate access request
- `approveDelegate(unitAccessId, approvedBy)` - Approves pending delegate
- `revokeDelegate(unitAccessId, revokedBy)` - Revokes delegate access
- `getDelegatesForUnit(unitId)` - Lists unit delegates
- `getPendingRequests()` - Lists pending approvals
- `updateDelegate(unitAccessId, dto)` - Updates delegate permissions
- `remove(unitAccessId)` - Hard deletes delegate access

**Key Features:**
- ✅ Unit delivery validation
- ✅ Owner permission checking
- ✅ Admin approval workflow
- ✅ Email notifications for approval/revocation
- ✅ Granular permission management

#### **DelegatesController**
**Endpoints:**
- `POST /delegates/request` - Request delegate access (Owner)
- `POST /delegates/:id/approve` - Approve delegate (Admin)
- `POST /delegates/:id/revoke` - Revoke delegate (Admin/Owner)
- `GET /delegates/pending` - Get pending requests (Admin)
- `GET /delegates/unit/:unitId` - Get unit delegates (Owner/Admin)
- `PATCH /delegates/:id` - Update permissions (Admin)
- `DELETE /delegates/:id` - Remove delegate (Admin)

#### **DTOs**
**CreateDelegateDto:**
```typescript
{
  userId: string;
  unitId: string;
  type: DelegateType; // FAMILY | FRIEND | INTERIOR_DESIGNER
  startsAt?: string;
  endsAt?: string;
  canViewFinancials?: boolean;
  canReceiveBilling?: boolean;
  canBookFacilities?: boolean;
  canGenerateQR?: boolean;
  canManageWorkers?: boolean;
}
```

**UpdateDelegateDto:**
```typescript
Partial<CreateDelegateDto>
```

---

## **3. ClubhouseModule** (`src/modules/clubhouse/`)

### **Purpose**
Manages clubhouse access requests and approvals.

### **Components**

#### **ClubhouseService**
**Methods:**
- `createAccessRequest(userId, unitId)` - Creates clubhouse access request
- `approveAccessRequest(requestId, approvedBy)` - Approves request
- `rejectAccessRequest(requestId)` - Rejects request
- `getPendingRequests()` - Lists pending requests
- `hasClubhouseAccess(userId, unitId?)` - Checks access status
- `getUserAccess(userId)` - Gets user's approved access

**Key Features:**
- ✅ Unit access validation
- ✅ Duplicate request prevention
- ✅ Admin approval workflow
- ✅ Access status checking

#### **ClubhouseController**
**Endpoints:**
- `POST /clubhouse/request-access` - Request access (Resident)
- `POST /clubhouse/approve/:id` - Approve request (Admin)
- `POST /clubhouse/reject/:id` - Reject request (Admin)
- `GET /clubhouse/pending` - Get pending requests (Admin)
- `GET /clubhouse/my-access` - Get user access (Resident)

---

## **4. Enhanced UnitsModule** (`src/modules/units/`)

### **Purpose**
Extended with access control and feature gating.

### **Additional Methods in UnitsService**

#### **Feature Access Gating**
```typescript
canAccessFeature(unitId: string, feature: string): Promise<boolean>
```
**Supported Features:**
- `add_tenant` - Add tenants/family (DELIVERED only)
- `add_family` - Add family members (DELIVERED only)
- `manage_delegates` - Request delegates (DELIVERED only)
- `view_payment_plan` - View payment plans (always)
- `view_announcements` - View announcements (always)
- `view_overdue_checks` - View overdue checks (always)

#### **User Access Checking**
```typescript
getUserAccessForUnit(unitId: string, userId: string)
```
Returns user's access level and permissions for a unit.

---

## **5. Database Schema Changes**

### **New Enums**
```sql
enum UnitStatus {
  AVAILABLE
  NOT_DELIVERED
  DELIVERED
  OCCUPIED
  LEASED
}

enum UnitAccessRole {
  OWNER
  TENANT
  FAMILY
  DELEGATE
}

enum AccessStatus {
  PENDING
  APPROVED
  ACTIVE
  EXPIRED
  USED
  REVOKED
  CANCELLED
}

enum DelegateType {
  FAMILY
  FRIEND
  INTERIOR_DESIGNER
}
```

### **New Tables**

#### **ClubhouseAccessRequest**
```sql
model ClubhouseAccessRequest {
  id         String   @id @default(uuid())
  userId     String
  unitId     String
  status     String   @default("PENDING")
  requestedAt DateTime @default(now())
  approvedAt DateTime?
  approvedBy String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  unit Unit @relation(fields: [unitId], references: [id])
}
```

### **Modified Tables**

#### **UnitAccess**
- Added `delegateType` field for delegate classification
- Extended `status` enum to support approval workflow

---

## **6. Email Notifications**

### **Templates**

#### **Owner Creation**
**Subject:** `Welcome to Alkarma Community - Your Account Credentials`
**Content:**
```
Welcome [Name]!

You have been registered as an owner in our community.
Your login credentials:
- Email: [email]
- Password: [password]

Please change your password after first login.
Login: https://app.alkarma.com/login
```

#### **Family/Tenant Addition**
**Subject:** `Welcome to Alkarma Community - Your Account Credentials`
**Content:**
```
Welcome [Name]!

You have been added as a [family member/tenant] to your family unit.
Your login credentials:
- Email: [email]
- Password: [password]

Please change your password after first login.
Login: https://app.alkarma.com/login
```

#### **Delegate Approval**
**Subject:** `Delegate Access Approved - Alkarma Community`
**Content:**
```
Dear [Name],

Your delegate access request for unit [UnitNumber] has been approved.
You can now access the community dashboard with your existing credentials.

Login: https://app.alkarma.com/login
```

#### **Delegate Revocation**
**Subject:** `Delegate Access Revoked - Alkarma Community`
**Content:**
```
Dear [Name],

Your delegate access for unit [UnitNumber] has been revoked.
If you believe this was done in error, please contact the administration.
```

---

## **7. Security & Authorization**

### **Role-Based Access Control**

| Endpoint | Required Role | Additional Checks |
|----------|---------------|-------------------|
| `POST /owners/create-with-unit` | Admin | None |
| `POST /owners/add-family-tenant/*` | Owner | Must own the unit |
| `POST /delegates/request` | Owner | Unit must be DELIVERED |
| `POST /delegates/*/approve` | Admin | None |
| `POST /delegates/*/revoke` | Admin/Owner | Owner must own unit |
| `POST /clubhouse/request-access` | Resident | Must have unit access |
| `GET /clubhouse/pending` | Admin | None |

### **Feature Gating**

| Feature | NOT_DELIVERED | DELIVERED |
|---------|---------------|-----------|
| Add Family/Tenant | ❌ | ✅ |
| Request Delegates | ❌ | ✅ |
| Manage Workers | ❌ | ✅ |
| Generate QR Codes | ❌ | ✅ |
| View Financials | ✅ | ✅ |
| Book Facilities | ✅ | ✅ |

---

## **8. Error Handling**

### **Common Error Codes**

| Code | Meaning | Examples |
|------|---------|----------|
| 400 | Bad Request | Invalid data, unit not delivered |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | User/unit/access not found |
| 409 | Conflict | Duplicate email/phone |
| 500 | Internal Error | Database/transaction failures |

### **Business Logic Errors**
- Unit not delivered for restricted operations
- Non-owner attempting owner-only actions
- Delegate already approved/revoked
- Duplicate requests

---

## **9. Integration Points**

### **Existing Modules Used**
- **Auth:** JWT token validation
- **Notifications:** Email sending service
- **Residents:** User profile management
- **Units:** Status management

### **Event System**
- Unit status changes trigger access updates
- Delegate approvals trigger email notifications
- Owner creation triggers welcome emails

### **Database Transactions**
- Owner creation: Multi-table transaction
- Family/tenant addition: Multi-table transaction
- Delegate approval: Status update + email

---

## **10. Performance Considerations**

### **Database Indexes**
- `UnitAccess`: `(unitId, userId, status)` for access checks
- `ClubhouseAccessRequest`: `(userId, unitId, status)` for duplicate prevention
- `ResidentUnit`: `(unitId, userId, isPrimary)` for ownership validation

### **Caching Opportunities**
- Unit access permissions (Redis)
- Feature gating results (Memory)
- User role lookups (Redis)

### **Email Queue**
- Async email sending to prevent API delays
- Retry mechanism for failed deliveries
- Rate limiting for bulk operations

---

## **11. Monitoring & Logging**

### **Key Metrics**
- Owner creation success/failure rates
- Delegate approval processing time
- Email delivery success rates
- Access check performance

### **Audit Logs**
- All permission changes logged
- Admin actions tracked
- Email notifications logged

### **Error Tracking**
- Failed email deliveries
- Permission check failures
- Database transaction rollbacks

This modular architecture ensures clean separation of concerns, proper authorization, and scalable access control for the Owner Onboarding Flow.
