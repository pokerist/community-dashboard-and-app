# Bookings Module

## Purpose & Role in the System
The Bookings module manages facility reservations for community residents. It handles slot-based booking with validation against facility operating hours, capacity limits, and user-specific restrictions. The module supports a complete booking lifecycle from creation to approval/cancellation, integrating with notifications for status changes.

## Controllers, Services, and Key Classes
- **Controllers**: `BookingsController`
- **Services**: `BookingsService`
- **Key Classes**:
  - DTOs: `CreateBookingDto`, `UpdateBookingStatusDto`
  - Events: `BookingApprovedEvent`, `BookingCancelledEvent`
  - Files: `src/modules/bookings/bookings.controller.ts`, `src/modules/bookings/bookings.service.ts`

## API Endpoints

### 1. Create Booking
- **Endpoint**: `POST /bookings`
- **Permissions**: `booking.create`
- **Request Body**:
  ```json
  {
    "facilityId": "string (required)",
    "date": "string (ISO date, required)",
    "startTime": "string (HH:MM, required)",
    "endTime": "string (HH:MM, required)",
    "userId": "string (required)",
    "residentId": "string (optional)",
    "unitId": "string (optional)"
  }
  ```
- **Response**: Booking object with relations (facility, user, resident, unit)
- **Validation**: All fields validated; time slots must match facility configuration

### 2. Get All Bookings (Admin)
- **Endpoint**: `GET /bookings`
- **Permissions**: `booking.view_all`
- **Query Params**: None
- **Response**: Array of Booking objects with relations

### 3. Get My Bookings
- **Endpoint**: `GET /bookings/me`
- **Permissions**: `booking.view_own`
- **Response**: Array of user's bookings with relations, ordered by date desc

### 4. Get Booking by ID
- **Endpoint**: `GET /bookings/:id`
- **Permissions**: `booking.view_all` or `booking.view_own`
- **Response**: Single Booking object with full relations

### 5. Update Booking Status (Admin)
- **Endpoint**: `PATCH /bookings/:id/status`
- **Permissions**: `booking.update`
- **Request Body**:
  ```json
  {
    "status": "BookingStatus enum (required)"
  }
  ```
- **Response**: Updated Booking object

### 6. Get Facility Bookings
- **Endpoint**: `GET /bookings/facility/:facilityId`
- **Permissions**: `booking.view_by_facility`
- **Response**: Array of bookings for the facility, ordered by date asc

### 7. Cancel My Booking
- **Endpoint**: `PATCH /bookings/:id/cancel`
- **Permissions**: `booking.cancel_own`
- **Response**: Updated Booking with cancelled status

### 8. Delete Booking (Admin)
- **Endpoint**: `DELETE /bookings/:id`
- **Permissions**: `booking.delete`
- **Response**: Deleted Booking object

## DTOs and Validation Rules
- **CreateBookingDto** (`src/modules/bookings/dto/create-booking.dto.ts`):
  - `facilityId`: string, required, UUID
  - `date`: string, required, ISO date
  - `startTime`: string, required, HH:MM format
  - `endTime`: string, required, HH:MM format
  - `userId`: string, required, UUID
  - `residentId`: string, optional, UUID
  - `unitId`: string, optional, UUID

- **UpdateBookingStatusDto** (`src/modules/bookings/dto/update-status.dto.ts`):
  - `status`: BookingStatus enum, required

## Data Relationships
- **Booking** belongs to:
  - `Facility` (many-to-one)
  - `User` (many-to-one)
  - `Resident` (many-to-one, optional)
  - `Unit` (many-to-one, optional)
- **Booking** has many `Invoice`s (one-to-many)

## Business Logic and Workflow Rules
1. **Slot Validation**:
   - Checks facility active status
   - Validates against daily slot configurations and exceptions
   - Ensures requested times fit within operating hours
   - Verifies slot duration matches configuration

2. **Capacity and Limits**:
   - Enforces `maxReservationsPerDay` per user per facility
   - Applies `cooldownMinutes` between bookings

3. **Status Workflow**:
   - Initial status: `PENDING`
   - Admin can update to `APPROVED`, `CANCELLED`, or `REJECTED`
   - Users can cancel their own bookings
   - Events emitted on status changes for notifications

4. **Soft Delete**: Uses `cancelledAt` timestamp for cancellations

## Example Usage

**Creating a booking**:
```bash
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

{
  "facilityId": "fac-123",
  "date": "2024-01-15",
  "startTime": "18:00",
  "endTime": "19:00",
  "userId": "user-456",
  "unitId": "unit-789"
}
```

**Response**:
```json
{
  "id": "book-123",
  "facilityId": "fac-123",
  "date": "2024-01-15T00:00:00.000Z",
  "startTime": "18:00",
  "endTime": "19:00",
  "status": "PENDING",
  "userId": "user-456",
  "unitId": "unit-789",
  "facility": { "name": "Gym" },
  "user": { "nameEN": "John Doe" }
}
```

## File References
- Controller: `src/modules/bookings/bookings.controller.ts`
- Service: `src/modules/bookings/bookings.service.ts`
- DTOs: `src/modules/bookings/dto/`
- Events: `src/events/contracts/booking-approved.event.ts`, `src/events/contracts/booking-cancelled.event.ts`
- Database Model: `prisma/schema.prisma` (Booking model)

## External Integrations
- **Event Emitter**: Emits booking events for notification system
- **Prisma ORM**: Database operations
- **Authentication Guards**: JWT and permissions-based access control
