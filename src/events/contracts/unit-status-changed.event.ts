export class UnitStatusChangedEvent {
  constructor(
    public readonly unitId: string,
    public readonly unitNumber: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly projectName: string,
  ) {}
}
