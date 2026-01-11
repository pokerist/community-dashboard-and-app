# Units Module

## Overview

The Units module manages property units within the Community Dashboard system. It handles the creation, management, and assignment of residential/commercial units, including their physical attributes, status tracking, and resident assignments. The module supports complex property hierarchies and relationships between units, residents, owners, and tenants.

## Key Features

- **Comprehensive Unit Management**: Create and manage property units with detailed specifications
- **Flexible Status Tracking**: Track unit availability, occupancy, and maintenance status
- **Resident Assignment**: Assign residents to units with role-based permissions
- **Lease Integration**: Connect units with lease agreements
- **Advanced Filtering**: Search and filter units by multiple criteria
- **Property Hierarchy**: Support for projects, blocks, and unit numbering

## Architecture

### Database Schema

```sql
model Unit {
  id              String           @id @default(uuid())
  projectName     String           // Property project name
  block           String?          // Building block/section
  unitNumber      String           // Unique unit identifier
  type            UnitType         // VILLA | APARTMENT | PENTHOUSE | DUPLEX | TOWNHOUSE
  floors          Int?             // Number of floors
  bedrooms        Int?             // Number of bedrooms
  bathrooms       Int?             // Number of bathrooms
  sizeSqm         Float?           // Unit size in square meters
  price           Decimal?         // Property price
  status          UnitStatus       // Availability status
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  -- Relations
  residents       ResidentUnit[]   // Assigned residents
  leases          Lease[]          // Associated leases
  invoices        Invoice[]        // Billing records
  bookings        Booking[]        // Facility bookings
  smartDevices    SmartDevice[]    // IoT devices
  accessQRCodes   AccessQRCode[]   // Access codes
  complaints      Complaint[]      // Reported issues
  violations      Violation[]      // Rule violations
  incidents       Incident[]       // Incident reports
  unitFees        UnitFee[]        // Recurring fees
}
```

### Unit Status Flow

```
AVAILABLE ─────────► OCCUPIED ─────────► LEASED
     │                       │
     ├───────────────────────┼────────────────────► UNDER_MAINTENANCE
     │                       │
     └───────────────────────┼────────────────────► UNDER_CONSTRUCTION
```

### Unit Types

- **VILLA**: Standalone residential unit
- **APARTMENT**: Multi-unit building residence
- **PENTHOUSE**: Top-floor luxury unit
- **DUPLEX**: Two-story unit
- **TOWNHOUSE**: Attached residential unit

## API Endpoints

### Unit CRUD Operations

#### GET /units
List units with advanced filtering and pagination.

**Authentication:** Required
**Permissions:** `unit.view_all`

**Query Parameters:**
```json
{
  "type": "APARTMENT",
  "status": "AVAILABLE",
  "projectName": "Alkarma Gardens",
  "block": "A",
  "minBedrooms": 2,
  "maxBedrooms": 4,
  "minPrice": 100000,
  "maxPrice": 500000,
  "page": 1,
  "limit": 20,
  "sortBy": "createdAt",
  "sortOrder": "desc"
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "unit-uuid",
      "projectName": "Alkarma Gardens",
      "block": "A",
      "unitNumber": "101",
      "type": "APARTMENT",
      "bedrooms": 3,
      "bathrooms": 2,
      "sizeSqm": 120.5,
      "price": 250000,
      "status": "AVAILABLE",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### GET /units/:id
Get detailed unit information with all relations.

#### POST /units
Create a new property unit.

**Permissions:** `unit.create`

**Request Body:**
```json
{
  "projectName": "Alkarma Gardens",
  "block": "A",
  "unitNumber": "101",
  "type": "APARTMENT",
  "floors": 1,
  "bedrooms": 3,
  "bathrooms": 2,
  "sizeSqm": 120.5,
  "price": 250000,
  "status": "AVAILABLE"
}
```

#### PATCH /units/:id
Update unit information.

**Permissions:** `unit.update`

#### DELETE /units/:id
Remove a unit from the system.

**Permissions:** `unit.delete`

#### GET /units/number/:unitNumber
Find unit by unit number within a project.

### Resident Assignment

#### POST /units/:id/assign-user
Assign a resident to a unit.

**Permissions:** `unit.assign_resident`

**Request Body:**
```json
{
  "userId": "user-uuid",
  "role": "OWNER" // "OWNER" | "TENANT" | "FAMILY"
}
```

**Response:**
```json
{
  "id": "assignment-uuid",
  "residentId": "user-uuid",
  "unitId": "unit-uuid",
  "assignedAt": "2024-01-01T00:00:00Z",
  "isPrimary": true,
  "finishingStatus": "NOT_STARTED"
}
```

#### DELETE /units/:id/assigned-users/:userId
Remove resident assignment from unit.

**Permissions:** `unit.remove_resident_from_unit`

#### GET /units/:id/residents
List all residents assigned to a unit.

**Permissions:** `unit.view_assigned_residents`

### Status Management

#### PATCH /units/:id/status
Update unit availability status.

**Permissions:** `unit.update_status`

**Request Body:**
```json
{
  "status": "OCCUPIED" // AVAILABLE | OCCUPIED | LEASED | UNDER_MAINTENANCE | UNDER_CONSTRUCTION
}
```

### Lease Information

#### GET /units/:id/leases
Get all lease agreements associated with the unit.

**Permissions:** `unit.view_leases`

## Business Logic

### Unit Creation Validation

```typescript
async create(createUnitDto: CreateUnitDto) {
  // Validate unit number uniqueness within project/block
  const existing = await prisma.unit.findFirst({
    where: {
      projectName: createUnitDto.projectName,
      block: createUnitDto.block,
      unitNumber: createUnitDto.unitNumber
    }
  });

  if (existing) {
    throw new ConflictException('Unit number already exists in this project/block');
  }

  // Validate property constraints
  if (createUnitDto.type === 'VILLA' && createUnitDto.floors !== 1) {
    throw new BadRequestException('Villas must have exactly 1 floor');
  }

  return prisma.unit.create({ data: createUnitDto });
}
```

### Resident Assignment Rules

1. **Primary Assignment**: Only one primary resident per unit
2. **Role Validation**: OWNER, TENANT, or FAMILY roles
3. **Status Checks**: Unit must be available for new assignments
4. **Duplicate Prevention**: Same user cannot be assigned multiple roles

### Status Transition Logic

```typescript
// Valid status transitions
const validTransitions = {
  'AVAILABLE': ['OCCUPIED', 'LEASED', 'UNDER_MAINTENANCE'],
  'OCCUPIED': ['AVAILABLE', 'LEASED', 'UNDER_MAINTENANCE'],
  'LEASED': ['AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE'],
  'UNDER_MAINTENANCE': ['AVAILABLE', 'OCCUPIED', 'LEASED'],
  'UNDER_CONSTRUCTION': ['AVAILABLE']
};
```

## Advanced Filtering

### Complex Query Building

```typescript
async findAll(query: UnitQueryDto) {
  const where: Record<string, any> = {};

  // Basic filters
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.projectName) where.projectName = { contains: query.projectName, mode: 'insensitive' };

  // Range filters
  if (query.minBedrooms || query.maxBedrooms) {
    where.bedrooms = {};
    if (query.minBedrooms) where.bedrooms.gte = query.minBedrooms;
    if (query.maxBedrooms) where.bedrooms.lte = query.maxBedrooms;
  }

  if (query.minPrice || query.maxPrice) {
    where.price = {};
    if (query.minPrice) where.price.gte = query.minPrice;
    if (query.maxPrice) where.price.lte = query.maxPrice;
  }

  // Size range
  if (query.minSize || query.maxSize) {
    where.sizeSqm = {};
    if (query.minSize) where.sizeSqm.gte = query.minSize;
    if (query.maxSize) where.sizeSqm.lte = query.maxSize;
  }

  return paginate(prisma.unit, query, {
    additionalFilters: where,
    include: { residents: { include: { resident: true } } }
  });
}
```

## Data Relationships

### Unit-Centric Relations

```typescript
// Complete unit with all relations
const unitWithRelations = await prisma.unit.findUnique({
  where: { id },
  include: {
    residents: {
      include: { resident: true },
      where: { isPrimary: true }
    },
    leases: {
      include: {
        owner: true,
        tenant: true
      }
    },
    invoices: {
      where: { status: 'PENDING' },
      include: { resident: true }
    },
    complaints: {
      where: { status: 'NEW' },
      include: { reporter: true }
    },
    violations: {
      include: { issuedBy: true, resident: true }
    }
  }
});
```

### Resident Unit Assignments

```sql
model ResidentUnit {
  id              String          @id @default(uuid())
  resident        User            @relation(fields: [residentId], references: [id])
  residentId      String
  unit            Unit            @relation(fields: [unitId], references: [id])
  unitId          String
  assignedAt      DateTime        @default(now())
  isPrimary       Boolean         @default(false)
  finishingStatus FinishingStatus @default(NOT_STARTED)

  @@unique([residentId, unitId])
}
```

## Performance Optimization

### Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_unit_project_block_number ON Unit(projectName, block, unitNumber);
CREATE INDEX idx_unit_status ON Unit(status);
CREATE INDEX idx_unit_type ON Unit(type);
CREATE INDEX idx_unit_price ON Unit(price);
CREATE INDEX idx_unit_bedrooms ON Unit(bedrooms);
CREATE INDEX idx_resident_unit_unit_id ON ResidentUnit(unitId);
CREATE INDEX idx_resident_unit_resident_id ON ResidentUnit(residentId);
```

### Query Optimization

- **Selective Includes**: Load only required relations
- **Cursor Pagination**: Use cursor-based pagination for large datasets
- **Query Batching**: Combine related queries where possible
- **Result Caching**: Cache frequently accessed unit data

## Security Considerations

### Access Control
- **Permission-Based**: All operations require specific permissions
- **Owner Restrictions**: Residents can only view their assigned units
- **Admin Override**: Administrators have full access

### Data Validation
- **Input Sanitization**: All user inputs validated and sanitized
- **Business Rules**: Enforce property management constraints
- **Audit Trail**: Track all unit and assignment changes

## Error Handling

### Common Error Scenarios

```typescript
// Unit number conflict
throw new ConflictException('Unit number already exists in this project/block');

// Invalid status transition
throw new BadRequestException('Invalid status transition');

// Resident already assigned
throw new ConflictException('Resident is already assigned to this unit');

// Permission denied
throw new ForbiddenException('Insufficient permissions');
```

## Integration Points

### With Other Modules

#### Leases Module
- Units connect to lease agreements
- Status updates based on lease status
- Automatic billing generation

#### Residents Module
- Unit assignments managed through resident profiles
- Owner/tenant relationships tracked
- Access permissions based on unit assignment

#### Invoices Module
- Unit-based billing and fee calculation
- Resident-specific charges
- Payment tracking per unit

#### Bookings Module
- Facility bookings tied to resident units
- Unit-based access control
- Billing integration

#### Complaints & Violations
- Issue tracking per unit
- Resident assignment context
- Resolution workflow

## Monitoring & Analytics

### Key Metrics
- Unit occupancy rates by project/block
- Average time to lease/sell
- Maintenance request frequency
- Resident satisfaction scores

### Reporting
- Unit availability reports
- Occupancy trends
- Revenue by unit type
- Maintenance costs

## Configuration

### Environment Variables
```env
DEFAULT_UNIT_STATUS=AVAILABLE
MAX_UNITS_PER_PAGE=50
UNIT_CACHE_TTL=600
```

### Permission Setup
```sql
INSERT INTO Permission (key) VALUES
  ('unit.view_all'),
  ('unit.view_own'),
  ('unit.create'),
  ('unit.update'),
  ('unit.delete'),
  ('unit.assign_resident'),
  ('unit.remove_resident_from_unit'),
  ('unit.view_assigned_residents'),
  ('unit.update_status'),
  ('unit.view_leases');
```

## Best Practices

### Unit Management
1. **Consistent Numbering**: Use standardized unit numbering schemes
2. **Status Accuracy**: Keep unit status updated in real-time
3. **Assignment Tracking**: Maintain accurate resident assignments
4. **Documentation**: Keep detailed unit specifications

### Data Integrity
1. **Validation Rules**: Enforce business rules at database level
2. **Audit Trail**: Track all changes to unit data
3. **Backup Strategy**: Regular backups of critical unit data
4. **Data Consistency**: Ensure referential integrity

### Performance
1. **Indexing Strategy**: Optimize database queries
2. **Caching Layer**: Cache frequently accessed unit data
3. **Pagination**: Always use pagination for large result sets
4. **Lazy Loading**: Load relations on-demand

## Future Enhancements

### Planned Features
- **Unit Photos**: Image gallery for each unit
- **Virtual Tours**: 3D walkthroughs and floor plans
- **Unit Comparison**: Side-by-side unit comparison
- **Market Analytics**: Pricing trends and market data
- **Maintenance Scheduling**: Automated maintenance tracking
- **Energy Monitoring**: Smart device integration
- **Unit Transfers**: Change of ownership tracking

### Technical Improvements
- **Geospatial Data**: Location-based unit search
- **Advanced Search**: Full-text search across unit fields
- **Real-time Updates**: WebSocket notifications for status changes
- **API Versioning**: Support multiple API versions
- **Bulk Operations**: Import/export unit data

This units module provides a comprehensive foundation for property unit management, supporting complex residential communities with multiple stakeholders and extensive feature requirements.
