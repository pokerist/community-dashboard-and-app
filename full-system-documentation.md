# Community Dashboard API Documentation

## Table of Contents

- [Bookings Module](#bookings-module)
- [Complaints Module](#complaints-module)
- [Facilities Module](#facilities-module)
- [File Module](#file-module)
- [Incidents Module](#incidents-module)
- [Pending-Registrations Module](#pending-registrations-module)
- [Service Module](#service-module)
- [Service-Field Module](#service-field-module)
- [Service-Request Module](#service-request-module)
- [Violations Module](#violations-module)

## Bookings Module

### Purpose & Role in the System
The Bookings module manages facility reservations for community residents. It handles slot-based booking with validation against facility operating hours, capacity limits, and user-specific restrictions. The module supports a complete booking lifecycle from creation to approval/cancellation, integrating with notifications for status changes.

### Controllers, Services, and Key Classes
- **Controllers**: `BookingsController`
- **Services**: `BookingsService`
- **Key Classes**:
  - DTOs: `CreateBookingDto`, `UpdateBookingStatusDto`
  - Events: `BookingApprovedEvent`, `BookingCancelledEvent`

### API Endpoints

#### 1. Create Booking
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

#### 2. Get All Bookings (Admin)
- **Endpoint**: `GET /bookings`
- **Permissions**: `booking.view_all`
- **Query Params**: None
- **Response**: Array of Booking objects with relations

#### 3. Get My Bookings
- **Endpoint**: `GET /bookings/me`
- **Permissions**: `booking.view_own`
- **Response**: Array of user's bookings with relations, ordered by date desc

#### 4. Get Booking by ID
- **Endpoint**: `GET /bookings/:id`
- **Permissions**: `booking.view_all` or `booking.view_own`
- **Response**: Single Booking object with full relations

#### 5. Update Booking Status (Admin)
- **Endpoint**: `PATCH /bookings/:id/status`
- **Permissions**: `booking.update`
- **Request Body**:
  ```json
  {
    "status": "BookingStatus enum (required)"
  }
  ```
- **Response**: Updated Booking object

#### 6. Get Facility Bookings
- **Endpoint**: `GET /bookings/facility/:facilityId`
- **Permissions**: `booking.view_by_facility`
- **Response**: Array of bookings for the facility, ordered by date asc

#### 7. Cancel My Booking
- **Endpoint**: `PATCH /bookings/:id/cancel`
- **Permissions**: `booking.cancel_own`
- **Response**: Updated Booking with cancelled status

#### 8. Delete Booking (Admin)
- **Endpoint**: `DELETE /bookings/:id`
- **Permissions**: `booking.delete`
- **Response**: Deleted Booking object

### DTOs and Validation Rules
- **CreateBookingDto**:
  - `facilityId`: string, required, UUID
  - `date`: string, required, ISO date
  - `startTime`: string, required, HH:MM format
  - `endTime`: string, required, HH:MM format
  - `userId`: string, required, UUID
  - `residentId`: string, optional, UUID
  - `unitId`: string, optional, UUID

- **UpdateBookingStatusDto**:
  - `status`: BookingStatus enum, required

### Data Relationships
- **Booking** belongs to:
  - `Facility` (many-to-one)
  - `User` (many-to-one)
  - `Resident` (many-to-one, optional)
  - `Unit` (many-to-one, optional)
- **Booking** has many `Invoice`s (one-to-many)

### Business Logic and Workflow Rules
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

### Example Usage

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

### Highlight Missing in Previous Documentation
- Detailed slot validation logic
- Exception handling for facility closures
- Event emission for notifications
- Soft delete vs hard delete distinction

## Complaints Module

### Purpose & Role in the System
The Complaints module handles resident-submitted complaints about community issues. It supports a full complaint lifecycle from submission to resolution, with assignment to staff, status tracking, and integration with invoicing for fines.

### Controllers, Services, and Key Classes
- **Controllers**: `ComplaintsController`
- **Services**: `ComplaintsService`
- **Key Classes**:
  - DTOs: `CreateComplaintDto`, `UpdateComplaintDto`, `ComplaintsQueryDto`, `UpdateComplaintStatusDto`

### API Endpoints

#### 1. Create Complaint
- **Endpoint**: `POST /complaints`
- **Permissions**: `complaint.report`
- **Request Body**:
  ```json
  {
    "reporterId": "string (required)",
    "unitId": "string (optional)",
    "description": "string (required)",
    "category": "string (required)",
    "priority": "Priority enum (optional, default MEDIUM)"
  }
  ```
- **Response**: Created Complaint object

#### 2. Get All Complaints (Staff)
- **Endpoint**: `GET /complaints`
- **Permissions**: `complaint.view_all`
- **Query Params**: `ComplaintsQueryDto` (status, priority, unitId, reporterId, assignedToId, dates)
- **Response**: Paginated list of complaints with relations

#### 3. Get Complaint by ID
- **Endpoint**: `GET /complaints/:id`
- **Permissions**: `complaint.view_own` or `complaint.view_all`
- **Response**: Single Complaint with full relations

#### 4. Update Complaint
- **Endpoint**: `PATCH /complaints/:id`
- **Permissions**: `complaint.manage`
- **Request Body**: `UpdateComplaintDto` (partial update)
- **Response**: Updated Complaint

#### 5. Update Complaint Status
- **Endpoint**: `PATCH /complaints/:id/status`
- **Permissions**: `complaint.manage`
- **Request Body**:
  ```json
  {
    "status": "ComplaintStatus enum (required)",
    "resolutionNotes": "string (required if RESOLVED/CLOSED)"
  }
  ```
- **Response**: Updated Complaint

#### 6. Delete Complaint
- **Endpoint**: `DELETE /complaints/:id`
- **Permissions**: `complaint.delete_own` or `complaint.delete_all`
- **Response**: Deleted Complaint

### DTOs and Validation Rules
- **CreateComplaintDto**:
  - `reporterId`: string, required, UUID
  - `unitId`: string, optional, UUID
  - `description`: string, required
  - `category`: string, required
  - `priority`: Priority enum, optional

- **UpdateComplaintDto**: Extends CreateComplaintDto as PartialType, adds:
  - `status`: ComplaintStatus enum, optional
  - `assignedToId`: string, optional, UUID
  - `resolutionNotes`: string, optional

- **ComplaintsQueryDto**: Extends BaseQueryDto, adds filters for status, priority, unitId, reporterId, assignedToId, date ranges

- **UpdateComplaintStatusDto**:
  - `status`: ComplaintStatus enum, required
  - `resolutionNotes`: string, optional (required for RESOLVED/CLOSED)

### Data Relationships
- **Complaint** belongs to:
  - `User` (reporter, many-to-one)
  - `Unit` (many-to-one, optional)
  - `User` (assignedTo, many-to-one, optional)
- **Complaint** has many `Invoice`s (one-to-many)

### Business Logic and Workflow Rules
1. **Number Generation**: Auto-generates sequential complaint numbers (CMP-XXXXX)

2. **Status Workflow**:
   - Initial: `NEW`
   - Progress: `IN_PROGRESS` → `RESOLVED` or `CLOSED`
   - Resolution requires `resolutionNotes`
   - `resolvedAt` timestamp set automatically on resolution

3. **Assignment**: Staff can assign complaints to themselves or others

4. **Deletion Rules**: Cannot delete RESOLVED or CLOSED complaints

5. **Invoice Integration**: Can generate fines for complaints

### Example Usage

**Creating a complaint**:
```bash
POST /complaints
Authorization: Bearer <token>
Content-Type: application/json

{
  "reporterId": "user-123",
  "unitId": "unit-456",
  "description": "Loud music after 11 PM",
  "category": "Noise",
  "priority": "MEDIUM"
}
```

**Response**:
```json
{
  "id": "comp-123",
  "complaintNumber": "CMP-00001",
  "reporterId": "user-123",
  "description": "Loud music after 11 PM",
  "category": "Noise",
  "status": "NEW",
  "priority": "MEDIUM"
}
```

### Highlight Missing in Previous Documentation
- Complaint number generation logic
- Resolution notes requirement for status changes
- Invoice generation capability
- Assignment workflow

## Facilities Module

### Purpose & Role in the System
The Facilities module manages community amenities and venues that can be booked by residents. It handles facility configuration including operating hours, slot-based scheduling, pricing, capacity limits, and special exceptions for holidays or maintenance.

### Controllers, Services, and Key Classes
- **Controllers**: `FacilitiesController`
- **Services**: `FacilitiesService`
- **Key Classes**:
  - DTOs: `CreateFacilityDto`, `UpdateFacilityDto`
  - Nested DTOs: `CreateSlotConfigDto`, `CreateSlotExceptionDto`

### API Endpoints

#### 1. Create Facility
- **Endpoint**: `POST /facilities`
- **Permissions**: `facility.create`
- **Request Body**: `CreateFacilityDto` with optional slot configs and exceptions
- **Response**: Created Facility with relations

#### 2. Get All Facilities
- **Endpoint**: `GET /facilities`
- **Permissions**: `facility.view_all`
- **Response**: Array of Facilities with slot configs and exceptions

#### 3. Get Facility by ID
- **Endpoint**: `GET /facilities/:id`
- **Permissions**: `facility.view_all` or `facility.view_own`
- **Response**: Single Facility with full relations

#### 4. Update Facility
- **Endpoint**: `PATCH /facilities/:id`
- **Permissions**: `facility.update`
- **Request Body**: `UpdateFacilityDto` (partial)
- **Response**: Updated Facility

#### 5. Delete Facility
- **Endpoint**: `DELETE /facilities/:id`
- **Permissions**: `facility.delete`
- **Response**: Deleted Facility

### DTOs and Validation Rules
- **CreateFacilityDto**:
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

### Data Relationships
- **Facility** has many:
  - `FacilitySlotConfig` (one-to-many)
  - `FacilitySlotException` (one-to-many)
  - `Booking` (one-to-many)

### Business Logic and Workflow Rules
1. **Slot Configuration**: Daily operating hours with customizable duration and capacity
2. **Exceptions**: Date-specific overrides for closures or special hours
3. **Active Status**: Controls availability for booking
4. **Limits**: Per-user daily reservations and cooldown periods

### Example Usage
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
  ]
}
```

## File Module

### Purpose & Role in the System
The File module handles file uploads, storage, and retrieval for the community dashboard. It supports attachments for service requests, profile photos, and other documents with bucket-based organization.

### Controllers, Services, and Key Classes
- **Controllers**: `FileController`
- **Services**: `FileService`
- **Key Classes**: File storage adapters, `FileUploadResult` interface

### API Endpoints

#### 1. Upload Attachment
- **Endpoint**: `POST /files/upload/attachment`
- **Method**: Multipart form-data with 'file' key
- **Response**: `FileUploadResult` with file metadata

#### 2. Delete File
- **Endpoint**: `DELETE /files/:fileId`
- **Response**: Success confirmation

#### 3. Stream File
- **Endpoint**: `GET /files/:fileId/stream`
- **Response**: File stream

### Data Relationships
- **File** can be attached to:
  - User profile photos
  - Service request attachments
  - Invoice documents
  - Lease contracts

### Business Logic and Workflow Rules
1. **Bucket Organization**: Separate buckets for attachments vs profile photos
2. **Metadata Storage**: File info stored in database with Supabase keys
3. **Stream Serving**: Direct streaming for file access

## Incidents Module

### Purpose & Role in the System
Manages security incidents and emergency reports within the community. Tracks incident details, priority levels, response times, and resolution status.

### Key Features
- Incident numbering (INC-XXXXX)
- Priority-based handling (LOW, MEDIUM, HIGH, CRITICAL)
- Status workflow: OPEN → RESOLVED → CLOSED
- Response time tracking
- Attachment support

### Data Relationships
- **Incident** belongs to `Unit` (optional)
- **Incident** has many `Attachment`s
- **Incident** has many `Invoice`s

## Pending-Registrations Module

### Purpose & Role in the System
Handles new resident registrations through a verification process. Supports community and dashboard signup flows with document upload and admin approval.

### Key Features
- Phone/email verification
- National ID and photo upload
- Role intent specification (OWNER/TENANT/FAMILY)
- PMS lookup integration
- Sequential processing: PENDING → PROCESSING → VERIFIED/REJECTED/EXPIRED

### Controllers and Services
- `SignupController` (public routes)
- `PendingRegistrationsController` (admin)
- `PendingRegistrationsService`

## Service Module

### Purpose & Role in the System
Defines available maintenance and service offerings with customizable forms. Supports eligibility rules based on resident type and unit status.

### Key Features
- Service categorization (MAINTENANCE, RECREATION, etc.)
- Dynamic form fields via ServiceField relations
- Eligibility filtering (ALL, DELIVERED_ONLY, NON_DELIVERED_ONLY)
- Request tracking and statistics

### Data Relationships
- **Service** has many `ServiceField`s
- **Service** has many `ServiceRequest`s

## Service-Field Module

### Purpose & Role in the System
Manages form field definitions for service requests. Supports various input types including text, files, dates, and member selectors.

### Field Types
- TEXT, TEXTAREA, NUMBER, DATE, BOOLEAN, MEMBER_SELECTOR, FILE

### Data Relationships
- **ServiceField** belongs to `Service`
- **ServiceField** has many `ServiceRequestFieldValue`s

## Service-Request Module

### Purpose & Role in the System
Processes resident service requests with workflow management, assignment, and invoicing integration.

### Key Features
- Sequential request numbering
- Priority levels and assignment
- Status workflow: NEW → IN_PROGRESS → RESOLVED/CLOSED
- Dynamic field values storage
- Attachment support
- Invoice generation for paid services

### Data Relationships
- **ServiceRequest** belongs to `Service`, `Unit`, `User` (creator), `User` (assignee)
- **ServiceRequest** has many `ServiceRequestFieldValue`s, `Attachment`s, `Invoice`s

## Violations Module

### Purpose & Role in the System
Tracks community rule violations with fine management and appeal processes.

### Key Features
- Sequential violation numbering (VIO-XXXXX)
- Fine amounts and due dates
- Status workflow: PENDING → PAID/CANCELLED/APPEALED
- Invoice generation for fines
- Appeal handling

### Data Relationships
- **Violation** belongs to `Unit`, `User` (target), `User` (issuer)
- **Violation** has many `Invoice`s
