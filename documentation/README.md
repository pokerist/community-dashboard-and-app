# Community Dashboard Backend Documentation

## Overview

This is a comprehensive NestJS-based backend system for a property management platform called "Community Dashboard". The system manages residential communities with features for residents, owners, tenants, property management, and community services.

## Architecture

The system follows a modular architecture with the following key components:

### Core Modules

1. **Authentication (auth)** - User authentication, authorization, and session management
2. **Residents** - Resident, owner, and tenant management
3. **Units** - Property unit management and assignments
4. **Bookings** - Facility booking and reservation system
5. **Complaints** - Complaint filing and resolution tracking
6. **Violations** - Violation tracking and fine management
7. **Facilities** - Community facility management
8. **Incidents** - Incident reporting and management
9. **Invoices** - Billing and payment management
10. **Service Requests** - Maintenance and service request handling
11. **Referrals** - Invitation-based user onboarding system
12. **Pending Registrations** - User registration approval workflow
13. **File Management** - File upload and storage handling

### Technology Stack

- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Validation**: class-validator and class-transformer
- **Documentation**: Swagger/OpenAPI
- **File Storage**: Supabase (configurable)

## Key Features

### 🔐 Security & Authentication
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Permission-based endpoint protection
- Password hashing with bcrypt
- Rate limiting and security measures

### 👥 User Management
- Multiple user types: Admin, Resident, Owner, Tenant
- Invitation-based onboarding system
- User status management (Active, Suspended, Disabled)
- Profile management with photo uploads

### 🏢 Property Management
- Multi-unit property support
- Unit assignment and management
- Lease management
- Owner-tenant relationships

### 📅 Booking System
- Facility booking and reservation
- Slot-based availability management
- Booking status tracking
- Automated conflict resolution

### 📋 Service Management
- Service request creation and tracking
- Dynamic service forms with custom fields
- Status tracking (New → In Progress → Resolved)
- Integration with billing system

### 💰 Financial Management
- Invoice generation and management
- Payment tracking and status updates
- Fee calculation and billing cycles
- Integration with violations and service requests

### 📱 Incident & Complaint Management
- Incident reporting system
- Complaint filing and resolution
- Priority-based handling
- Status tracking and notifications

## Database Schema

The system uses PostgreSQL with Prisma ORM. Key entities include:

- **User**: Base user entity with roles
- **Unit**: Property units with details
- **Lease**: Lease agreements between owners and tenants
- **Invoice**: Billing and payment records
- **ServiceRequest**: Maintenance and service requests
- **Booking**: Facility reservations
- **Complaint**: User complaints and resolutions
- **Violation**: Rule violations and fines
- **Referral**: Invitation-based onboarding system

## API Structure

All APIs follow RESTful conventions with consistent response formats:

### Response Format
```json
{
  "data": {},
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Error Format
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

## Security Considerations

- All endpoints require authentication except public ones
- Passwords are hashed with bcrypt (12 rounds)
- JWT tokens have 15-minute expiration with refresh tokens
- Rate limiting implemented on sensitive endpoints
- Input validation on all user inputs
- SQL injection prevention through Prisma ORM

## Getting Started

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Run database migrations: `npx prisma migrate dev`
4. Generate Prisma client: `npx prisma generate`
5. Start development server: `npm run start:dev`

## Development Guidelines

- Use TypeScript for type safety
- Follow NestJS module structure
- Implement proper error handling
- Write comprehensive tests
- Document all APIs with Swagger decorators
- Use DTOs for input validation
- Follow consistent naming conventions

## Module Documentation

Each module has detailed documentation in its respective directory:

### Core System Modules
- [Authentication](./auth/) - User auth, JWT tokens, RBAC permissions
- [Referrals](./referrals/) - Invitation-based user onboarding system
- [Residents](./residents/) - User management (Residents, Owners, Tenants, Admins)

### Property Management
- [Units](./units/) - Property unit management and resident assignments
- [Invoices](./invoices/) - Financial billing and payment tracking

### Community Services
- [Bookings](./bookings/) - Facility reservation system
- [Complaints](./complaints/) - Issue reporting and resolution
- [Violations](./violations/) - Rule violation tracking and fines
- [Facilities](./facilities/) - Community facility management
- [Incidents](./incidents/) - Incident reporting system
- [Service Requests](./service-request/) - Maintenance and service requests

### Supporting Modules
- [Pending Registrations](./pending-registrations/) - User registration approval workflow
- [File Management](./file/) - File upload and storage handling

### Additional Modules
- [Service](./service/) - Service catalog management
- [Service-Field](./service-field/) - Dynamic service form fields

## API Documentation

The system includes auto-generated Swagger documentation available at `/api` when running in development mode.

## Documentation Status

### ✅ Fully Documented Modules
- **Authentication** - Complete security, JWT, RBAC documentation
- **Referrals** - Comprehensive invitation system documentation
- **Residents** - Full user management system documentation
- **Units** - Detailed property unit management documentation
- **Invoices** - Complete financial billing system documentation

### 📝 Partially Documented Modules
- **Bookings** - Facility reservation system
- **Complaints** - Issue reporting and resolution
- **Violations** - Rule violation tracking and fines
- **Facilities** - Community facility management
- **Incidents** - Incident reporting system
- **Service Requests** - Maintenance and service requests
- **Pending Registrations** - User registration approval workflow
- **File Management** - File upload and storage handling
- **Service** - Service catalog management
- **Service-Field** - Dynamic service form fields

## Documentation Structure

Each module documentation includes:

1. **Overview** - Purpose and key features
2. **Architecture** - Database schema, components, relationships
3. **API Endpoints** - Complete endpoint documentation with examples
4. **Business Logic** - Core business rules and validation
5. **Security** - Access controls and data protection
6. **Integration** - Relationships with other modules
7. **Performance** - Optimization strategies and best practices
8. **Configuration** - Environment variables and setup
9. **Future Plans** - Planned enhancements and improvements

## Key System Features Documented

- **Referral-Based Onboarding** - Controlled user registration system
- **Role-Based Access Control** - Comprehensive permission system
- **Multi-Tenant Property Management** - Complex unit and resident relationships
- **Financial Management** - Invoice generation, payment tracking, fee calculation
- **Community Services** - Bookings, complaints, violations, service requests
- **File Management** - Secure file upload and storage
- **Audit Trail** - Complete system activity tracking

This documentation provides a comprehensive guide for developers to understand, maintain, and extend the Community Dashboard system.
