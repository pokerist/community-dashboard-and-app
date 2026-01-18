# Service Module

## Purpose & Role in the System
Defines available maintenance and service offerings with customizable forms. Supports eligibility rules based on resident type and unit status.

## Controllers, Services, and Key Classes
- **Controllers**: `ServiceController`
- **Services**: `ServiceService`
- **Files**: `src/modules/service/service.controller.ts`, `src/modules/service/service.service.ts`

## Key Features
- Service categorization (MAINTENANCE, RECREATION, etc.)
- Dynamic form fields via ServiceField relations
- Eligibility filtering (ALL, DELIVERED_ONLY, NON_DELIVERED_ONLY)
- Request tracking and statistics

## API Endpoints
*(Detailed endpoint documentation needed - requires reading controller code)*

## DTOs and Validation Rules
*(DTO definitions needed - requires reading dto files)*

## Data Relationships
- **Service** has many `ServiceField`s
- **Service** has many `ServiceRequest`s

## Business Logic and Workflow Rules
1. **Eligibility Rules**:
   - ALL: Available to all residents
   - DELIVERED_ONLY: Only delivered units
   - NON_DELIVERED_ONLY: Only non-delivered units

2. **Processing Time**: Estimated completion time tracking

3. **Active Status**: Enable/disable services

## File References
- Controller: `src/modules/service/service.controller.ts`
- Service: `src/modules/service/service.service.ts`
- DTOs: `src/modules/service/dto/`
- Database Model: `prisma/schema.prisma` (Service model)

## External Integrations
- **Prisma ORM**: Database operations

## Missing Information
- Complete API endpoints
- DTO specifications
- Example usage
- Business logic details
