import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, BookingStatus, FacilityType } from '@prisma/client';

export class FacilityListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: FacilityType })
  type!: FacilityType;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  iconName!: string | null;

  @ApiPropertyOptional()
  color!: string | null;

  @ApiPropertyOptional()
  rules!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isBookable!: boolean;

  @ApiProperty()
  requiresPrepayment!: boolean;

  @ApiPropertyOptional()
  capacity!: number | null;

  @ApiPropertyOptional()
  price!: number | null;

  @ApiProperty({ enum: BillingCycle })
  billingCycle!: BillingCycle;

  @ApiPropertyOptional()
  reminderMinutesBefore!: number | null;

  @ApiPropertyOptional()
  maxReservationsPerDay!: number | null;

  @ApiPropertyOptional()
  cooldownMinutes!: number | null;

  @ApiProperty()
  slotCount!: number;

  @ApiProperty()
  upcomingBookingsToday!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class FacilitySlotConfigItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  dayOfWeek!: number;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty()
  slotDurationMinutes!: number;

  @ApiPropertyOptional()
  slotCapacity!: number | null;
}

export class FacilitySlotExceptionItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  isClosed!: boolean;

  @ApiPropertyOptional()
  startTime!: string | null;

  @ApiPropertyOptional()
  endTime!: string | null;

  @ApiPropertyOptional()
  slotDurationMinutes!: number | null;

  @ApiPropertyOptional()
  slotCapacity!: number | null;
}

export class FacilityBookingStatsDto {
  @ApiProperty()
  totalBookings!: number;

  @ApiProperty()
  pendingBookings!: number;

  @ApiProperty()
  revenueThisMonth!: number;
}

export class FacilityDetailDto extends FacilityListItemDto {
  @ApiProperty({ type: [FacilitySlotConfigItemDto] })
  slotConfig!: FacilitySlotConfigItemDto[];

  @ApiProperty({ type: [FacilitySlotExceptionItemDto] })
  slotExceptions!: FacilitySlotExceptionItemDto[];

  @ApiProperty({ type: FacilityBookingStatsDto })
  bookingStats!: FacilityBookingStatsDto;
}

export type FacilityAvailableSlotStatus = 'AVAILABLE' | 'BOOKED' | 'CLOSED';

export class FacilityAvailableSlotItemDto {
  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty({ enum: ['AVAILABLE', 'BOOKED', 'CLOSED'] })
  status!: FacilityAvailableSlotStatus;

  @ApiPropertyOptional()
  bookingId!: string | null;
}

export class FacilityAvailableSlotsDto {
  @ApiProperty()
  date!: string;

  @ApiProperty({ type: [FacilityAvailableSlotItemDto] })
  slots!: FacilityAvailableSlotItemDto[];
}

export class AmenityStatsByFacilityDto {
  @ApiProperty()
  facilityId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  revenue!: number;
}

export class AmenityStatsDto {
  @ApiProperty()
  totalFacilities!: number;

  @ApiProperty()
  activeFacilities!: number;

  @ApiProperty()
  bookingsToday!: number;

  @ApiProperty()
  pendingApprovals!: number;

  @ApiProperty()
  revenueThisMonth!: number;

  @ApiProperty({ type: [AmenityStatsByFacilityDto] })
  bookingsByFacility!: AmenityStatsByFacilityDto[];

  @ApiProperty()
  bookingsByStatus!: Record<BookingStatus, number>;
}
