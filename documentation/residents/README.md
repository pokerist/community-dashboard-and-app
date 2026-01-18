# Residents Module

## Overview

The Residents module provides comprehensive user management functionality for the Community Dashboard system. It handles the creation, management, and administration of all user types including Residents, Owners, Tenants, and Admins. The module implements a flexible user profile system where base user authentication data is separated from role-specific profile information.

## Key Features

- **Multi-User Type Support**: Manage Residents, Owners, Tenants, and Admins
- **Flexible Profile System**: Separate authentication from role-specific data
- **Complete User Lifecycle**: Create, read, update, and deactivate users
- **Role-Based Access**: Integration with permission system
- **Soft Deletion**: Preserve data integrity while removing access
- **Comprehensive Relations**: Handle all user-related data (units, leases, invoices, etc.)

## Architecture

### User Model Hierarchy

```
User (Base Entity)
├── Resident Profile
├── Owner Profile
├── Tenant Profile
└── Admin Profile
```

### Database Relationships

- **User**: Core authentication and basic information
- **Resident**: Community member profile with national ID, date of birth
- **Owner**: Property owner profile
- **Tenant**: Property tenant/renter profile
- **Admin**: System administrator profile

### Key Relationships

```sql
User {
  id: String (UUID)
  email: String?
  phone: String?
  nameEN: String?
  nameAR: String?
  passwordHash: String?
  userStatus: UserStatusEnum
  signupSource: String
  createdAt: DateTime

  -- Relations
  roles: UserRole[]
  resident?: Resident
  owner?: Owner
  tenant?: Tenant
  admin?: Admin
  residentUnits: ResidentUnit[]
  leasesAsOwner: Lease[]
  leasesAsTenant: Lease[]
  invoices: Invoice[]
  -- ... other relations
}
```

## API Endpoints

### User Management

#### POST /admin/users
Create a new user with optional role assignment.

**Authentication:** Required (Admin permissions)
**Permissions:** `user.create`

**Request Body:**
```json
{
  "nameEN": "John Doe",
  "nameAR": "جون دو",
  "email": "john@example.com",
  "phone": "+971501234567",
  "password": "securePassword123",
  "roles": ["resident-role-id"],
  "signupSource": "dashboard"
}
```

**Response:**
```json
{
  "id": "user-uuid",
  "nameEN": "John Doe",
  "nameAR": "جون دو",
  "email": "john@example.com",
  "phone": "+971501234567",
  "userStatus": "ACTIVE",
  "signupSource": "dashboard",
  "createdAt": "2024-01-01T00:00:00Z",
  "roles": [
    {
      "role": {
        "id": "role-uuid",
        "name": "Resident",
        "permissions": [...]
      }
    }
  ]
}
```

#### GET /admin/users
List users with optional filtering.

**Query Parameters:**
```json
{
  "userType": "resident", // 'resident' | 'owner' | 'tenant' | 'admin'
  "skip": 0,
  "take": 20
}
```

#### GET /admin/users/:id
Get complete user information with all relations.

#### PATCH /admin/users/:id
Update user information.

**Request Body:**
```json
{
  "nameEN": "Jane Doe",
  "email": "jane@example.com",
  "userStatus": "ACTIVE",
  "password": "newPassword123" // optional
}
```

#### DELETE /admin/users/:id
Soft delete user (set status to DISABLED).

### Resident Management

#### POST /admin/users/residents
Create resident profile.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "nationalId": "784123456789",
  "dateOfBirth": "1990-01-15"
}
```

#### GET /admin/users/residents
List all residents with user information.

#### GET /admin/users/residents/:id
Get specific resident profile.

#### PATCH /admin/users/residents/:id
Update resident information.

#### DELETE /admin/users/residents/:id
Remove resident profile.

### Owner Management

#### POST /admin/users/owners
Create owner profile.

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

#### GET /admin/users/owners
List all property owners.

#### GET /admin/users/owners/:id
Get specific owner profile.

#### PATCH /admin/users/owners/:id
Update owner information.

#### DELETE /admin/users/owners/:id
Remove owner profile.

### Tenant Management

#### POST /admin/users/tenants
Create tenant profile.

**Request Body:**
```json
{
  "userId": "user-uuid"
}
```

#### GET /admin/users/tenants
List all tenants.

#### GET /admin/users/tenants/:id
Get specific tenant profile.

#### PATCH /admin/users/tenants/:id
Update tenant information.

#### DELETE /admin/users/tenants/:id
Remove tenant profile.

### Admin Management

#### POST /admin/users/admins
Create admin profile.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "status": "ACTIVE"
}
```

#### GET /admin/users/admins
List all administrators.

#### GET /admin/users/admins/:id
Get specific admin profile.

#### PATCH /admin/users/admins/:id
Update admin information.

#### DELETE /admin/users/admins/:id
Remove admin profile.

## Business Logic

### User Creation Flow

1. **Validate Input**: Check required fields and format validation
2. **Check Duplicates**: Ensure email/phone uniqueness
3. **Hash Password**: Use bcrypt with 12 salt rounds
4. **Create User**: Insert base user record
5. **Assign Roles**: Create UserRole relationships if provided
6. **Return Complete User**: Include roles and permissions

### Profile Creation Rules

- **One Profile Per User**: A user can only have one profile type
- **User Must Exist**: Profile creation requires existing user
- **Validation**: Profile-specific validation (e.g., national ID format)
- **Status Management**: Profile status tracks with user status

### Soft Deletion Strategy

```typescript
// Instead of hard delete
await prisma.user.update({
  where: { id },
  data: { userStatus: UserStatusEnum.DISABLED }
});
```

Benefits:
- Preserves referential integrity
- Maintains audit trail
- Allows reactivation if needed
- Keeps historical data

## Security Considerations

### Password Security
- **Hashing**: bcrypt with 12 rounds minimum
- **Storage**: Never store plain text passwords
- **Updates**: Re-hash on password changes

### Access Control
- **Admin Permissions**: All endpoints require admin access
- **Profile Restrictions**: Users can only manage their own profiles (future)
- **Status Checks**: Disabled users cannot access system

### Data Protection
- **PII Handling**: Secure storage of national IDs, personal data
- **Audit Trail**: Track all user and profile changes
- **Consent Management**: GDPR compliance considerations

## Data Relationships & Queries

### Complex User Queries

```typescript
// Get user with all relations
const userWithRelations = await prisma.user.findUnique({
  where: { id },
  include: {
    roles: {
      include: { role: { include: { permissions: true } } }
    },
    resident: true,
    owner: true,
    tenant: true,
    admin: true,
    residentUnits: {
      include: { unit: true }
    },
    leasesAsOwner: { include: { unit: true, tenant: true } },
    leasesAsTenant: { include: { unit: true, owner: true } },
    invoices: { include: { unit: true } }
  }
});
```

### Profile-Specific Queries

```typescript
// Get resident with user info
const residentWithUser = await prisma.resident.findUnique({
  where: { id },
  include: { user: true }
});
```

## Error Handling

### Common Error Scenarios

```typescript
// User already exists
throw new ConflictException('User with this email/phone already exists');

// Profile already exists for user
throw new ConflictException('User already has a profile');

// User not found
throw new NotFoundException('User not found');

// Invalid profile data
throw new BadRequestException('Invalid national ID format');
```

### Validation Rules

- **Email Format**: Standard email validation
- **Phone Format**: International format support
- **National ID**: Country-specific validation
- **Date of Birth**: Age restrictions (if applicable)
- **Password Strength**: Minimum requirements

## Performance Optimization

### Database Indexes
- Index on `email`, `phone` for fast lookups
- Index on `userStatus` for active user queries
- Composite indexes for common query patterns

### Query Optimization
- **Selective Includes**: Only include needed relations
- **Pagination**: Implement cursor-based pagination for large datasets
- **Caching**: Cache frequently accessed user data

### N+1 Query Prevention

```typescript
// Good: Single query with includes
const users = await prisma.user.findMany({
  include: { resident: true, roles: true }
});

// Avoid: Multiple queries in loop
// const users = await prisma.user.findMany();
// for (const user of users) {
//   user.resident = await prisma.resident.findUnique(...);
// }
```

## Testing Strategy

### Unit Tests
- Service method validation
- DTO validation
- Business logic rules
- Error condition handling

### Integration Tests
- Complete user creation workflows
- Profile management flows
- Permission integration
- Database constraints

### E2E Tests
- Admin user management flows
- Profile creation and updates
- Authentication integration
- Role-based access control

## Monitoring & Analytics

### Key Metrics
- Total active users by type
- User registration trends
- Profile completion rates
- Account deactivation rates

### Audit Logging
- User creation/deletion events
- Profile changes
- Role assignments
- Status changes

## Integration Points

### With Other Modules
- **Authentication**: User login and token generation
- **Permissions**: Role and permission management
- **Units**: Resident unit assignments
- **Leases**: Owner/tenant lease management
- **Invoices**: User billing relationships
- **Referrals**: User onboarding tracking

### External Systems
- **Email Service**: Welcome emails and notifications
- **SMS Service**: Phone verification and alerts
- **Identity Verification**: National ID validation services
- **Audit Systems**: Compliance and security logging

## Configuration

### Environment Variables
```env
BCRYPT_ROUNDS=12
DEFAULT_USER_STATUS=ACTIVE
MAX_USERS_PER_PAGE=50
USER_CACHE_TTL=300
```

### Permission Setup
```sql
-- Required permissions for user management
INSERT INTO Permission (key) VALUES
  ('user.create'),
  ('user.view_all'),
  ('user.update'),
  ('user.delete'),
  ('user.view_own');
```

## Best Practices

### User Management
1. **Consistent Naming**: Use EN/AR name pairs for bilingual support
2. **Status Management**: Use status enums instead of deletion
3. **Role Assignment**: Assign roles during user creation when possible
4. **Profile Completion**: Encourage profile completion for better UX

### Security
1. **Password Policies**: Enforce strong password requirements
2. **Session Management**: Implement proper logout and token revocation
3. **Data Validation**: Validate all user inputs thoroughly
4. **Audit Trail**: Log all user-related changes

### Performance
1. **Lazy Loading**: Load relations only when needed
2. **Pagination**: Always implement pagination for list endpoints
3. **Indexing**: Ensure proper database indexes
4. **Caching**: Cache frequently accessed user data

## Future Enhancements

### Planned Features
- **User Self-Registration**: Allow users to create their own accounts
- **Profile Completion Flows**: Guided profile setup
- **Bulk Operations**: Import/export user data
- **Advanced Search**: Full-text search across user fields
- **User Preferences**: Customizable user settings
- **Two-Factor Authentication**: Enhanced security
- **Social Login**: OAuth integration
- **User Analytics**: Detailed user behavior tracking

### Technical Improvements
- **GraphQL API**: More flexible data fetching
- **Real-time Updates**: WebSocket notifications
- **Advanced Caching**: Redis integration
- **Microservices**: Split into separate user service
- **Event Sourcing**: Complete audit trail

This residents module provides a solid foundation for user management in the Community Dashboard, with room for future enhancements and scalability improvements.
