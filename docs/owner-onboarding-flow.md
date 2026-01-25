# 🏠 Owner Onboarding & Access Control Flow

## Overview

This document outlines the complete flow for owner onboarding, unit delivery, and access management as implemented in the Alkarma Community Dashboard. The flow follows the CEO's requirements for admin-controlled owner creation and unit-status-based feature gating.

## 📋 Key Concepts

### Unit Status Progression
- `AVAILABLE` → `NOT_DELIVERED` → `DELIVERED` → `OCCUPIED`/`LEASED`

### User Roles
- `OWNER` - Full access to unit management
- `TENANT` - Standard resident access
- `FAMILY` - Family member access (added by owner)
- `DELEGATE` - Approved third-party access (family/friend/interior designer)

### Access Status
- `PENDING` - Waiting for approval
- `APPROVED` - Approved but not active yet
- `ACTIVE` - Currently active access
- `REVOKED` - Access revoked

---

## 🚀 Complete Flow Breakdown

### Phase 1: Unit Purchase → Owner Creation

#### 1.1 Admin Creates Owner Account
**Trigger:** Unit purchase completed
**Actor:** Admin
**Action:** Create owner account for purchased unit

```typescript
POST /owners/create-with-unit
{
  "name": "Ahmed Hassan",
  "email": "ahmed.hassan@email.com",
  "phone": "+201234567890",
  "password": "securePassword123",
  "nationalId": "12345678901234",
  "unitId": "unit-uuid-here"
}
```

**Database Changes:**
- Creates `User` with hashed password
- Creates `Resident` profile
- Creates `Owner` role
- Creates `ResidentUnit` with `isPrimary: true`
- Creates `UnitAccess` with `OWNER` role
- Updates `Unit.status` to `NOT_DELIVERED`
- Sends welcome email with credentials

#### 1.2 Owner Access (Pre-Delivery)
**Features Available:**
- ✅ View payment plans
- ✅ View announcements
- ✅ View overdue checks
- ✅ Basic profile management

**Features Restricted:**
- ❌ Add family members
- ❌ Add tenants
- ❌ Add delegates
- ❌ Book facilities (advanced)
- ❌ Generate QR codes
- ❌ Manage workers

---

### Phase 2: Unit Delivery → Full Access

#### 2.1 Mark Unit as Delivered
**Trigger:** Physical unit delivery completed
**Actor:** Admin/Manager
**Action:** Update unit status

```typescript
PUT /units/{unitId}
{
  "status": "DELIVERED"
}
```

**Impact:**
- Owner gains full access to all features
- Unit status gates are unlocked
- Owner can now manage family and delegates

#### 2.2 Owner Full Access (Post-Delivery)
**New Features Available:**
- ✅ Add family members
- ✅ Add tenants
- ✅ Request delegates
- ✅ Full facility booking
- ✅ QR code generation
- ✅ Worker management

---

### Phase 3: Family & Tenant Management

#### 3.1 Add Family Member
**Actor:** Owner (post-delivery only)
**Action:** Add family member to unit

```typescript
POST /owners/add-family-tenant/{unitId}
{
  "name": "Fatima Hassan",
  "phone": "+201234567891",
  "email": "fatima.hassan@email.com",
  "nationalId": "12345678901235",
  "type": "FAMILY"
}
```

**Process:**
1. Validates unit is `DELIVERED`
2. Creates `User` with random password
3. Creates `Resident` profile
4. Creates `UnitAccess` with `FAMILY` role
5. Assigns to unit via `ResidentUnit`
6. Sends welcome email with credentials

#### 3.2 Add Tenant
**Actor:** Owner (post-delivery only)
**Action:** Add tenant to unit

```typescript
POST /owners/add-family-tenant/{unitId}
{
  "name": "Mohamed Ali",
  "phone": "+201234567892",
  "email": "mohamed.ali@email.com",
  "nationalId": "12345678901236",
  "type": "TENANT"
}
```

**Process:**
1. Validates unit is `DELIVERED`
2. Creates `User` with random password
3. Creates `Resident` profile
4. Creates `Tenant` role
5. Creates `UnitAccess` with `TENANT` role
6. Assigns to unit via `ResidentUnit`
7. Sends welcome email with credentials

---

### Phase 4: Delegate Management

#### 4.1 Owner Requests Delegate
**Actor:** Owner (post-delivery only)
**Action:** Request delegate access

```typescript
POST /delegates/request
{
  "userId": "delegate-user-uuid",
  "unitId": "unit-uuid",
  "type": "INTERIOR_DESIGNER",
  "startsAt": "2024-01-15T00:00:00.000Z",
  "endsAt": "2024-12-31T23:59:59.000Z",
  "canViewFinancials": false,
  "canReceiveBilling": false,
  "canBookFacilities": true,
  "canGenerateQR": true,
  "canManageWorkers": true
}
```

**Process:**
1. Validates unit is `DELIVERED`
2. Validates requester is owner
3. Creates `UnitAccess` with `DELEGATE` role and `PENDING` status
4. Admin must approve before access is granted

#### 4.2 Admin Approves Delegate
**Actor:** Admin
**Action:** Approve pending delegate request

```typescript
POST /delegates/{unitAccessId}/approve
```

**Process:**
1. Updates `UnitAccess.status` to `ACTIVE`
2. Sends approval email to delegate
3. Delegate gains access with specified permissions

#### 4.3 Admin/Owner Revokes Delegate
**Actor:** Admin or Owner
**Action:** Revoke delegate access

```typescript
POST /delegates/{unitAccessId}/revoke
```

**Process:**
1. Updates `UnitAccess.status` to `REVOKED`
2. Sends revocation email to delegate
3. Access is immediately blocked

---

### Phase 5: Clubhouse Access

#### 5.1 Request Clubhouse Access
**Actor:** Unit resident
**Action:** Request clubhouse access

```typescript
POST /clubhouse/request-access
{
  "unitId": "unit-uuid"
}
```

**Process:**
1. Validates user has unit access
2. Creates `ClubhouseAccessRequest` with `PENDING` status
3. Admin must approve

#### 5.2 Admin Approves Clubhouse Access
**Actor:** Admin
**Action:** Approve clubhouse access

```typescript
POST /clubhouse/approve/{requestId}
```

**Process:**
1. Updates request status to `APPROVED`
2. User gains clubhouse booking privileges

---

## 🔐 Access Control Matrix

| Feature | NOT_DELIVERED Owner | DELIVERED Owner | Family | Tenant | Delegate |
|---------|-------------------|-----------------|--------|--------|----------|
| View Payment Plans | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Announcements | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add Family/Tenant | ❌ | ✅ | ❌ | ❌ | ❌ |
| Request Delegates | ❌ | ✅ | ❌ | ❌ | ❌ |
| Book Basic Facilities | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book Advanced Facilities | ❌ | ✅ | ✅ | ✅ | ✅ |
| Generate QR Codes | ❌ | ✅ | ❌ | ❌ | ✅ |
| Manage Workers | ❌ | ✅ | ❌ | ❌ | ✅ |
| View Financials | ✅ | ✅ | ❌ | ❌ | ✅ |
| Receive Billing | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## 📧 Email Notifications

### Owner Creation
**Subject:** `Welcome to Alkarma Community - Your Account Credentials`
**Recipients:** New owner
**Content:** Welcome message + login credentials

### Family/Tenant Addition
**Subject:** `Welcome to Alkarma Community - Your Account Credentials`
**Recipients:** New family member/tenant
**Content:** Welcome message + login credentials + relationship type

### Delegate Approval
**Subject:** `Delegate Access Approved - Alkarma Community`
**Recipients:** Delegate
**Content:** Approval confirmation + access details

### Delegate Revocation
**Subject:** `Delegate Access Revoked - Alkarma Community`
**Recipients:** Delegate
**Content:** Revocation notice + contact information

---

## 🗄️ Database Schema Changes

### New Enums
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
```

### New Tables
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

### Modified Tables
```sql
model UnitAccess {
  // Added delegateType field
  delegateType DelegateType?
  // Status field now supports PENDING/APPROVED
}
```

---

## 🧪 Testing Scenarios

### Happy Path Test
1. Create unit (AVAILABLE)
2. Create owner → Unit becomes NOT_DELIVERED
3. Verify owner has limited access
4. Deliver unit → Unit becomes DELIVERED
5. Verify owner has full access
6. Add family member → Success + email sent
7. Add tenant → Success + email sent
8. Request delegate → PENDING status
9. Approve delegate → ACTIVE status + email sent
10. Request clubhouse → PENDING status
11. Approve clubhouse → APPROVED status

### Error Path Tests
1. Try adding family to NOT_DELIVERED unit → Should fail
2. Non-owner tries to add family → Should fail
3. Duplicate email/phone during creation → Should fail
4. Request delegate for non-owned unit → Should fail
5. Approve non-existent delegate → Should fail

---

## 🔄 Integration Points

### Existing Modules Used
- **Notifications:** Email sending
- **Auth:** User creation and JWT tokens
- **Units:** Status management and access control
- **Residents:** User profile management

### New Modules Created
- **Owners:** Owner account creation and family management
- **Delegates:** Delegate approval workflow
- **Clubhouse:** Clubhouse access management

### Event Integration
- Unit status changes trigger access updates
- Delegate approvals trigger email notifications
- Owner creation triggers welcome emails

This flow ensures secure, controlled access while providing owners with full management capabilities once their unit is delivered.
