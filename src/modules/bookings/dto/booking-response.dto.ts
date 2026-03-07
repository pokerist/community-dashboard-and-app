import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, FacilityType } from '@prisma/client';

export class BookingListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  facilityName!: string;

  @ApiProperty({ enum: FacilityType })
  facilityType!: FacilityType;

  @ApiProperty()
  userName!: string;

  @ApiPropertyOptional()
  unitNumber!: string | null;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty({ enum: BookingStatus })
  status!: BookingStatus;

  @ApiPropertyOptional()
  totalAmount!: number | null;

  @ApiProperty()
  requiresPrepayment!: boolean;

  @ApiPropertyOptional()
  paymentStatus!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class BookingListResponseDto {
  @ApiProperty({ type: [BookingListItemDto] })
  data!: BookingListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class BookingDetailInvoiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  dueDate!: string;

  @ApiPropertyOptional()
  paidDate!: string | null;
}

export class BookingDetailDto extends BookingListItemDto {
  @ApiProperty()
  facilityId!: string;

  @ApiPropertyOptional()
  facilityDescription!: string | null;

  @ApiPropertyOptional()
  facilityRules!: string | null;

  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  userPhone!: string | null;

  @ApiPropertyOptional()
  cancellationReason!: string | null;

  @ApiPropertyOptional()
  rejectionReason!: string | null;

  @ApiPropertyOptional()
  cancelledById!: string | null;

  @ApiPropertyOptional()
  rejectedById!: string | null;

  @ApiPropertyOptional()
  checkedInAt!: string | null;

  @ApiPropertyOptional()
  cancelledAt!: string | null;

  @ApiPropertyOptional()
  refundRequired!: boolean;

  @ApiProperty({ type: [BookingDetailInvoiceDto] })
  invoices!: BookingDetailInvoiceDto[];

  @ApiProperty()
  updatedAt!: string;
}
