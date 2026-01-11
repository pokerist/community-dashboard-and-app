# Facilities Module

## Purpose & Role in the System
The Facilities module manages community amenities and venues that can be booked by residents. It handles facility configuration including operating hours, slot-based scheduling, pricing, capacity limits, and special exceptions for holidays or maintenance.

## Controllers, Services, and Key Classes
- **Controllers**: `FacilitiesController`
- **Services**: `FacilitiesService`
- **Key Classes**:
  - DTOs: `CreateFacilityDto`, `UpdateFacilityDto`
  - Nested DTOs: `CreateSlotConfigDto`, `CreateSlotExceptionDto`
  - Files: `src/modules/facilities/facilities.controller.ts`, `src/modules/facilities/facilities.service.ts`

## API Endpoints

### 1. Create Facility
- **Endpoint**: `POST /facilities`
- **Permissions**: `facility.create`
- **Request Body**: `CreateFacilityDto` with optional slot configs and exceptions
- **Response**: Created Facility with relations

### 2. Get All Facilities
- **Endpoint**: `GET /facilities`
- **Permissions**: `facility.view_all`
- **Response**: Array of Facilities with slot configs and exceptions

### 3. Get Facility by ID
- **Endpoint**: `GET /facilities/:id`
- **Permissions**: `facility.view_all` or `facility.view_own`
- **Response**: Single Facility with full relations

### 4. Update Facility
- **Endpoint**: `PATCH /facilities/:id`
- **Permissions**: `facility.update`
- **Request Body**: `UpdateFacilityDto` (partial)
- **Response**: Updated Facility

### 5. Delete Facility
- **Endpoint**: `DELETE /facilities/:id`
- **Permissions**: `facility.delete`
- **Response**: Deleted Facility

## DTOs and Validation Rules
- **CreateFacilityDto** (`src/modules/facilities/dto/create-facility.dto.ts`):
  - `name`: string, required
  - `description`: string, optional
  - `type`: FacilityType enum, optional
  - `isActive`: boolean, optional (default true)
  - `capacity`: number, optional
  - `price`: number, optional
  - `billingCycle`: BillingCycle enum, optional
  - `maxReservationsPerDay`: number, optional
  - `cooldownMinutes`: number, optional
  - `slotConfig`: array of slot configs, optional
  - `slotExceptions`: array of exceptions, optional

- **CreateSlotConfigDto** (nested):
  - `dayOfWeek`: number, required (0-6)
  - `startTime`: string, required (HH:MM)
  - `endTime`: string, required (HH:MM)
  - `slotDurationMinutes`: number, required (min 1)
  - `slotCapacity`: number, optional

- **CreateSlotExceptionDto** (nested):
  - `date`: string, required (ISO date)
  - `isClosed`: boolean, optional
  - `startTime`: string, optional
  - `endTime`: string, optional
  - `slotDurationMinutes`: number, optional
  - `slotCapacity`: number, optional

## Data Relationships
- **Facility** has many:
  - `FacilitySlotConfig` (one-to-many)
  - `FacilitySlotException` (one-to-many)
  - `Booking` (one-to-many)

## Business Logic and Workflow Rules
1. **Slot Configuration**: Daily operating hours with customizable duration and capacity
2. **Exceptions**: Date-specific overrides for closures or special hours
3. **Active Status**: Controls availability for booking
4. **Limits**: Per-user daily reservations and cooldown periods

## Example Usage
```json
{
  "name": "Swimming Pool",
  "type": "POOL",
  "capacity": 50,
  "slotConfig": [
    {
      "dayOfWeek": 1,
      "startTime": "08:00",
      "endTime": "20:00",
      "slotDurationMinutes": 60,
      "slotCapacity": 10
    }
  ],
  "slotExceptions": [
    {
      "date": "2024-12-25",
      "isClosed": true
    }
  ]
}
```

## File References
- Controller: `src/modules/facilities/facilities.controller.ts`
- Service: `src/modules/facilities/facilities.service.ts`
- DTOs: `src/modules/facilities/dto/`
- Database Models: `prisma/schema.prisma` (Facility, FacilitySlotConfig, FacilitySlotException models)

## External Integrations
- **Prisma ORM**: Database operations with nested relations
- **Authentication Guards**: JWT and permissions-based access control
