import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComplaintStatus, Priority } from '@prisma/client';

export type ComplaintSlaStatus = 'ON_TRACK' | 'BREACHED' | 'RESOLVED' | 'NO_SLA';

export class ComplaintCategoryItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slaHours!: number;

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

export class ComplaintListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  complaintNumber!: string;

  @ApiPropertyOptional()
  title!: string | null;

  @ApiPropertyOptional()
  categoryName!: string | null;

  @ApiPropertyOptional()
  unitNumber!: string | null;

  @ApiProperty()
  reporterName!: string;

  @ApiPropertyOptional()
  assigneeName!: string | null;

  @ApiProperty({ enum: Priority })
  priority!: Priority;

  @ApiProperty({ enum: ComplaintStatus })
  status!: ComplaintStatus;

  @ApiProperty({ enum: ['ON_TRACK', 'BREACHED', 'RESOLVED', 'NO_SLA'] })
  slaStatus!: ComplaintSlaStatus;

  @ApiPropertyOptional()
  hoursRemaining!: number | null;

  @ApiProperty()
  createdAt!: string;
}

export class ComplaintListResponseDto {
  @ApiProperty({ type: [ComplaintListItemDto] })
  data!: ComplaintListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}

export class ComplaintDetailCommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  isInternal!: boolean;

  @ApiProperty()
  authorId!: string;

  @ApiProperty()
  authorName!: string;

  @ApiProperty()
  createdAt!: string;
}

export class ComplaintDetailInvoiceDto {
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

export class ComplaintDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  complaintNumber!: string;

  @ApiPropertyOptional()
  title!: string | null;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: Priority })
  priority!: Priority;

  @ApiProperty({ enum: ComplaintStatus })
  status!: ComplaintStatus;

  @ApiPropertyOptional()
  categoryId!: string | null;

  @ApiPropertyOptional()
  categoryName!: string | null;

  @ApiPropertyOptional()
  categorySlaHours!: number | null;

  @ApiPropertyOptional()
  unitId!: string | null;

  @ApiPropertyOptional()
  unitNumber!: string | null;

  @ApiProperty()
  reporterId!: string;

  @ApiProperty()
  reporterName!: string;

  @ApiPropertyOptional()
  assigneeId!: string | null;

  @ApiPropertyOptional()
  assigneeName!: string | null;

  @ApiPropertyOptional()
  resolutionNotes!: string | null;

  @ApiPropertyOptional()
  resolvedAt!: string | null;

  @ApiPropertyOptional()
  closedAt!: string | null;

  @ApiPropertyOptional()
  slaDeadline!: string | null;

  @ApiPropertyOptional()
  slaBreachedAt!: string | null;

  @ApiPropertyOptional()
  hoursRemaining!: number | null;

  @ApiPropertyOptional()
  hoursOverdue!: number | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [ComplaintDetailCommentDto] })
  comments!: ComplaintDetailCommentDto[];

  @ApiProperty({ type: [ComplaintDetailInvoiceDto] })
  invoices!: ComplaintDetailInvoiceDto[];
}

export class ComplaintStatsByCategoryDto {
  @ApiPropertyOptional()
  categoryId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  count!: number;
}

export class ComplaintStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  open!: number;

  @ApiProperty()
  resolved!: number;

  @ApiProperty()
  closed!: number;

  @ApiProperty()
  slaBreached!: number;

  @ApiProperty()
  avgResolutionHours!: number;

  @ApiProperty()
  byPriority!: Record<Priority, number>;

  @ApiProperty({ type: [ComplaintStatsByCategoryDto] })
  byCategory!: ComplaintStatsByCategoryDto[];

  @ApiProperty()
  byStatus!: Record<ComplaintStatus, number>;
}

export class CheckSlaBreachesResponseDto {
  @ApiProperty()
  breachCount!: number;
}
