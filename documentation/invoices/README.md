# Invoices Module

## Overview

The Invoices module handles all financial transactions and billing within the Community Dashboard system. It manages invoice generation, payment tracking, fee calculations, and financial reporting for property management operations including rent, service charges, fines, and other charges.

## Key Features

- **Multi-Type Invoicing**: Support for various invoice types (rent, services, fines, etc.)
- **Automated Fee Calculation**: Dynamic fee calculation based on unit assignments
- **Payment Tracking**: Complete payment lifecycle management
- **Due Date Management**: Automated overdue tracking and notifications
- **Source Linking**: Connect invoices to their originating events (violations, service requests)
- **Bulk Operations**: Batch invoice generation and processing

## Architecture

### Database Schema

```sql
model Invoice {
  id            String        @id @default(uuid())
  invoiceNumber String        @unique  // Auto-generated sequential number
  unit          Unit          @relation(fields: [unitId], references: [id])
  unitId        String
  resident      User?         @relation("user_invoices", fields: [residentId], references: [id])
  residentId    String?
  type          InvoiceType   // RENT | SERVICE_FEE | UTILITY | FINE | etc.
  amount        Decimal       @db.Decimal(12, 2)  // Invoice amount
  dueDate       DateTime      // Payment due date
  status        InvoiceStatus // PAID | PENDING | OVERDUE | CANCELLED
  paidDate      DateTime?     // Date payment received
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  -- Source tracking
  violationId String?
  violation   Violation? @relation(fields: [violationId], references: [id])

  serviceRequestId String?
  serviceRequest   ServiceRequest? @relation(fields: [serviceRequestId], references: [id])

  complaintId String?
  complaint   Complaint? @relation(fields: [complaintId], references: [id])

  bookingId String?
  booking   Booking? @relation(fields: [bookingId], references: [id])

  incidentId String?
  incident   Incident? @relation(fields: [incidentId], references: [id])

  -- Relations
  documents     Attachment[] @relation("InvoiceDocuments")
  unitFees      UnitFee[]    @relation("FeeInvoices")
}
```

### Invoice Types

```typescript
enum InvoiceType {
  // Recurring Tenant Charges
  RENT = 'RENT',                    // Monthly/periodic rent
  SERVICE_FEE = 'SERVICE_FEE',      // General service/maintenance fees
  UTILITY = 'UTILITY',             // Electricity, water, AC, etc.

  // One-time Tenant Charges
  FINE = 'FINE',                   // Violation-generated fines
  MAINTENANCE_FEE = 'MAINTENANCE_FEE', // Service request charges
  BOOKING_FEE = 'BOOKING_FEE',     // Facility booking fees
  SETUP_FEE = 'SETUP_FEE',         // Lease initiation fees
  LATE_FEE = 'LATE_FEE',           // Late payment penalties
  MISCELLANEOUS = 'MISCELLANEOUS', // Other charges

  // Owner Charges
  OWNER_EXPENSE = 'OWNER_EXPENSE', // Property expenses billed to owner
  MANAGEMENT_FEE = 'MANAGEMENT_FEE', // Property management fees

  // Adjustments
  CREDIT_MEMO = 'CREDIT_MEMO',     // Refunds/credits
  DEBIT_MEMO = 'DEBIT_MEMO'        // Additional charges
}
```

### Invoice Status Flow

```
PENDING ───────► PAID
    │
    └────────────► OVERDUE
         │
         └────────► CANCELLED
```

## API Endpoints

### Invoice Management

#### GET /invoices
List invoices with comprehensive filtering.

**Authentication:** Required
**Permissions:** `invoice.view_all` or `invoice.view_own`

**Query Parameters:**
```json
{
  "status": "PENDING",
  "type": "RENT",
  "unitId": "unit-uuid",
  "residentId": "user-uuid",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31",
  "minAmount": 100,
  "maxAmount": 5000,
  "overdueOnly": false,
  "page": 1,
  "limit": 20
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "invoice-uuid",
      "invoiceNumber": "INV-2024-001",
      "unitId": "unit-uuid",
      "residentId": "user-uuid",
      "type": "RENT",
      "amount": 2500.00,
      "dueDate": "2024-02-01T00:00:00Z",
      "status": "PENDING",
      "paidDate": null,
      "createdAt": "2024-01-01T00:00:00Z",
      "unit": {
        "projectName": "Alkarma Gardens",
        "unitNumber": "101"
      },
      "resident": {
        "nameEN": "John Doe"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "totalAmount": 375000.00,
    "paidAmount": 125000.00,
    "pendingAmount": 250000.00
  }
}
```

#### GET /invoices/:id
Get detailed invoice information.

#### POST /invoices
Create a new invoice.

**Permissions:** `invoice.create`

**Request Body:**
```json
{
  "unitId": "unit-uuid",
  "residentId": "user-uuid",
  "type": "RENT",
  "amount": 2500.00,
  "dueDate": "2024-02-01",
  "description": "January 2024 Rent"
}
```

#### PATCH /invoices/:id
Update invoice details.

**Permissions:** `invoice.update`

#### DELETE /invoices/:id
Cancel an invoice.

**Permissions:** `invoice.delete`

#### PATCH /invoices/:id/payment
Mark invoice as paid.

**Permissions:** `invoice.update_payment`

**Request Body:**
```json
{
  "paidDate": "2024-01-15T10:30:00Z",
  "paymentMethod": "BANK_TRANSFER",
  "reference": "TXN-12345"
}
```

### Bulk Operations

#### POST /invoices/bulk-generate
Generate invoices for multiple units/residents.

**Permissions:** `invoice.create`

**Request Body:**
```json
{
  "type": "SERVICE_FEE",
  "amount": 150.00,
  "dueDate": "2024-02-01",
  "unitIds": ["unit-1", "unit-2", "unit-3"],
  "description": "Monthly Service Fee"
}
```

#### POST /invoices/bulk-update-status
Update status for multiple invoices.

**Permissions:** `invoice.update`

### Reporting & Analytics

#### GET /invoices/summary
Get invoice summary statistics.

**Response:**
```json
{
  "totalInvoices": 1250,
  "totalAmount": 2500000.00,
  "paidAmount": 1800000.00,
  "pendingAmount": 500000.00,
  "overdueAmount": 200000.00,
  "byType": {
    "RENT": { "count": 800, "amount": 2000000.00 },
    "SERVICE_FEE": { "count": 300, "amount": 375000.00 },
    "FINE": { "count": 150, "amount": 125000.00 }
  },
  "byStatus": {
    "PAID": { "count": 950, "amount": 1800000.00 },
    "PENDING": { "count": 250, "amount": 500000.00 },
    "OVERDUE": { "count": 50, "amount": 200000.00 }
  }
}
```

#### GET /invoices/unit/:unitId
Get all invoices for a specific unit.

#### GET /invoices/resident/:residentId
Get all invoices for a specific resident.

## Business Logic

### Invoice Number Generation

```typescript
async generateInvoiceNumber(): Promise<string> {
  const sequence = await prisma.invoiceSequence.upsert({
    where: { name: 'invoice_number' },
    update: { counter: { increment: 1 } },
    create: { name: 'invoice_number', counter: 1 }
  });

  const year = new Date().getFullYear();
  return `INV-${year}-${sequence.counter.toString().padStart(6, '0')}`;
}
```

### Automatic Status Updates

```typescript
async updateOverdueInvoices() {
  const overdueInvoices = await prisma.invoice.updateMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: new Date() }
    },
    data: { status: 'OVERDUE' }
  });

  // Trigger notifications for overdue invoices
  await this.notificationService.sendOverdueNotifications(overdueInvoices);
}
```

### Fee Calculation Logic

```typescript
async calculateUnitFees(unitId: string, feeType: string) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { unitFees: true }
  });

  const applicableFees = unit.unitFees.filter(fee =>
    fee.type === feeType &&
    fee.billingMonth <= new Date()
  );

  return applicableFees.reduce((total, fee) => total + fee.amount, 0);
}
```

## Source Tracking

### Invoice Sources

Invoices can be linked to various business events:

```typescript
// Violation-generated fine
const violationInvoice = await prisma.invoice.create({
  data: {
    unitId: violation.unitId,
    residentId: violation.residentId,
    type: 'FINE',
    amount: violation.fineAmount,
    violationId: violation.id,
    dueDate: calculateDueDate(),
    description: `Fine for violation: ${violation.type}`
  }
});

// Service request charge
const serviceInvoice = await prisma.invoice.create({
  data: {
    unitId: serviceRequest.unitId,
    residentId: serviceRequest.createdById,
    type: 'MAINTENANCE_FEE',
    amount: calculateServiceCost(serviceRequest),
    serviceRequestId: serviceRequest.id,
    dueDate: calculateDueDate(),
    description: `Service: ${serviceRequest.description}`
  }
});
```

## Payment Processing

### Payment Status Updates

```typescript
async processPayment(invoiceId: string, paymentData: PaymentData) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  });

  if (!invoice) {
    throw new NotFoundException('Invoice not found');
  }

  // Update invoice status
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paidDate: paymentData.paidDate || new Date()
    }
  });

  // Create payment record (if using payment module)
  await this.createPaymentRecord(invoice, paymentData);

  // Trigger post-payment actions
  await this.handlePostPayment(invoice);
}
```

### Overdue Management

```typescript
async handleOverdueInvoices() {
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: 'OVERDUE',
      dueDate: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30+ days overdue
    },
    include: { resident: true, unit: true }
  });

  for (const invoice of overdueInvoices) {
    // Send reminder notifications
    await this.notificationService.sendOverdueReminder(invoice);

    // Apply late fees if applicable
    if (shouldApplyLateFee(invoice)) {
      await this.createLateFeeInvoice(invoice);
    }
  }
}
```

## Integration Points

### With Other Modules

#### Units Module
- Unit-based fee calculation
- Resident assignment tracking
- Property-specific charges

#### Residents Module
- User-specific billing
- Payment history tracking
- Account balance management

#### Violations Module
- Automatic fine generation
- Violation-to-invoice linking
- Payment status synchronization

#### Service Requests Module
- Service charge calculation
- Work order billing
- Completion-based invoicing

#### Bookings Module
- Facility usage fees
- Reservation charges
- Cancellation fee handling

## Performance Optimization

### Database Optimization

```sql
-- Performance indexes
CREATE INDEX idx_invoice_unit_id ON Invoice(unitId);
CREATE INDEX idx_invoice_resident_id ON Invoice(residentId);
CREATE INDEX idx_invoice_status ON Invoice(status);
CREATE INDEX idx_invoice_due_date ON Invoice(dueDate);
CREATE INDEX idx_invoice_type ON Invoice(type);
CREATE INDEX idx_invoice_created_at ON Invoice(createdAt);

-- Composite indexes for common queries
CREATE INDEX idx_invoice_unit_status ON Invoice(unitId, status);
CREATE INDEX idx_invoice_resident_status ON Invoice(residentId, status);
CREATE INDEX idx_invoice_type_due_date ON Invoice(type, dueDate);
```

### Query Optimization

- **Batch Processing**: Handle bulk operations efficiently
- **Pagination**: Use cursor-based pagination for large datasets
- **Selective Loading**: Load only required relations
- **Result Caching**: Cache frequently accessed invoice data

## Security Considerations

### Access Control
- **Permission-Based**: Granular permissions for invoice operations
- **Owner Restrictions**: Residents can only view their own invoices
- **Audit Trail**: Complete tracking of all invoice changes

### Data Protection
- **Financial Data**: Secure handling of payment information
- **PII Protection**: Protect resident financial data
- **Compliance**: GDPR and financial regulation compliance

## Error Handling

### Common Error Scenarios

```typescript
// Invoice not found
throw new NotFoundException('Invoice not found');

// Invalid amount
throw new BadRequestException('Invoice amount must be positive');

// Already paid
throw new ConflictException('Invoice has already been paid');

// Insufficient permissions
throw new ForbiddenException('Cannot modify paid invoice');
```

## Monitoring & Analytics

### Key Metrics
- Total outstanding amount
- Average payment time
- Overdue invoice percentage
- Collection rate by invoice type
- Revenue trends

### Financial Reporting
- Monthly revenue reports
- Unit profitability analysis
- Resident payment history
- Cash flow projections

## Configuration

### Environment Variables
```env
INVOICE_NUMBER_PREFIX=INV
LATE_FEE_AMOUNT=50.00
LATE_FEE_GRACE_PERIOD_DAYS=30
OVERDUE_REMINDER_DAYS=7
AUTO_CANCEL_OVERDUE_DAYS=90
```

### Permission Setup
```sql
INSERT INTO Permission (key) VALUES
  ('invoice.view_all'),
  ('invoice.view_own'),
  ('invoice.create'),
  ('invoice.update'),
  ('invoice.delete'),
  ('invoice.update_payment'),
  ('invoice.generate_bulk');
```

## Best Practices

### Invoice Management
1. **Clear Descriptions**: Always include detailed invoice descriptions
2. **Due Date Setting**: Set realistic payment due dates
3. **Status Accuracy**: Keep invoice status updated in real-time
4. **Source Linking**: Always link invoices to their originating events

### Financial Controls
1. **Amount Validation**: Validate all financial amounts
2. **Audit Trail**: Maintain complete financial transaction history
3. **Payment Verification**: Verify payments before marking as paid
4. **Dispute Handling**: Provide clear dispute resolution processes

### Performance
1. **Batch Processing**: Use bulk operations for efficiency
2. **Indexing**: Ensure proper database indexing
3. **Caching**: Cache frequently accessed financial data
4. **Monitoring**: Monitor payment processing performance

## Future Enhancements

### Planned Features
- **Payment Gateway Integration**: Direct payment processing
- **Recurring Billing**: Automatic subscription billing
- **Invoice Templates**: Customizable invoice formats
- **Multi-Currency Support**: International payment handling
- **Payment Plans**: Installment payment options
- **Financial Analytics**: Advanced reporting and forecasting
- **Mobile Payments**: QR code and mobile wallet integration

### Technical Improvements
- **Real-time Updates**: WebSocket notifications for payment status
- **API Versioning**: Support multiple API versions
- **Event Sourcing**: Complete financial transaction audit trail
- **Microservices**: Separate billing service architecture

This invoices module provides a comprehensive financial management system, supporting complex billing scenarios while maintaining data integrity and providing excellent audit capabilities for property management operations.
