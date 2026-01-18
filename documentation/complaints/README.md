# Complaints Module

## Purpose & Role in the System
The Complaints module handles resident-submitted complaints about community issues. It supports a full complaint lifecycle from submission to resolution, with assignment to staff, status tracking, and integration with invoicing for fines.

## Controllers, Services, and Key Classes
- **Controllers**: `ComplaintsController`
- **Services**: `ComplaintsService`
- **Key Classes**:
  - DTOs: `CreateComplaintDto`, `UpdateComplaintDto`, `ComplaintsQueryDto`, `UpdateComplaintStatusDto`
  - Files: `src/modules/complaints/complaints.controller.ts`, `src/modules/complaints/complaints.service.ts`

## API Endpoints

### 1. Create Complaint
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

### 2. Get All Complaints (Staff)
- **Endpoint**: `GET /complaints`
- **Permissions**: `complaint.view_all`
- **Query Params**: `ComplaintsQueryDto` (status, priority, unitId, reporterId, assignedToId, dates)
- **Response**: Paginated list of complaints with relations

### 3. Get Complaint by ID
- **Endpoint**: `GET /complaints/:id`
- **Permissions**: `complaint.view_own` or `complaint.view_all`
- **Response**: Single Complaint with full relations

### 4. Update Complaint
- **Endpoint**: `PATCH /complaints/:id`
- **Permissions**: `complaint.manage`
- **Request Body**: `UpdateComplaintDto` (partial update)
- **Response**: Updated Complaint

### 5. Update Complaint Status
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

### 6. Delete Complaint
- **Endpoint**: `DELETE /complaints/:id`
- **Permissions**: `complaint.delete_own` or `complaint.delete_all`
- **Response**: Deleted Complaint

## DTOs and Validation Rules
- **CreateComplaintDto** (`src/modules/complaints/dto/complaints.dto.ts`):
  - `reporterId`: string, required, UUID
  - `unitId`: string, optional, UUID
  - `description`: string, required
  - `category`: string, required
  - `priority`: Priority enum, optional

- **UpdateComplaintDto**: Extends CreateComplaintDto as PartialType, adds:
  - `status`: ComplaintStatus enum, optional
  - `assignedToId`: string, optional, UUID
  - `resolutionNotes`: string, optional

- **ComplaintsQueryDto** (`src/modules/complaints/dto/complaints-query.dto.ts`): Extends BaseQueryDto, adds filters for status, priority, unitId, reporterId, assignedToId, date ranges

- **UpdateComplaintStatusDto** (`src/modules/complaints/dto/update-status.dto.ts`):
  - `status`: ComplaintStatus enum, required
  - `resolutionNotes`: string, optional (required for RESOLVED/CLOSED)

## Data Relationships
- **Complaint** belongs to:
  - `User` (reporter, many-to-one)
  - `Unit` (many-to-one, optional)
  - `User` (assignedTo, many-to-one, optional)
- **Complaint** has many `Invoice`s (one-to-many)

## Business Logic and Workflow Rules
1. **Number Generation**: Auto-generates sequential complaint numbers (CMP-XXXXX)

2. **Status Workflow**:
   - Initial: `NEW`
   - Progress: `IN_PROGRESS` → `RESOLVED` or `CLOSED`
   - Resolution requires `resolutionNotes`
   - `resolvedAt` timestamp set automatically on resolution

3. **Assignment**: Staff can assign complaints to themselves or others

4. **Deletion Rules**: Cannot delete RESOLVED or CLOSED complaints

5. **Invoice Integration**: Can generate fines for complaints

## Example Usage

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

## File References
- Controller: `src/modules/complaints/complaints.controller.ts`
- Service: `src/modules/complaints/complaints.service.ts`
- DTOs: `src/modules/complaints/dto/`
- Database Model: `prisma/schema.prisma` (Complaint model)

## External Integrations
- **Invoices Service**: Generates fines for complaints
- **Prisma ORM**: Database operations
- **Authentication Guards**: JWT and permissions-based access control
