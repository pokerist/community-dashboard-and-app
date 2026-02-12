export class ReferralCreatedEvent {
  constructor(
    public readonly referralId: string,
    public readonly referrerId: string,
    public readonly referrerName: string,
    public readonly friendFullName: string,
    public readonly friendMobile: string,
    public readonly inviteeUserId?: string,
  ) {}
}

