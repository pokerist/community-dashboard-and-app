export class IncidentResolvedEvent {
  constructor(
    public readonly incidentId: string,
    public readonly incidentNumber: string,
    public readonly type: string,
    public readonly unitId: string | null,
    public readonly responseTime: number,
  ) {}
}
