# Service-Request Module

## Purpose & Role in the System
Processes resident service requests with workflow management, assignment, and invoicing integration.

## Controllers, Services, and Key Classes
- **Controllers**: `ServiceRequestController`
- **Services**: `ServiceRequestService`
- **Files**: `src/modules/service-request/service-request.controller.ts`, `src/modules/service-request/service-request.service.ts`

## Key Features
- Sequential request numbering
- Priority levels and assignment
- Status workflow: NEW → IN_PROGRESS → RESOLVED/CLOSED
- Dynamic field values storage
- Attachment support
- Invoice generation for paid services

## API Endpoints
*(Detailed endpoint documentation needed - requires reading controller code)*

## DTOs and Validation Rules
*(DTO definitions needed - requires reading dto files)*

## Data Relationships
- **ServiceRequest** belongs to `Service`, `Unit`, `User` (creator), `User` (assignee)
- **ServiceRequest** has many `ServiceRequestFieldValue`s, `Attachment`s, `Invoice`s

## Business Logic and Workflow Rules
1. **Sequential Numbering**: Auto-generated request numbers
2. **Priority Levels**: LOW, MEDIUM, HIGH, CRITICAL
3. **Status Transitions**: NEW → IN_PROGRESS → RESOLVED/CLOSED
4. **Assignment**: Staff can assign requests to themselves or others
5. **Field Values**: Dynamic storage of form responses

## File References
- Controller: `src/modules/service-request/service-request.controller.ts`
- Service: `src/modules/service-request/service-request.service.ts`
- DTOs: `src/modules/service-request/dto/`
- Database Models: `prisma/schema.prisma` (ServiceRequest, ServiceRequestFieldValue models)

## External Integrations
- **File Service**: Attachment handling
- **Invoices Service**: Service billing
- **Prisma ORM**: Database operations

## Missing Information
- Complete API endpoints
- DTO specifications
- Example request flows
- Assignment workflow details
