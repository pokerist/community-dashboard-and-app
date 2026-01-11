# Referrals Module

## Overview

The Referrals module implements an invitation-based user onboarding system that controls how new users can join the Community Dashboard platform. Instead of open registration, new users can only sign up through valid referral invitations from existing users, ensuring controlled growth and community trust.

## Key Features

- **Invitation-Based Onboarding**: New users can only register through valid referrals
- **Referral Lifecycle Management**: Track referral status from creation to conversion
- **Business Rule Enforcement**: Prevents duplicate referrals and self-referrals
- **Admin Controls**: Ability to reject inappropriate referrals
- **Audit Trail**: Complete tracking of referral creation, validation, and conversion
- **Integration**: Seamless integration with authentication system

## Architecture

### Components

1. **ReferralsService**: Core business logic for referral operations
2. **ReferralsController**: REST API endpoints for referral management
3. **Referral DTOs**: Input validation and response formatting
4. **Database Integration**: Prisma ORM for data persistence

### Database Schema

```sql
model Referral {
  id             String         @id @default(uuid())
  referrerId     String         // ID of user sending invitation
  referrer       User           @relation("referrer", fields: [referrerId], references: [id])

  friendFullName String         // Full name of invited person
  friendMobile   String         // Phone number of invited person

  message        String?        // Optional invitation message
  status         ReferralStatus @default(NEW) // NEW | CONTACTED | CONVERTED | REJECTED

  convertedUserId String?       // ID of user created via this referral
  convertedUser   User?         @relation("converted_user", fields: [convertedUserId], references: [id])

  createdAt      DateTime       @default(now())
}
```

### Referral Status Flow

```
NEW ────────► CONTACTED ────────► CONVERTED
     │                │
     └────────────────┼────────────────► REJECTED
                      │
                      └────────────────► EXPIRED (future)
```

## API Endpoints

### POST /referrals
Create a new referral invitation.

**Authentication:** Required (JWT token)
**Permissions:** `referral.create`

**Request Body:**
```json
{
  "friendFullName": "John Doe",
  "friendMobile": "+1234567890",
  "message": "Hey! Join our community dashboard!"
}
```

**Response:**
```json
{
  "id": "referral-uuid",
  "referrerId": "user-uuid",
  "friendFullName": "John Doe",
  "friendMobile": "+1234567890",
  "message": "Hey! Join our community dashboard!",
  "status": "NEW",
  "createdAt": "2024-01-01T00:00:00Z",
  "referrer": {
    "nameEN": "Jane Smith"
  }
}
```

**Business Rules Applied:**
- User cannot refer themselves
- One active referral per phone number
- Validates phone number format
- Requires authentication

### GET /referrals/validate
Validate if a phone number has a valid referral.

**Authentication:** None (public endpoint)

**Query Parameters:**
- `phone`: Phone number to validate

**Example:** `GET /referrals/validate?phone=+1234567890`

**Response:**
```json
{
  "valid": true,
  "referrerName": "Jane Smith"
}
```

**Status Logic:**
- Returns `valid: true` if referral exists with status NEW or CONTACTED
- Returns `valid: false` if no valid referral found
- Includes referrer name for UX purposes

### GET /referrals
Get paginated list of referrals with filtering.

**Authentication:** Required (JWT token)
**Permissions:** `referral.view_all`

**Query Parameters:**
```json
{
  "page": 1,
  "limit": 10,
  "status": "NEW",           // Filter by status
  "referrerId": "user-uuid", // Filter by referrer
  "dateFrom": "2024-01-01",  // Filter by date range
  "dateTo": "2024-12-31",
  "sortBy": "createdAt",     // Sort field
  "sortOrder": "desc"        // Sort order
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "referral-uuid",
      "referrer": { "nameEN": "Jane Smith" },
      "convertedUser": null,
      "friendFullName": "John Doe",
      "friendMobile": "+1234567890",
      "status": "NEW",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

### PATCH /referrals/:id/reject
Reject a referral invitation.

**Authentication:** Required (JWT token)
**Permissions:** `referral.view_all` (admin permission)

**Request Body:**
```json
{
  "reason": "Inappropriate invitation" // optional
}
```

**Response:**
```json
{
  "id": "referral-uuid",
  "status": "REJECTED",
  "referrer": { "nameEN": "Jane Smith" }
}
```

## Business Logic

### Referral Creation Rules

1. **Self-Referral Prevention**
   ```typescript
   if (referrer.phone === friendMobile) {
     throw new BadRequestException('Cannot refer yourself');
   }
   ```

2. **Duplicate Prevention**
   ```typescript
   const existingReferral = await prisma.referral.findFirst({
     where: {
       friendMobile,
       status: { in: [ReferralStatus.NEW, ReferralStatus.CONTACTED] }
     }
   });
   if (existingReferral) {
     throw new ConflictException('Active referral already exists');
   }
   ```

3. **Phone Validation**
   - Uses regex pattern: `/^\+?\d{9,15}$/`
   - Supports international format with optional + prefix

### Referral Validation Logic

```typescript
async validateReferral(phone: string) {
  const referral = await prisma.referral.findFirst({
    where: {
      friendMobile: phone,
      status: { in: [ReferralStatus.NEW, ReferralStatus.CONTACTED] }
    }
  });

  return {
    valid: !!referral,
    referrerName: referral?.referrer.nameEN || referral?.referrer.nameAR
  };
}
```

### Referral Conversion

```typescript
async convertReferral(phone: string, userId: string) {
  const referral = await prisma.referral.findFirst({
    where: {
      friendMobile: phone,
      status: { in: [ReferralStatus.NEW, ReferralStatus.CONTACTED] }
    }
  });

  if (!referral) {
    throw new BadRequestException('No valid referral found');
  }

  return prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: ReferralStatus.CONVERTED,
      convertedUserId: userId
    }
  });
}
```

## Integration with Authentication

### Signup Flow

1. **User enters phone number** → Frontend calls `/referrals/validate?phone=X`
2. **System validates referral** → Returns valid/invalid status
3. **If valid, show signup form** → User provides name and password
4. **Call `/auth/signup-with-referral`** → Auth service validates referral again
5. **Create user account** → Convert referral status to CONVERTED
6. **Return authentication tokens** → User is logged in

### Auth Service Integration

```typescript
async signupWithReferral(dto: SignupWithReferralDto) {
  // 1. Validate referral exists
  const validation = await referralsService.validateReferral(dto.phone);
  if (!validation.valid) {
    throw new BadRequestException('No valid referral found');
  }

  // 2. Check user doesn't exist
  const existingUser = await prisma.user.findFirst({
    where: { phone: dto.phone }
  });
  if (existingUser) {
    throw new BadRequestException('User already exists');
  }

  // 3. Create user
  const user = await prisma.user.create({ /* ... */ });

  // 4. Convert referral
  await referralsService.convertReferral(dto.phone, user.id);

  // 5. Generate tokens
  return generateTokens(user);
}
```

## Security Considerations

### Input Validation
- Phone number format validation
- SQL injection prevention via Prisma
- XSS protection through input sanitization

### Access Control
- Referral creation requires authentication
- Admin permissions for rejection
- Public validation endpoint (by design)

### Abuse Prevention
- Duplicate referral prevention
- Self-referral prevention
- Rate limiting on validation endpoint (recommended)

## Data Relationships

### User ↔ Referral Relationships

```sql
-- Referrer relationship (one user can send many referrals)
User.referrals: Referral[]

-- Converted user relationship (one user can be converted from one referral)
User.convertedReferral: Referral | null
```

### Referral Status Impact

- **NEW**: Initial state, valid for signup
- **CONTACTED**: User has been contacted, still valid
- **CONVERTED**: User successfully signed up, referral complete
- **REJECTED**: Admin rejected referral, no longer valid

## Error Handling

### Common Errors

```typescript
// Self-referral attempt
throw new BadRequestException('Cannot refer yourself');

// Duplicate active referral
throw new ConflictException('Active referral already exists for this phone number');

// Invalid phone format
throw new BadRequestException('Phone number must be a valid format');

// No valid referral during signup
throw new BadRequestException('No valid referral found for this phone number');

// Attempting to reject converted referral
throw new BadRequestException('Cannot reject a converted referral');
```

## Performance Considerations

### Database Indexes
- Index on `friendMobile` for fast validation lookups
- Index on `status` for filtering
- Index on `referrerId` for user-specific queries
- Index on `createdAt` for date range queries

### Query Optimization
- Use `findFirst` for validation (stops at first match)
- Include only necessary fields in relations
- Implement pagination for large result sets

## Testing Strategy

### Unit Tests
- Business logic validation
- Error condition handling
- DTO validation
- Service method testing

### Integration Tests
- Complete referral creation flow
- Signup with referral flow
- Admin rejection flow
- Database constraint validation

### E2E Tests
- Frontend integration
- Complete user onboarding flow
- Permission-based access control

## Monitoring and Analytics

### Key Metrics
- Total referrals created
- Conversion rate (CONVERTED / total referrals)
- Rejection rate (REJECTED / total referrals)
- Average time to conversion
- Referral source tracking

### Logging
- Referral creation events
- Validation attempts
- Conversion events
- Rejection events
- Failed validation attempts

## Future Enhancements

### Potential Features
- **Expiration System**: Auto-expire referrals after X days
- **Bulk Invitations**: Allow sending multiple referrals at once
- **Email Integration**: Send email invitations in addition to SMS
- **Referral Rewards**: Gamification for successful referrals
- **Analytics Dashboard**: Detailed referral analytics for admins
- **Custom Messages**: Template-based invitation messages

### Technical Improvements
- **Rate Limiting**: Implement rate limiting on validation endpoint
- **Caching**: Cache frequent validation requests
- **Batch Operations**: Support for bulk referral operations
- **Webhooks**: Notify external systems of referral events

## Configuration

### Environment Variables
```env
REFERRAL_EXPIRY_DAYS=30    # Future: auto-expire referrals
REFERRAL_MAX_PER_USER=50   # Limit referrals per user
REFERRAL_RATE_LIMIT=100    # Requests per hour for validation
```

### Permission Setup
```sql
-- Required permissions
INSERT INTO Permission (key) VALUES
  ('referral.create'),
  ('referral.view_all');
```

This referral system provides a controlled, trackable way to grow the community while maintaining security and providing excellent user experience through seamless integration with the authentication system.
