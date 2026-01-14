export class NotificationCreatedEvent {
  constructor(
    public readonly notificationId: string,
    public readonly channels: string[],
    public readonly recipients: string[],
  ) {}
}
