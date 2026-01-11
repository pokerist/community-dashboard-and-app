# Violations Module

## Purpose & Role in the System
Tracks community rule violations with fine management and appeal processes.

## Controllers, Services, and Key Classes
- **Controllers**: `ViolationsController`
- **Services**: `ViolationsService`
- **Files**: `src/modules/violations/violations.controller.ts`, `src/modules/violations/violations.service.ts`

## Key Features
- Sequential violation numbering (VIO-XXXXX)
- Fine amounts and due dates
- Status workflow: PENDING → PAID/CANCELLED/APPEALED
- Invoice generation for fines
- Appeal handling

## API Endpoints
*(Detailed endpoint documentation needed - requires reading controller code)*

## DTOs and Validation Rules
*(DTO definitions needed - requires reading dto files)*

## Data Relationships
- **Violation** belongs to `Unit`, `User` (target), `User` (issuer)
- **Violation** has many `Invoice`s

## Business Logic and Workflow Rules
1. **Sequential Numbering**: Auto-generated violation numbers
2. **Fine Management**: Amount and due date tracking
3. **Status Workflow**: PENDING → PAID/CANCELLED/APPEALED
4. **Appeal Process**: Resident can appeal violations
5. **Invoice Integration**: Automatic fine invoicing

## File References
- Controller: `src/modules/violations/violations.controller.ts`
- Service: `src/modules/violations/violations.service.ts`
- DTOs: `src/modules/violations/dto/`
- Database Model: `prisma/schema.prisma` (Violation model)

## External Integrations
- **Invoices Service**: Fine billing
- **Prisma ORM**: Database operations

## Missing Information
- Complete API endpoints
- DTO specifications
- Appeal workflow details
- Example violation scenarios
