import { Priority, ServiceCategory, ServiceRequestStatus } from '@prisma/client';

export class ServiceRequestCreatedEvent {
  constructor(
    public readonly serviceRequestId: string,
    public readonly createdById: string,
    public readonly serviceId: string,
    public readonly serviceName: string,
    public readonly serviceCategory: ServiceCategory | null,
    public readonly unitId: string | null,
    public readonly status: ServiceRequestStatus,
    public readonly priority: Priority,
  ) {}
}
