# 🧪 Complete API Testing Guide - Owner Onboarding Flow

## Overview

This guide provides comprehensive testing instructions for the Owner Onboarding & Access Control Flow. All tests assume:

- **Base URL:** `http://localhost:3000`
- **Authentication:** `Authorization: Bearer <jwt-token>` header
- **Admin Token:** Required for admin-only endpoints
- **Owner Token:** Required for owner-specific endpoints

## 📋 Prerequisites

### 1. Setup Test Data
```bash
# Start the server
npm run start:dev

# Create test units via database or existing endpoints
# Note: You'll need actual UUIDs from your database
```

### 2. Authentication
```bash
# Get admin token (replace with your login endpoint)
POST /auth/login
{
  "email": "admin@alkarma.com",
  "password": "admin123"
}

# Get owner token
POST /auth/login
{
  "email": "ahmed.hassan@email.com",
  "password": "owner123"
}
```

---

## **Phase 1: Owner Creation Flow**

### **1.1 Create Owner with Unit**
**Endpoint:** `POST /owners/create-with-unit`

**Purpose:** Admin creates owner account for purchased unit

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Ahmed Hassan",
  "email": "ahmed.hassan@email.com",
  "phone": "+201234567890",
  "password": "securePassword123",
  "nationalId": "12345678901234",
  "unitId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**✅ Success Response (201):**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "nameEN": "Ahmed Hassan",
  "email": "ahmed.hassan@email.com",
  "phone": "+201234567890",
  "userStatus": "ACTIVE"
}
```

**❌ Error Cases:**

**Duplicate Email (409):**
```json
{
  "statusCode": 409,
  "message": "Email already registered",
  "error": "Conflict"
}
```

**Duplicate Phone (409):**
```json
{
  "statusCode": 409,
  "message": "Phone already registered",
  "error": "Conflict"
}
```

**Unit Not Found (400):**
```json
{
  "statusCode": 400,
  "message": "Unit not found",
  "error": "Bad Request"
}
```

**Unit Already Has Owner (400):**
```json
{
  "statusCode": 400,
  "message": "Unit already has a primary owner",
  "error": "Bad Request"
}
```

**❓ Test Cases:**
- ✅ Valid owner creation
- ❌ Duplicate email
- ❌ Duplicate phone
- ❌ Invalid unit ID
- ❌ Unit already occupied
- ❌ Missing required fields
- ❌ Unauthorized (non-admin)

---

### **1.2 Verify Unit Status Changed**
**Endpoint:** `GET /units/{unitId}`

**Expected Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "NOT_DELIVERED",
  // ... other unit fields
}
```

---

### **1.3 Check Owner Access Created**
**Endpoint:** `GET /units/access/{unitId}/{userId}`

**Expected Response:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "role": "OWNER",
  "status": "ACTIVE",
  "canViewFinancials": true,
  "canReceiveBilling": true,
  "canBookFacilities": true,
  "canGenerateQR": true,
  "canManageWorkers": true,
  "unitId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "660e8400-e29b-41d4-a716-446655440001"
}
```

---

## **Phase 2: Unit Delivery**

### **2.1 Mark Unit as Delivered**
**Endpoint:** `PUT /units/{unitId}`

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "DELIVERED"
}
```

**✅ Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "DELIVERED",
  // ... other unit fields
}
```

---

### **2.2 Verify Feature Access Gating**
**Endpoint:** `GET /units/can-access-feature/{unitId}?feature=add_tenant`

**Expected Response (DELIVERED unit, add_tenant):**
```json
{
  "canAccess": true
}
```

**Expected Response (NOT_DELIVERED unit, add_tenant):**
```json
{
  "canAccess": false
}
```

**Test Cases:**
- ✅ `DELIVERED` unit, `add_tenant` → `{"canAccess": true}`
- ✅ `NOT_DELIVERED` unit, `add_tenant` → `{"canAccess": false}`
- ✅ Any status, `view_payment_plan` → `{"canAccess": true}`

---

## **Phase 3: Family & Tenant Addition**

### **3.1 Add Family Member**
**Endpoint:** `POST /owners/add-family-tenant/{unitId}`

**Headers:**
```
Authorization: Bearer <owner-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Fatima Hassan",
  "phone": "+201234567891",
  "email": "fatima.hassan@email.com",
  "nationalId": "12345678901235",
  "type": "FAMILY"
}
```

**✅ Success Response (201):**
```json
{
  "user": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "nameEN": "Fatima Hassan",
    "email": "fatima.hassan@email.com"
  },
  "randomPassword": "Ab3XyZ9mNp"
}
```

**❌ Error Cases:**

**Unit Not Delivered (400):**
```json
{
  "statusCode": 400,
  "message": "Unit must be delivered to add family/tenant",
  "error": "Bad Request"
}
```

**Not Owner (403):**
```json
{
  "statusCode": 403,
  "message": "Only owner can add family/tenant",
  "error": "Forbidden"
}
```

---

### **3.2 Add Tenant**
**Endpoint:** `POST /owners/add-family-tenant/{unitId}`

**Request Body:**
```json
{
  "name": "Mohamed Ali",
  "phone": "+201234567892",
  "email": "mohamed.ali@email.com",
  "nationalId": "12345678901236",
  "type": "TENANT"
}
```

**✅ Success Response (201):**
```json
{
  "user": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "nameEN": "Mohamed Ali",
    "email": "mohamed.ali@email.com"
  },
  "randomPassword": "Cd4WxA0nOq"
}
```

---

### **3.3 Verify Family/Tenant Access**
**Endpoint:** `GET /units/access/{unitId}/{userId}`

**Expected Response (Family):**
```json
{
  "role": "FAMILY",
  "status": "ACTIVE",
  "canViewFinancials": false,
  "canReceiveBilling": false,
  "canBookFacilities": true,
  "canGenerateQR": false,
  "canManageWorkers": false
}
```

**Expected Response (Tenant):**
```json
{
  "role": "TENANT",
  "status": "ACTIVE",
  "canViewFinancials": false,
  "canReceiveBilling": false,
  "canBookFacilities": true,
  "canGenerateQR": false,
  "canManageWorkers": false
}
```

---

## **Phase 4: Delegate Management**

### **4.1 Create Delegate User First**
**Endpoint:** `POST /residents` (or existing user creation endpoint)

**Request Body:**
```json
{
  "user": {
    "nameEN": "Jane Smith",
    "email": "jane.smith@email.com",
    "phone": "+201234567893",
    "signupSource": "dashboard"
  }
}
```

**Store the returned user ID for delegate request.**

---

### **4.2 Request Delegate Access**
**Endpoint:** `POST /delegates/request`

**Headers:**
```
Authorization: Bearer <owner-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "aa0e8400-e29b-41d4-a716-446655440005",
  "unitId": "550e8400-e29b-41d4-a716-446655440000",
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

**✅ Success Response (201):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "role": "DELEGATE",
  "delegateType": "INTERIOR_DESIGNER",
  "status": "PENDING",
  "canGenerateQR": true,
  "canManageWorkers": true
}
```

---

### **4.3 Get Pending Delegate Requests**
**Endpoint:** `GET /delegates/pending`

**Headers:**
```
Authorization: Bearer <admin-token>
```

**✅ Success Response (200):**
```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "role": "DELEGATE",
    "delegateType": "INTERIOR_DESIGNER",
    "status": "PENDING",
    "user": {
      "nameEN": "Jane Smith",
      "email": "jane.smith@email.com"
    },
    "unit": {
      "unitNumber": "A101",
      "projectName": "Alkarma Heights"
    }
  }
]
```

---

### **4.4 Approve Delegate**
**Endpoint:** `POST /delegates/{unitAccessId}/approve`

**Headers:**
```
Authorization: Bearer <admin-token>
```

**✅ Success Response (200):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "role": "DELEGATE",
  "status": "ACTIVE",
  "canGenerateQR": true,
  "canManageWorkers": true
}
```

---

### **4.5 Verify Delegate Access**
**Endpoint:** `GET /units/access/{unitId}/{userId}`

**Expected Response:**
```json
{
  "role": "DELEGATE",
  "delegateType": "INTERIOR_DESIGNER",
  "status": "ACTIVE",
  "canViewFinancials": false,
  "canReceiveBilling": false,
  "canBookFacilities": true,
  "canGenerateQR": true,
  "canManageWorkers": true
}
```

---

### **4.6 Revoke Delegate**
**Endpoint:** `POST /delegates/{unitAccessId}/revoke`

**Headers:**
```
Authorization: Bearer <admin-or-owner-token>
```

**✅ Success Response (200):**
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "role": "DELEGATE",
  "status": "REVOKED",
  "canGenerateQR": true,
  "canManageWorkers": true
}
```

---

## **Phase 5: Clubhouse Access**

### **5.1 Request Clubhouse Access**
**Endpoint:** `POST /clubhouse/request-access`

**Headers:**
```
Authorization: Bearer <resident-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "unitId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**✅ Success Response (201):**
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440007",
  "status": "PENDING",
  "requestedAt": "2024-01-22T15:30:00.000Z"
}
```

---

### **5.2 Get Pending Clubhouse Requests**
**Endpoint:** `GET /clubhouse/pending`

**Headers:**
```
Authorization: Bearer <admin-token>
```

**✅ Success Response (200):**
```json
[
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440007",
    "status": "PENDING",
    "user": {
      "nameEN": "Ahmed Hassan"
    },
    "unit": {
      "unitNumber": "A101"
    }
  }
]
```

---

### **5.3 Approve Clubhouse Access**
**Endpoint:** `POST /clubhouse/approve/{requestId}`

**Headers:**
```
Authorization: Bearer <admin-token>
```

**✅ Success Response (200):**
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440007",
  "status": "APPROVED",
  "approvedAt": "2024-01-22T15:35:00.000Z"
}
```

---

### **5.4 Check User's Clubhouse Access**
**Endpoint:** `GET /clubhouse/my-access`

**Headers:**
```
Authorization: Bearer <resident-token>
```

**✅ Success Response (200):**
```json
[
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440007",
    "status": "APPROVED",
    "unit": {
      "unitNumber": "A101",
      "projectName": "Alkarma Heights"
    }
  }
]
```

---

## **Error Testing Scenarios**

### **Authentication Errors**
**❌ No Token (401):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**❌ Invalid Token (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid token",
  "error": "Unauthorized"
}
```

---

### **Authorization Errors**
**❌ Insufficient Permissions (403):**
```json
{
  "statusCode": 403,
  "message": "Only owner can add family/tenant",
  "error": "Forbidden"
}
```

---

### **Validation Errors**
**❌ Missing Required Fields (400):**
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "phone should not be empty"
  ],
  "error": "Bad Request"
}
```

---

### **Business Logic Errors**
**❌ Unit Not Delivered (400):**
```json
{
  "statusCode": 400,
  "message": "Unit must be delivered to add family/tenant",
  "error": "Bad Request"
}
```

**❌ Delegate Already Approved (400):**
```json
{
  "statusCode": 400,
  "message": "Delegate is not pending approval",
  "error": "Bad Request"
}
```

---

## **Complete Test Flow Checklist**

### **Happy Path Test**
- [ ] Create unit (AVAILABLE status)
- [ ] Create owner → Unit becomes NOT_DELIVERED
- [ ] Verify owner limited access
- [ ] Deliver unit → Unit becomes DELIVERED
- [ ] Verify owner full access
- [ ] Add family member → Success + email sent
- [ ] Add tenant → Success + email sent
- [ ] Request delegate → PENDING status
- [ ] Approve delegate → ACTIVE status + email sent
- [ ] Request clubhouse access → PENDING status
- [ ] Approve clubhouse access → APPROVED status

### **Edge Cases**
- [ ] Try adding family to NOT_DELIVERED unit → Fail
- [ ] Non-owner tries to add family → Fail
- [ ] Duplicate email/phone → Fail
- [ ] Request delegate for non-owned unit → Fail
- [ ] Approve non-existent request → Fail
- [ ] Revoke already revoked access → Fail

### **Security Tests**
- [ ] Access endpoints without authentication → 401
- [ ] Access admin endpoints as regular user → 403
- [ ] Access owner endpoints as non-owner → 403
- [ ] Modify other users' data → 403

---

## **Postman Collection Setup**

### **Environment Variables**
```
base_url: http://localhost:3000
admin_token: <set_after_login>
owner_token: <set_after_login>
unit_id: <set_after_creation>
user_id: <set_after_creation>
```

### **Test Scripts**
Add these test scripts to relevant requests:

**Login Response Test:**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("admin_token", response.access_token);
}
```

**Extract IDs Test:**
```javascript
const response = pm.response.json();
if (response.id) {
    pm.environment.set("unit_id", response.id);
}
```

---

## **Performance & Load Testing**

### **Concurrent Requests**
- Multiple owners creating accounts simultaneously
- Bulk delegate approvals
- High-frequency clubhouse access requests

### **Database Queries**
- Verify proper indexing on frequently queried fields
- Check for N+1 query problems in access checks
- Monitor email sending performance

---

## **Cleanup Scripts**

After testing, clean up test data:

```sql
-- Delete test users and related data
DELETE FROM "ClubhouseAccessRequest" WHERE "unitId" = 'test-unit-id';
DELETE FROM "UnitAccess" WHERE "unitId" = 'test-unit-id';
DELETE FROM "ResidentUnit" WHERE "unitId" = 'test-unit-id';
DELETE FROM "User" WHERE "email" LIKE 'test%@%';
DELETE FROM "Unit" WHERE "unitNumber" LIKE 'TEST%';
```

This comprehensive testing guide covers all endpoints, request/response formats, error scenarios, and edge cases for the complete Owner Onboarding & Access Control Flow.
