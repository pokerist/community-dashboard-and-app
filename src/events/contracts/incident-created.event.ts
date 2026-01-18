import { Priority } from '@prisma/client';

export class IncidentCreatedEvent {
  constructor(
    public readonly incidentId: string,
    public readonly incidentNumber: string,
    public readonly type: string,
    public readonly priority: Priority,
    public readonly unitId: string | null,
  ) {}
}
