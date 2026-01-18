# Authentication Module

## Overview

The Authentication module handles user authentication, authorization, session management, and role-based access control (RBAC) for the Community Dashboard system. It provides secure login/logout functionality, JWT token management, and permission-based endpoint protection.

## Key Features

- **JWT Authentication**: Stateless authentication using JSON Web Tokens
- **Refresh Tokens**: Long-lived refresh tokens for seamless user experience
- **Role-Based Access Control**: Permission-based endpoint protection
- **Password Security**: Bcrypt hashing with configurable rounds
- **Account Lockout**: Automatic account locking after failed login attempts
- **Referral-Based Signup**: Integration with invitation system for controlled user onboarding

## Architecture

### Components

1. **AuthService**: Core authentication business logic
2. **AuthController**: HTTP endpoints for auth operations
3. **JwtStrategy**: Passport JWT strategy for token validation
4. **PermissionsGuard**: Route protection based on user permissions
5. **JwtAuthGuard**: JWT token validation guard
6. **PermissionCacheService**: Caches and resolves user permissions

### Database Entities

- **User**: Base user entity with authentication fields
- **RefreshToken**: Stores hashed refresh tokens
- **Role**: User roles (Admin, Resident, Owner, Tenant)
- **UserRole**: Many-to-many relationship between users and roles
- **Permission**: Individual permissions (e.g., "unit.view", "booking.create")
- **RolePermission**: Role-permission assignments

## API Endpoints

### POST /auth/login
User login with email/phone and password.

**Request Body:**
```json
{
  "email": "user@example.com", // optional
  "phone": "+1234567890",     // optional (either email or phone required)
  "password": "userpassword"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-string"
}
```

**Features:**
- Accepts either email or phone for login
- Checks for pending registrations
- Implements account lockout after 5 failed attempts
- Updates last login timestamp
- Returns JWT tokens with user permissions

### POST /auth/signup-with-referral
New user registration via referral invitation.

**Request Body:**
```json
{
  "phone": "+1234567890",
  "name": "John Doe",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-string"
}
```

**Features:**
- Validates referral exists and is active
- Prevents duplicate user creation
- Automatically converts referral status
- Sets signup source to "referral"

### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "userId": "user-uuid",
  "refreshToken": "refresh-token-string"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "new-refresh-token"
}
```

**Security Features:**
- Validates refresh token against stored hash
- Revokes compromised tokens
- Issues new token pair

## Security Implementation

### Password Security
- **Hashing**: bcrypt with 12 salt rounds
- **Storage**: Never stores plain text passwords
- **Validation**: Minimum length and complexity rules

### JWT Tokens
- **Access Token**: 15-minute expiration
- **Refresh Token**: 7-day expiration
- **Payload**: Contains user ID, roles, and permissions
- **Signing**: Uses configurable secret key

### Account Protection
- **Failed Attempts**: Tracks login failures
- **Lockout**: 15-minute lockout after 5 failures
- **Session Management**: Automatic token revocation

### Permission System
- **RBAC**: Role-Based Access Control
- **Permissions**: Granular permission system (e.g., "unit.view_all", "booking.create")
- **Caching**: Permission resolution caching for performance
- **Super Admin**: Bypass permission checks

## Permission Structure

### Predefined Permissions
- `auth.*` - Authentication-related permissions
- `user.*` - User management permissions
- `unit.*` - Property unit permissions
- `booking.*` - Facility booking permissions
- `complaint.*` - Complaint management permissions
- `violation.*` - Violation tracking permissions
- `invoice.*` - Billing permissions
- `service.*` - Service request permissions
- `referral.*` - Referral system permissions

### Permission Levels
- `*.view` - Read access
- `*.view_all` - View all records
- `*.view_own` - View own records
- `*.create` - Create new records
- `*.update` - Update existing records
- `*.delete` - Delete records

## Guards and Decorators

### @UseGuards(JwtAuthGuard, PermissionsGuard)
Protects endpoints requiring authentication and specific permissions.

### @Permissions('permission.key')
Specifies required permissions for endpoint access.

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('unit.view_all')
@Get('units')
findAll() {
  // Only users with 'unit.view_all' permission can access
}
```

### @User() Decorator
Injects authenticated user information into route handlers.

```typescript
create(@Body() dto: CreateDto, @User('id') userId: string) {
  // userId contains the authenticated user's ID
}
```

## Configuration

### Environment Variables
```env
JWT_ACCESS_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
BCRYPT_ROUNDS=12
```

### Token Expiration
- Access tokens: 15 minutes
- Refresh tokens: 7 days
- Account lockout: 15 minutes after 5 failed attempts

## Error Handling

### Common Error Responses
- `401 Unauthorized`: Invalid credentials or expired tokens
- `403 Forbidden`: Insufficient permissions
- `429 Too Many Requests`: Rate limiting triggered
- `400 Bad Request`: Invalid input data

## Integration Points

### With Other Modules
- **Referrals**: Validates referral codes during signup
- **Users**: Provides user context for permissions
- **All Modules**: Protects endpoints based on user roles

### External Services
- **Email Service**: Password reset notifications
- **SMS Service**: Multi-factor authentication
- **Audit Logging**: Security event tracking

## Testing

### Unit Tests
- AuthService methods
- Guard logic
- Token generation/validation
- Permission resolution

### Integration Tests
- Complete authentication flows
- Permission-based access control
- Token refresh scenarios
- Account lockout behavior

## Best Practices

1. **Token Storage**: Store tokens securely (HttpOnly cookies in production)
2. **Password Policies**: Enforce strong password requirements
3. **Session Management**: Implement proper logout/token revocation
4. **Rate Limiting**: Protect against brute force attacks
5. **Audit Logging**: Log authentication events
6. **Token Rotation**: Rotate refresh tokens regularly

## Security Considerations

- **HTTPS Only**: Always use HTTPS in production
- **Token Expiry**: Short-lived access tokens
- **Refresh Token Rotation**: Issue new refresh tokens on use
- **Logout**: Properly revoke tokens on logout
- **CSRF Protection**: Implement CSRF tokens for state-changing operations
- **CORS**: Configure appropriate CORS policies

## Performance Optimization

- **Permission Caching**: Cache resolved permissions to reduce database queries
- **Token Validation**: Efficient JWT validation without database calls
- **Session Storage**: Consider Redis for token storage in distributed environments
- **Rate Limiting**: Implement distributed rate limiting for scalability

## Monitoring and Logging

- **Authentication Events**: Log login/logout events
- **Failed Attempts**: Monitor suspicious login activity
- **Token Issues**: Track token validation failures
- **Permission Denials**: Log unauthorized access attempts

This authentication system provides a robust, scalable foundation for securing the Community Dashboard application while maintaining excellent user experience through thoughtful token management and permission design.
