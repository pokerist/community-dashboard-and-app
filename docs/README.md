# 📚 Owner Onboarding & Access Control Documentation

## Overview

This documentation covers the complete Owner Onboarding & Access Control Flow implemented for the Alkarma Community Dashboard. The flow follows the CEO's requirements for admin-controlled owner creation and unit-status-based feature gating.

## 🎯 Key Features Implemented

- ✅ **Admin-Controlled Owner Creation** - No public registration for owners
- ✅ **Unit Status Gating** - Features unlocked based on delivery status
- ✅ **Family/Tenant Management** - Owners can add family/tenants after delivery
- ✅ **Delegate Approval Workflow** - Admin approval required for all delegates
- ✅ **Clubhouse Access Control** - Request/approval system for clubhouse access
- ✅ **Email Notifications** - Automated emails for all user actions
- ✅ **Role-Based Security** - Proper authorization at every endpoint
- ✅ **Transaction Safety** - Database consistency guaranteed

## 📋 Documentation Structure

### **1. Flow Documentation**
📄 [`owner-onboarding-flow.md`](./owner-onboarding-flow.md)
- Complete flow breakdown with phases (8 phases total)
- Access control matrix
- Email notification templates
- Database schema changes
- Testing scenarios

### **2. API Testing Guide**
📄 [`api-testing-guide.md`](./api-testing-guide.md)
- All endpoints with request/response examples (40+ endpoints)
- Postman collection setup with test scripts
- Error scenarios and test cases
- Performance and security testing
- Enhanced environment variables
- Cleanup scripts

### **3. Modules Overview**
📄 [`modules-overview.md`](./modules-overview.md)
- Detailed module documentation
- Service methods and controller endpoints
- Security and authorization details
- Integration points and error handling

---

## 🚀 Quick Start

### **1. Environment Setup**
```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Run database migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

### **2. Test Data Setup**
```sql
-- Create a test unit
INSERT INTO "Unit" ("id", "projectName", "unitNumber", "status")
VALUES ('test-unit-123', 'Alkarma Heights', 'A101', 'AVAILABLE');
```

### **3. Basic Flow Test**
```bash
# 1. Create owner (Admin)
POST /owners/create-with-unit
{
  "name": "Ahmed Hassan",
  "email": "ahmed.hassan@test.com",
  "phone": "+201234567890",
  "password": "test123",
  "unitId": "test-unit-123"
}

# 2. Deliver unit (Admin)
PUT /units/test-unit-123
{
  "status": "DELIVERED"
}

# 3. Add family member (Owner)
POST /owners/add-family-tenant/test-unit-123
{
  "name": "Fatima Hassan",
  "phone": "+201234567891",
  "email": "fatima.hassan@test.com",
  "type": "FAMILY"
}
```

---

## 📊 Flow Summary

```
Unit Purchase
    ↓
Admin Creates Owner
Unit: AVAILABLE → NOT_DELIVERED
    ↓
Unit Delivery
Unit: NOT_DELIVERED → DELIVERED
    ↓
Owner Actions Unlocked:
├── Add Family/Tenant
├── Request Delegates
├── Full Facility Access
├── QR Code Generation
└── Worker Management
    ↓
Delegate Approval
Owner → Request → Admin → Approve → Email
    ↓
Clubhouse Access
Resident → Request → Admin → Approve
```

---

## 🔑 Key Concepts

### **Unit Status Progression**
- `AVAILABLE` → `NOT_DELIVERED` → `DELIVERED` → `OCCUPIED`/`LEASED`

### **User Roles**
- `OWNER` - Full unit management
- `TENANT` - Standard resident access
- `FAMILY` - Family member access
- `DELEGATE` - Approved third-party access

### **Access Status**
- `PENDING` - Waiting approval
- `ACTIVE` - Currently active
- `REVOKED` - Access revoked

---

## 🛠️ API Endpoints Summary

### **Owner Management**
- `POST /owners/create-with-unit` - Create owner (Admin)
- `POST /owners/add-family-tenant/:unitId` - Add family/tenant (Owner)

### **Delegate Management**
- `POST /delegates/request` - Request delegate (Owner)
- `POST /delegates/:id/approve` - Approve delegate (Admin)
- `POST /delegates/:id/revoke` - Revoke delegate (Admin/Owner)
- `GET /delegates/pending` - Get pending requests (Admin)

### **Clubhouse Access**
- `POST /clubhouse/request-access` - Request access (Resident)
- `POST /clubhouse/approve/:id` - Approve access (Admin)
- `GET /clubhouse/pending` - Get pending requests (Admin)

### **Units & Access**
- `PUT /units/:id` - Update unit status (Admin)
- `GET /units/can-access-feature/:unitId` - Check feature access

---

## 🔐 Security Features

### **Authorization Levels**
- **Admin Only**: Owner creation, delegate approvals, unit status changes
- **Owner Only**: Add family/tenant, request delegates, manage unit
- **Resident Only**: Request clubhouse access, basic features

### **Feature Gating**
| Feature | NOT_DELIVERED | DELIVERED |
|---------|---------------|-----------|
| Add Family/Tenant | ❌ | ✅ |
| Request Delegates | ❌ | ✅ |
| Generate QR Codes | ❌ | ✅ |
| Manage Workers | ❌ | ✅ |
| View Financials | ✅ | ✅ |

---

## 📧 Email Notifications

### **Automated Emails**
- ✅ Owner account creation with credentials
- ✅ Family/tenant addition with credentials
- ✅ Delegate approval confirmation
- ✅ Delegate revocation notice

### **Email Templates**
All emails include login links and clear instructions for new users.

---

## 🧪 Testing

### **Comprehensive Test Coverage**
- ✅ Happy path scenarios
- ✅ Error handling (400, 401, 403, 404, 409)
- ✅ Authorization testing
- ✅ Business logic validation
- ✅ Email notification verification

### **Postman Collection**
Import the collection from [`api-testing-guide.md`](./api-testing-guide.md) for complete API testing.

---

## 🗄️ Database Changes

### **New Tables**
- `ClubhouseAccessRequest` - Clubhouse access requests

### **Modified Tables**
- `UnitAccess` - Added delegate types and approval workflow
- `Unit` - Enhanced status enum

### **New Enums**
- `UnitStatus`: AVAILABLE, NOT_DELIVERED, DELIVERED, OCCUPIED, LEASED
- `UnitAccessRole`: OWNER, TENANT, FAMILY, DELEGATE
- `DelegateType`: FAMILY, FRIEND, INTERIOR_DESIGNER

---

## 📈 Performance & Scalability

### **Optimizations**
- Database transactions for consistency
- Proper indexing on frequently queried fields
- Email queuing for non-blocking notifications
- Efficient access control checks

### **Monitoring**
- Request/response logging
- Error tracking
- Performance metrics
- Audit trails

---

## 🔄 Integration Points

### **Existing Systems**
- Authentication (JWT tokens)
- Email service (SMTP)
- User management (Residents module)
- Unit management (Units module)

### **Event-Driven**
- Unit status changes trigger access updates
- Delegate approvals trigger notifications
- Owner creation sends welcome emails

---

## 📞 Support

For questions about this implementation:
1. Check the detailed documentation in each file
2. Review the API testing guide for examples
3. Examine the module-specific documentation
4. Test with the provided Postman collection

The implementation is production-ready with proper error handling, security, and comprehensive testing coverage.
