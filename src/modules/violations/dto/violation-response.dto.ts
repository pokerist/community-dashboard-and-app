import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViolationActionStatus, ViolationActionType, ViolationStatus } from '@prisma/client';

export class ViolationCategoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  defaultFineAmount!: number;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ViolationListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  violationNumber!: string;

  @ApiPropertyOptional()
  categoryName!: string | null;

  @ApiProperty()
  unitNumber!: string;

  @ApiPropertyOptional()
  residentName!: string | null;

  @ApiPropertyOptional()
  issuerName!: string | null;

  @ApiProperty()
  fineAmount!: number;

  @ApiProperty({ enum: ViolationStatus })
  status!: ViolationStatus;

  @ApiProperty()
  hasAppeal!: boolean;

  @ApiPropertyOptional()
  appealStatus!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class ViolationListResponseDto {
  @ApiProperty({ type: [ViolationListItemDto] })
  data!: ViolationListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ViolationDetailPhotoEvidenceDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  fileName!: string | null;

  @ApiPropertyOptional()
  mimeType!: string | null;

  @ApiPropertyOptional()
  url!: string | null;
}

export class ViolationDetailActionRequestDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ViolationActionType })
  type!: ViolationActionType;

  @ApiProperty({ enum: ViolationActionStatus })
  status!: ViolationActionStatus;

  @ApiPropertyOptional()
  note!: string | null;

  @ApiProperty({ type: [String] })
  attachmentIds!: string[];

  @ApiPropertyOptional()
  rejectionReason!: string | null;

  @ApiProperty()
  requestedById!: string;

  @ApiProperty()
  requestedByName!: string;

  @ApiPropertyOptional()
  reviewedById!: string | null;

  @ApiPropertyOptional()
  reviewedByName!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  reviewedAt!: string | null;
}

export class ViolationDetailInvoiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  dueDate!: string;
}

export class ViolationDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  violationNumber!: string;

  @ApiPropertyOptional()
  categoryId!: string | null;

  @ApiPropertyOptional()
  categoryName!: string | null;

  @ApiPropertyOptional()
  categoryDescription!: string | null;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  fineAmount!: number;

  @ApiProperty({ enum: ViolationStatus })
  status!: ViolationStatus;

  @ApiPropertyOptional()
  appealStatus!: string | null;

  @ApiPropertyOptional()
  appealDeadline!: string | null;

  @ApiPropertyOptional()
  closedAt!: string | null;

  @ApiProperty()
  unitId!: string;

  @ApiProperty()
  unitNumber!: string;

  @ApiPropertyOptional()
  residentId!: string | null;

  @ApiPropertyOptional()
  residentName!: string | null;

  @ApiPropertyOptional()
  issuerId!: string | null;

  @ApiPropertyOptional()
  issuerName!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [ViolationDetailPhotoEvidenceDto] })
  photoEvidence!: ViolationDetailPhotoEvidenceDto[];

  @ApiProperty({ type: [ViolationDetailActionRequestDto] })
  actionRequests!: ViolationDetailActionRequestDto[];

  @ApiProperty({ type: [ViolationDetailInvoiceDto] })
  invoices!: ViolationDetailInvoiceDto[];
}

export class ViolationAppealQueueItemDto {
  @ApiProperty()
  actionRequestId!: string;

  @ApiProperty()
  violationId!: string;

  @ApiProperty()
  violationNumber!: string;

  @ApiPropertyOptional()
  categoryName!: string | null;

  @ApiProperty()
  unitNumber!: string;

  @ApiPropertyOptional()
  residentName!: string | null;

  @ApiProperty()
  fineAmount!: number;

  @ApiPropertyOptional()
  appealNote!: string | null;

  @ApiProperty()
  submittedAt!: string;

  @ApiProperty({ enum: ViolationActionStatus })
  status!: ViolationActionStatus;
}

export class ViolationAppealQueueResponseDto {
  @ApiProperty({ type: [ViolationAppealQueueItemDto] })
  data!: ViolationAppealQueueItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ViolationStatsByCategoryDto {
  @ApiPropertyOptional()
  categoryId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  totalFines!: number;
}

export class ViolationStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  open!: number;

  @ApiProperty()
  underReview!: number;

  @ApiProperty()
  appealed!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty()
  closed!: number;

  @ApiProperty()
  cancelled!: number;

  @ApiProperty()
  pendingAppeals!: number;

  @ApiProperty()
  totalFinesIssued!: number;

  @ApiProperty()
  totalFinesCollected!: number;

  @ApiProperty({ type: [ViolationStatsByCategoryDto] })
  byCategory!: ViolationStatsByCategoryDto[];
}
