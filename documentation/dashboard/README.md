# Dashboard Module

## Overview

The Dashboard module provides comprehensive real-time analytics and metrics for property management administrators and managers. It aggregates data across all system modules to provide actionable insights through summary cards, charts, and filtered lists.

## Purpose

The dashboard serves as the central command center for property managers, offering:
- Real-time KPI monitoring
- Trend analysis and reporting
- Operational insights for decision making
- Performance metrics across all property operations

## Architecture

### Components
- **DashboardController**: REST API endpoints for dashboard data
- **DashboardService**: Business logic for data aggregation and processing
- **DTOs**: Input validation and response structures for all endpoints

### Dependencies
- **PrismaService**: Database access for all data aggregations
- **PaginationUtil**: Reusable pagination and filtering logic
- **DayJS**: Date manipulation for time-based aggregations

## Key Features

### Summary Cards (KPI Metrics)
- **Active Incidents**: Count of incidents with OPEN status
- **Resolved Today**: Incidents resolved within the current day
- **Average Response Time**: Mean response time for resolved incidents (in seconds)
- **Open Complaints**: Complaints not in RESOLVED or CLOSED status
- **Pending Registrations**: Registration requests awaiting approval
- **Occupancy Rate**: Percentage of occupied units across all properties
- **Revenue This Month**: Total paid invoice amounts for current month
- **Revenue This Year**: Total paid invoice amounts for current year
- **Smart Devices Status**: Counts of online/offline/error devices
- **CCTV Cameras Status**: Camera-specific status breakdown

### Paginated Lists
- **Incidents List**: Recent incidents with advanced filtering
- **Complaints List**: Recent complaints with advanced filtering

### Chart Data
- **Revenue Trends**: Monthly revenue aggregation over time
- **Occupancy Distribution**: Unit occupancy by project/block
- **Device Status Breakdown**: Device health by type and status

## API Endpoints

### GET /dashboard/summary
Returns all KPI summary cards data.

**Response:**
```json
{
  "activeIncidents": 5,
  "resolvedToday": 3,
  "avgResponseTime": 1800,
  "openComplaints": 12,
  "pendingRegistrations": 8,
  "occupancyRate": 85,
  "revenueThisMonth": 150000.50,
  "revenueThisYear": 1800000.75,
  "smartDevices": {
    "online": 45,
    "offline": 3,
    "error": 2
  },
  "cctvCameras": {
    "online": 12,
    "offline": 1,
    "error": 0
  }
}
```

### GET /dashboard/incidents
Paginated list of incidents with filtering capabilities.

**Query Parameters:**
- `projectName`: Filter by project name
- `block`: Filter by block name
- `unitId`: Filter by specific unit
- `status`: IncidentStatus enum (OPEN, RESOLVED, CLOSED)
- `priority`: Priority enum (LOW, MEDIUM, HIGH, CRITICAL)
- `dateFrom`: Start date filter (YYYY-MM-DD)
- `dateTo`: End date filter (YYYY-MM-DD)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `search`: Text search across incident fields

**Response:**
```json
{
  "data": [
    {
      "id": "incident-123",
      "incidentNumber": "INC-0001",
      "type": "Security",
      "location": "Building A",
      "residentName": "John Doe",
      "description": "Unauthorized access attempt",
      "priority": "HIGH",
      "status": "OPEN",
      "reportedAt": "2024-01-15T10:30:00Z",
      "unit": {
        "unitNumber": "A-101",
        "projectName": "Alkarma Gates",
        "block": "Block A"
      }
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "totalPages": 3
  }
}
```

### GET /dashboard/complaints
Paginated list of complaints with filtering capabilities.

**Query Parameters:** (Similar to incidents)
- `projectName`: Filter by project name
- `block`: Filter by block name
- `unitId`: Filter by specific unit
- `status`: ComplaintStatus enum (NEW, IN_PROGRESS, RESOLVED, CLOSED)
- `priority`: Priority enum (LOW, MEDIUM, HIGH, CRITICAL)
- `dateFrom`: Start date filter (YYYY-MM-DD)
- `dateTo`: End date filter (YYYY-MM-DD)

### GET /dashboard/revenue
Revenue chart data with time-based aggregation.

**Query Parameters:**
- `projectName`: Filter by project name
- `block`: Filter by block name
- `unitId`: Filter by specific unit
- `dateFrom`: Start date for revenue period
- `dateTo`: End date for revenue period

**Response:**
```json
{
  "chartData": [
    { "month": "2024-01", "total": 125000.00 },
    { "month": "2024-02", "total": 118000.00 }
  ],
  "currentMonth": 125000.00,
  "currentYear": 1500000.00
}
```

### GET /dashboard/occupancy
Unit occupancy distribution and statistics.

**Query Parameters:**
- `projectName`: Filter by project name
- `block`: Filter by block name

**Response:**
```json
{
  "overall": {
    "totalUnits": 200,
    "occupiedUnits": 170,
    "occupancyRate": 85
  },
  "byLocation": [
    {
      "projectName": "Alkarma Gates",
      "block": "Block A",
      "totalUnits": 50,
      "occupiedUnits": 45,
      "occupancyRate": 90
    }
  ]
}
```

### GET /dashboard/devices
Smart device status breakdown by type.

**Query Parameters:**
- `projectName`: Filter by project name
- `block`: Filter by block name
- `unitId`: Filter by specific unit
- `type`: DeviceType enum filter

**Response:**
```json
{
  "stats": {
    "THERMOSTAT": { "online": 15, "offline": 2, "error": 1 },
    "CAMERA": { "online": 12, "offline": 1, "error": 0 },
    "SMART_LOCK": { "online": 18, "offline": 0, "error": 0 }
  },
  "total": 49
}
```

## Business Logic

### Data Aggregation Rules
- **Revenue Calculations**: Only includes invoices with PAID status
- **Occupancy Rate**: (occupied units / total units) × 100
- **Response Time**: Average of resolved incident response times in seconds
- **Device Status**: Real-time status from SmartDevice table

### Filtering Logic
- **Project/Block Filtering**: Applied through unit relationships
- **Date Ranges**: Converted to proper date objects for database queries
- **Status Filters**: Enum-based validation for data integrity

### Performance Optimizations
- **Batch Queries**: Multiple aggregations run in parallel
- **Selective Fields**: Only required fields selected from database
- **Efficient Grouping**: Uses Prisma groupBy for status aggregations
- **Pagination**: Limits database load with configurable page sizes

## Security

### Access Control
- All endpoints require `dashboard.view` permission
- Integrated with role-based access control (RBAC) system
- Admin and property manager roles have access

### Data Protection
- No sensitive user data exposed in aggregations
- Aggregated data only (no individual record details)
- Rate limiting applies to prevent abuse

## Relations to Other Modules

### Data Sources
- **Incidents Module**: Incident counts, response times, status tracking
- **Complaints Module**: Complaint status and counts
- **Invoices Module**: Revenue aggregations and payment tracking
- **Units Module**: Occupancy calculations and unit relationships
- **Pending Registrations**: Registration approval workflow counts
- **Smart Devices**: Device status monitoring (integrated with units)

### Integration Points
- **Notifications**: Could trigger alerts based on KPI thresholds
- **Auth**: Permission checking for dashboard access
- **Events**: Real-time updates for live dashboard data

## Performance Considerations

### Caching Strategy (Future Enhancement)
- Summary data suitable for 5-10 minute caching
- Chart data can be cached for 1-5 minutes
- Cache invalidation on data changes via events

### Query Optimization
- Uses Prisma aggregations to minimize database load
- Parallel query execution for multiple metrics
- Indexed fields utilized for filtering operations

## Configuration

### Environment Variables
No specific environment variables required - uses existing database connection.

### Database Indexes
Relies on existing indexes for:
- Incident status and dates
- Complaint status and dates
- Invoice payment dates and status
- Unit occupancy status
- Device status fields

## Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live dashboard
- **Custom Dashboards**: User-configurable KPI layouts
- **Export Functionality**: PDF/Excel export for reports
- **Alert System**: Threshold-based notifications for KPIs
- **Historical Trends**: Year-over-year and month-over-month comparisons
- **Geographic Visualization**: Map-based occupancy and incident distribution

### Performance Improvements
- Redis caching implementation
- Database query result caching
- Background job processing for heavy aggregations
- CDN integration for static chart data

## Error Handling

### Common Error Scenarios
- **Database Connection Issues**: Graceful degradation with cached data
- **Invalid Filters**: Proper validation with clear error messages
- **Permission Denied**: 403 Forbidden responses
- **Rate Limiting**: 429 Too Many Requests responses

### Monitoring
- Query performance tracking
- Error rate monitoring
- Cache hit/miss ratios
- Response time metrics

## Testing

### Unit Tests
- Service method testing with mocked Prisma client
- DTO validation testing
- Business logic calculation verification

### Integration Tests
- End-to-end API testing
- Database integration verification
- Authentication and authorization testing

## Usage Examples

### Frontend Integration
```javascript
// Fetch dashboard summary
const summary = await fetch('/api/dashboard/summary', {
  headers: { Authorization: `Bearer ${token}` }
});

// Get incidents with filters
const incidents = await fetch('/api/dashboard/incidents?page=1&limit=20&status=OPEN', {
  headers: { Authorization: `Bearer ${token}` }
});

// Revenue chart data
const revenue = await fetch('/api/dashboard/revenue?dateFrom=2024-01-01', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Chart.js Integration
```javascript
// Revenue chart
const ctx = document.getElementById('revenueChart').getContext('2d');
new Chart(ctx, {
  type: 'line',
  data: {
    labels: revenueData.chartData.map(d => d.month),
    datasets: [{
      label: 'Revenue',
      data: revenueData.chartData.map(d => d.total)
    }]
  }
});
```

This dashboard module provides property managers with comprehensive insights into their community's operations, enabling data-driven decision making and proactive management.
