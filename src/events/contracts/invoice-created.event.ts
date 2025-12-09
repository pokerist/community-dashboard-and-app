import { InvoiceStatus, InvoiceType } from '@prisma/client';

export class InvoiceCreatedEvent {
  constructor(
    public readonly invoiceId: string,
    public readonly unitId: string,
    public readonly residentId: string | null,
    public readonly amount: number,
    public readonly dueDate: Date,
    public readonly type: InvoiceType, // Use the actual type from your enum if defined
  ) {}
}
