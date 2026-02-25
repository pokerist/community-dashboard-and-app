import {
  Priority,
  ServiceCategory,
  ServiceRequestStatus,
} from '@prisma/client';

export class ServiceRequestStatusChangedEvent {
  constructor(
    public readonly serviceRequestId: string,
    public readonly createdById: string,
    public readonly serviceId: string,
    public readonly serviceName: string,
    public readonly serviceCategory: ServiceCategory | null,
    public readonly unitId: string | null,
    public readonly oldStatus: ServiceRequestStatus,
    public readonly newStatus: ServiceRequestStatus,
    public readonly priority: Priority,
    public readonly updatedById: string,
  ) {}
}
