export class PendingRegistrationApprovedEvent {
  constructor(
    public readonly pendingId: string,
    public readonly approvedBy: string, // admin user id
    public readonly userId: string, // created user id
  ) {}
}