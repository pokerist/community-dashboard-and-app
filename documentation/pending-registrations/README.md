# Pending-Registrations Module

## Purpose & Role in the System
Handles new resident registrations through a verification process. Supports community and dashboard signup flows with document upload and admin approval.

## Controllers, Services, and Key Classes
- **Controllers**: `SignupController` (public), `PendingRegistrationsController` (admin)
- **Services**: `PendingRegistrationsService`
- **Files**: `src/modules/pending-registrations/signup.controller.ts`, `src/modules/pending-registrations/pending-registrations.controller.ts`

## Key Features
- Phone/email verification
- National ID and photo upload
- Role intent specification (OWNER/TENANT/FAMILY)
- PMS lookup integration
- Sequential processing: PENDING → PROCESSING → VERIFIED/REJECTED/EXPIRED

## API Endpoints

### Public Endpoints (SignupController)

#### 1. Create Pending Registration
- **Endpoint**: `POST /signup`
- **Public Access**: No authentication required
- **Request Body**: `CreatePendingRegistrationDto`
- **Response**: Created PendingRegistration object

### Admin Endpoints (PendingRegistrationsController)
*(Detailed admin endpoint documentation needed)*

## DTOs and Validation Rules
- **CreatePendingRegistrationDto**:
  - `phone`: string, required
  - `email`: string, optional
  - `name`: string, optional
  - `passwordHash`: string, optional
  - `origin`: string, default "community"
  - `nationalId`: string, required (PIC)
  - `personalPhotoId`: string, required (File ID)
  - `roleIntent`: string, optional

## Data Relationships
- **PendingRegistration** belongs to `File` (personalPhoto)
- **PendingRegistration** can be converted to `User`

## Business Logic and Workflow Rules
1. **Verification Process**:
   - PENDING: Initial state
   - PROCESSING: Under review
   - VERIFIED: Approved for account creation
   - REJECTED: Denied registration
   - EXPIRED: Timeout without action

2. **Document Requirements**: National ID photo mandatory

3. **PMS Integration**: Lookup existing resident data

## Example Usage

**Community signup**:
```json
{
  "phone": "+971501234567",
  "email": "user@example.com",
  "name": "John Doe",
  "nationalId": "784123456789",
  "personalPhotoId": "file-123",
  "roleIntent": "TENANT"
}
```

## File References
- Controllers: `src/modules/pending-registrations/signup.controller.ts`, `src/modules/pending-registrations/pending-registrations.controller.ts`
- Service: `src/modules/pending-registrations/pending-registrations.service.ts`
- DTOs: `src/modules/pending-registrations/dto/`
- Database Model: `prisma/schema.prisma` (PendingRegistration model)

## External Integrations
- **File Service**: Document upload handling
- **PMS System**: Resident data lookup
- **Email/Phone Verification**: OTP services

## Missing Information
- Complete admin controller endpoints
- DTO validation details
- PMS integration specifics
- Approval workflow implementation
