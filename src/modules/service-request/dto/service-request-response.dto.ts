import { Priority, ServiceCategory, ServiceRequestStatus } from '@prisma/client';

export type ServiceRequestSlaStatus =
  | 'ON_TRACK'
  | 'BREACHED'
  | 'RESOLVED'
  | 'NO_SLA';

export class ServiceRequestListItemDto {
  id!: string;
  requestNumber!: string;
  serviceName!: string;
  category!: ServiceCategory;
  unitNumber!: string;
  requesterName!: string;
  assigneeName!: string | null;
  status!: ServiceRequestStatus;
  priority!: Priority;
  slaStatus!: ServiceRequestSlaStatus;
  slaDeadline!: string | null;
  hoursRemaining!: number | null;
  createdAt!: string;
}

export class ServiceRequestFieldValueResponseDto {
  fieldId!: string;
  label!: string;
  type!: string;
  valueText!: string | null;
  valueNumber!: number | null;
  valueBool!: boolean | null;
  valueDate!: string | null;
  fileAttachmentId!: string | null;
}

export class ServiceRequestCommentResponseDto {
  id!: string;
  body!: string;
  isInternal!: boolean;
  createdAt!: string;
  authorId!: string;
  authorName!: string;
}

export class ServiceRequestInvoiceResponseDto {
  id!: string;
  invoiceNumber!: string;
  amount!: number;
  status!: string;
  dueDate!: string;
}

export class ServiceRequestSlaInfoDto {
  status!: ServiceRequestSlaStatus;
  deadline!: string | null;
  hoursRemaining!: number | null;
  hoursOverdue!: number | null;
}

export class ServiceRequestDetailDto {
  id!: string;
  requestNumber!: string;
  status!: ServiceRequestStatus;
  priority!: Priority;
  description!: string;
  createdAt!: string;
  updatedAt!: string;
  assignedAt!: string | null;
  resolvedAt!: string | null;
  closedAt!: string | null;
  customerRating!: number | null;
  internalNotes!: string | null;
  service!: {
    id: string;
    name: string;
    category: ServiceCategory;
    slaHours: number | null;
  };
  unit!: {
    id: string;
    unitNumber: string;
    block: string | null;
  };
  requester!: {
    id: string;
    name: string;
    phone: string | null;
  };
  assignee!: {
    id: string;
    name: string;
  } | null;
  fieldValues!: ServiceRequestFieldValueResponseDto[];
  comments!: ServiceRequestCommentResponseDto[];
  invoices!: ServiceRequestInvoiceResponseDto[];
  sla!: ServiceRequestSlaInfoDto;
}

