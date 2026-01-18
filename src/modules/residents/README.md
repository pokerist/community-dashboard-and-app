# Residents Module - Admin Dashboard API

This module provides comprehensive admin dashboard controls for managing users and their profiles (Residents, Owners, Tenants, Admins) in the Alkarma Community Dashboard.

## Architecture Overview

The module follows the new schema where:
- **User**: Base user entity with authentication and core info
- **Resident**: User profile for residents/community members
- **Owner**: User profile for property owners
- **Tenant**: User profile for tenants/renters
- **Admin**: User profile for administrators

## API Endpoints

### User Management (`/admin/users`)

#### Create User
```
POST /admin/users
Body: CreateUserDto
Response: UserWithRelations
```

Create a new user. User can optionally be assigned roles immediately.

**Request Body:**
```json
{
  "nameEN": "John Doe",
  "nameAR": "جون دو",
  "email": "john@example.com",
  "phone": "+971501234567",
  "password": "securepassword",
  "roles": ["role_id_1", "role_id_2"],
  "signupSource": "dashboard"
}
```

#### List Users
```
GET /admin/users?userType=resident&skip=0&take=20
Query Params:
  - userType: 'resident' | 'owner' | 'tenant' | 'admin' (optional)
  - skip: number (default: 0)
  - take: number (default: 20)
Response: UserWithRelations[]
```

Get all users with optional filtering by profile type.

#### Get User
```
GET /admin/users/:id
Response: UserWithRelations
```

Get a single user with all their relations (roles, profiles, units, leases, invoices).

#### Update User
```
PATCH /admin/users/:id
Body: UpdateUserDto
Response: UserWithRelations
```

Update user information. Can also change password.

**Request Body:**
```json
{
  "nameEN": "Jane Doe",
  "email": "jane@example.com",
  "userStatus": "ACTIVE"
}
```

#### Deactivate User
```
DELETE /admin/users/:id
Response: 204 No Content
```

Soft-delete a user (sets status to DISABLED).

---

### Resident Management (`/admin/users/residents`)

#### Create Resident Profile
```
POST /admin/users/residents
Body: CreateResidentDto
Response: ResidentWithUser
```

Create a resident profile for an existing user.

**Request Body:**
```json
{
  "userId": "user_id",
  "nationalId": "784123456789",
  "dateOfBirth": "1990-01-15"
}
```

#### List Residents
```
GET /admin/users/residents?skip=0&take=20
Query Params:
  - skip: number (default: 0)
  - take: number (default: 20)
Response: ResidentWithUser[]
```

#### Get Resident
```
GET /admin/users/residents/:id
Response: ResidentWithUser
```

#### Update Resident
```
PATCH /admin/users/residents/:id
Body: UpdateResidentDto
Response: ResidentWithUser
```

#### Delete Resident
```
DELETE /admin/users/residents/:id
Response: 204 No Content
```

---

### Owner Management (`/admin/users/owners`)

#### Create Owner Profile
```
POST /admin/users/owners
Body: CreateOwnerDto
Response: OwnerWithUser
```

Create an owner profile for an existing user.

**Request Body:**
```json
{
  "userId": "user_id"
}
```

#### List Owners
```
GET /admin/users/owners?skip=0&take=20
Response: OwnerWithUser[]
```

#### Get Owner
```
GET /admin/users/owners/:id
Response: OwnerWithUser
```

#### Update Owner
```
PATCH /admin/users/owners/:id
Body: UpdateOwnerDto
Response: OwnerWithUser
```

#### Delete Owner
```
DELETE /admin/users/owners/:id
Response: 204 No Content
```

---

### Tenant Management (`/admin/users/tenants`)

#### Create Tenant Profile
```
POST /admin/users/tenants
Body: CreateTenantDto
Response: TenantWithUser
```

Create a tenant profile for an existing user.

**Request Body:**
```json
{
  "userId": "user_id"
}
```

#### List Tenants
```
GET /admin/users/tenants?skip=0&take=20
Response: TenantWithUser[]
```

#### Get Tenant
```
GET /admin/users/tenants/:id
Response: TenantWithUser
```

#### Update Tenant
```
PATCH /admin/users/tenants/:id
Body: UpdateTenantDto
Response: TenantWithUser
```

#### Delete Tenant
```
DELETE /admin/users/tenants/:id
Response: 204 No Content
```

---

### Admin Management (`/admin/users/admins`)

#### Create Admin Profile
```
POST /admin/users/admins
Body: CreateAdminDto
Response: AdminWithUser
```

Create an admin profile for an existing user.

**Request Body:**
```json
{
  "userId": "user_id",
  "status": "ACTIVE"
}
```

#### List Admins
```
GET /admin/users/admins?skip=0&take=20
Response: AdminWithUser[]
```

#### Get Admin
```
GET /admin/users/admins/:id
Response: AdminWithUser
```

#### Update Admin
```
PATCH /admin/users/admins/:id
Body: UpdateAdminDto
Response: AdminWithUser
```

#### Delete Admin
```
DELETE /admin/users/admins/:id
Response: 204 No Content
```

---

## Key Features

### Complete User Lifecycle Management
- Create users with flexible role assignment
- Create/manage profile types (Resident, Owner, Tenant, Admin)
- Soft delete users and profiles
- Update user information and credentials

### Relation Handling
The service automatically includes all related data:
- User roles and permissions
- Profile information (resident, owner, tenant, admin)
- Resident units assignments
- Leases (as owner or tenant)
- Invoices
- Other business relationships

### Error Handling
- **NotFoundException**: When a resource doesn't exist
- **ConflictException**: When trying to create a duplicate profile
- **BadRequestException**: For invalid input

### Pagination & Filtering
All list endpoints support:
- Pagination (skip/take)
- Type filtering (for users endpoint)
- Default ordering by creation date (descending)

## Service Methods

All methods are documented with JSDoc comments. Key service methods include:

### User Service
- `createUser(data)` - Create new user
- `findAllUsers(userType?, skip, take)` - List users
- `getUserWithRelations(id)` - Get user with all relations
- `updateUser(id, data)` - Update user
- `deactivateUser(id)` - Soft delete user

### Resident Service
- `createResident(data)` - Create resident profile
- `findAllResidents(skip, take)` - List residents
- `getResident(id)` - Get resident
- `getResidentByUserId(userId)` - Get resident by user ID
- `updateResident(id, data)` - Update resident
- `deleteResident(id)` - Delete resident

Similar methods available for Owners, Tenants, and Admins.

## Type Definitions

All major database responses are strongly typed:
- `UserWithRelations` - Complete user data with all relations
- `ResidentWithUser` - Resident with user information
- `OwnerWithUser` - Owner with user information
- `TenantWithUser` - Tenant with user information
- `AdminWithUser` - Admin with user information

## Security Considerations

- Passwords are hashed using bcrypt (salt rounds: 10)
- User status controls access (ACTIVE, SUSPENDED, DISABLED, INVITED)
- Soft deletion preserves data integrity
- Role-based access control integrated with UserRole model

## Usage Example

```typescript
// Create a user with roles
const user = await residentService.createUser({
  nameEN: 'John Doe',
  email: 'john@example.com',
  phone: '+971501234567',
  password: 'securepassword',
  roles: ['resident_role_id'],
  signupSource: 'dashboard'
});

// Create a resident profile for the user
const resident = await residentService.createResident({
  userId: user.id,
  nationalId: '784123456789',
  dateOfBirth: '1990-01-15'
});

// Get complete user data
const userWithRelations = await residentService.getUserWithRelations(user.id);
```

## Module Integration

Import the ResidentModule in your main AppModule:

```typescript
import { ResidentModule } from './modules/residents/residents.module';

@Module({
  imports: [ResidentModule, /* other modules */],
})
export class AppModule {}
```

---

## DTOs Reference

### CreateUserDto
- `nameEN: string` (required)
- `nameAR?: string`
- `email?: string`
- `phone?: string`
- `password?: string`
- `roles?: string[]`
- `signupSource?: string`

### UpdateUserDto
- All fields from CreateUserDto (optional)
- `userStatus?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED'`

### CreateResidentDto
- `userId: string` (required)
- `nationalId?: string`
- `dateOfBirth?: string`

### CreateOwnerDto
- `userId: string` (required)

### CreateTenantDto
- `userId: string` (required)

### CreateAdminDto
- `userId: string` (required)
- `status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED'`
