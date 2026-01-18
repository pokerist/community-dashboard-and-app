# Service-Field Module

## Purpose & Role in the System
Manages form field definitions for service requests. Supports various input types including text, files, dates, and member selectors.

## Controllers, Services, and Key Classes
- **Controllers**: `ServiceFieldController`
- **Services**: `ServiceFieldService`
- **Files**: `src/modules/service-field/service-field.controller.ts`, `src/modules/service-field/service-field.service.ts`

## Field Types
- TEXT
- TEXTAREA
- NUMBER
- DATE
- BOOLEAN
- MEMBER_SELECTOR
- FILE

## API Endpoints
*(Detailed endpoint documentation needed - requires reading controller code)*

## DTOs and Validation Rules
*(DTO definitions needed - requires reading dto files)*

## Data Relationships
- **ServiceField** belongs to `Service`
- **ServiceField** has many `ServiceRequestFieldValue`s

## Business Logic and Workflow Rules
1. **Field Ordering**: Order field for form display sequence
2. **Required Fields**: Mandatory vs optional fields
3. **Type Validation**: Input type-specific validation rules

## File References
- Controller: `src/modules/service-field/service-field.controller.ts`
- Service: `src/modules/service-field/service-field.service.ts`
- DTOs: `src/modules/service-field/dto/`
- Database Model: `prisma/schema.prisma` (ServiceField model)

## External Integrations
- **Prisma ORM**: Database operations

## Missing Information
- Complete API endpoints
- DTO specifications
- Example field configurations
- Validation logic details
