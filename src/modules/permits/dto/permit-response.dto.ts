import {
  PermitCategory,
  PermitStatus,
  ServiceFieldType,
} from '@prisma/client';

export class PermitFieldResponseDto {
  id!: string;
  label!: string;
  type!: ServiceFieldType;
  placeholder!: string | null;
  required!: boolean;
  displayOrder!: number;
}

export class PermitTypeResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  category!: PermitCategory;
  description!: string | null;
  isActive!: boolean;
  displayOrder!: number;
  fields!: PermitFieldResponseDto[];
  createdAt!: string;
  updatedAt!: string;
}

export class PermitRequestListItemDto {
  id!: string;
  requestNumber!: string;
  permitTypeId!: string;
  permitTypeName!: string;
  category!: PermitCategory;
  unitId!: string;
  unitNumber!: string;
  requesterId!: string;
  requesterName!: string;
  status!: PermitStatus;
  submittedAt!: string;
}

export class PermitRequestFieldValueResponseDto {
  fieldId!: string;
  label!: string;
  type!: ServiceFieldType;
  valueText!: string | null;
  valueNumber!: number | null;
  valueBool!: boolean | null;
  valueDate!: string | null;
}

export class PermitRequestDetailDto {
  id!: string;
  requestNumber!: string;
  status!: PermitStatus;
  notes!: string | null;
  rejectionReason!: string | null;
  submittedAt!: string;
  reviewedAt!: string | null;
  permitType!: PermitTypeResponseDto;
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
  reviewer!: {
    id: string;
    name: string;
  } | null;
  fieldValues!: PermitRequestFieldValueResponseDto[];
}

export class PermitStatsResponseDto {
  totalRequests!: number;
  pendingRequests!: number;
  approvedThisMonth!: number;
  rejectedThisMonth!: number;
  requestsByCategory!: Record<PermitCategory, number>;
  requestsByStatus!: Record<PermitStatus, number>;
}
