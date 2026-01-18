export class BookingCancelledEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly facilityName: string,
    public readonly date: Date,
    public readonly startTime: string,
    public readonly endTime: string,
  ) {}
}
