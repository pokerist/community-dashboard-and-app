# Incidents Module

## Purpose & Role in the System
Manages security incidents and emergency reports within the community. Tracks incident details, priority levels, response times, and resolution status.

## Controllers, Services, and Key Classes
- **Controllers**: `IncidentsController`
- **Services**: `IncidentsService`
- **Files**: `src/modules/incidents/incidents.controller.ts`, `src/modules/incidents/incidents.service.ts`

## Key Features
- Incident numbering (INC-XXXXX)
- Priority-based handling (LOW, MEDIUM, HIGH, CRITICAL)
- Status workflow: OPEN → RESOLVED → CLOSED
- Response time tracking
- Attachment support

## API Endpoints
*(Detailed endpoint documentation needed - requires reading controller code)*

## DTOs and Validation Rules
*(DTO definitions needed - requires reading dto files)*

## Data Relationships
- **Incident** belongs to `Unit` (optional)
- **Incident** has many `Attachment`s
- **Incident** has many `Invoice`s

## Business Logic and Workflow Rules
1. **Sequential Numbering**: Auto-generated incident numbers
2. **Priority Levels**: LOW, MEDIUM, HIGH, CRITICAL
3. **Status Transitions**: OPEN → RESOLVED → CLOSED
4. **Response Time Tracking**: Minutes/seconds from report to resolution

## File References
- Controller: `src/modules/incidents/incidents.controller.ts`
- Service: `src/modules/incidents/incidents.service.ts`
- DTOs: `src/modules/incidents/dto/`
- Database Model: `prisma/schema.prisma` (Incident model)

## External Integrations
- **File Service**: Attachment handling
- **Invoices Service**: Incident-related billing
- **Prisma ORM**: Database operations

## Missing Information
- Complete API endpoint specifications
- DTO validation rules
- Example usage scenarios
- Detailed business logic implementation
