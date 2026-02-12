export class ReferralConvertedEvent {
  constructor(
    public readonly referralId: string,
    public readonly referrerId: string,
    public readonly referrerName: string,
    public readonly convertedUserId: string,
    public readonly convertedUserName: string,
  ) {}
}

