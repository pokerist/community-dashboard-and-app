export class ViolationIssuedEvent {
  constructor(
    public readonly violationId: string,
    public readonly violationNumber: string,
    public readonly unitId: string,
    public readonly recipientUserIds: string[],
    public readonly type: string,
    public readonly fineAmount: number,
  ) {}
}

