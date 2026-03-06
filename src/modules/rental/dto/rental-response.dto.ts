import { InvoiceStatus, LeaseSource, LeaseStatus, RentRequestStatus } from '@prisma/client';

export class RentalSettingsResponseDto {
  leasingEnabled!: boolean;
  suspensionReason!: string | null;
  suspendedAt!: string | null;
}

export class RentalStatsResponseDto {
  activeLeases!: number;
  expiringThisMonth!: number;
  expiredLeases!: number;
  pendingRentRequests!: number;
  totalMonthlyRevenue!: number;
  leasingEnabled!: boolean;
}

export class LeaseListItemDto {
  id!: string;
  unitNumber!: string;
  communityName!: string;
  ownerName!: string;
  tenantName!: string | null;
  monthlyRent!: number;
  startDate!: string;
  endDate!: string;
  status!: LeaseStatus;
  daysUntilExpiry!: number | null;
  source!: LeaseSource;
}

export class LeaseRenewalLinkDto {
  id!: string;
  startDate!: string;
  endDate!: string;
  status!: LeaseStatus;
}

export class LeaseInvoiceHistoryItemDto {
  id!: string;
  invoiceNumber!: string;
  dueDate!: string;
  amount!: number;
  status!: InvoiceStatus;
  paidDate!: string | null;
}

export class LeasePersonSummaryDto {
  id!: string;
  name!: string | null;
  email!: string | null;
  phone!: string | null;
}

export class LeaseUnitSummaryDto {
  id!: string;
  unitNumber!: string;
  projectName!: string;
  communityName!: string | null;
}

export class LeaseDetailResponseDto {
  id!: string;
  status!: LeaseStatus;
  source!: LeaseSource;
  startDate!: string;
  endDate!: string;
  monthlyRent!: number;
  securityDeposit!: number | null;
  autoRenew!: boolean;
  renewalNoticeSentAt!: string | null;
  unit!: LeaseUnitSummaryDto;
  owner!: LeasePersonSummaryDto;
  tenant!: LeasePersonSummaryDto | null;
  renewedFrom!: LeaseRenewalLinkDto | null;
  renewedTo!: LeaseRenewalLinkDto | null;
  renewalChain!: LeaseRenewalLinkDto[];
  invoiceHistory!: LeaseInvoiceHistoryItemDto[];
}

export class RentRequestListItemDto {
  id!: string;
  unitId!: string;
  unitNumber!: string;
  ownerUserId!: string;
  ownerName!: string | null;
  ownerEmail!: string | null;
  tenantName!: string;
  tenantEmail!: string;
  tenantPhone!: string;
  tenantNationality!: string;
  status!: RentRequestStatus;
  rejectionReason!: string | null;
  requestedAt!: string;
  reviewedAt!: string | null;
  reviewedByName!: string | null;
  contractFileId!: string | null;
  tenantNationalIdFileId!: string | null;
}

export class PaginatedRentRequestsResponseDto {
  data!: RentRequestListItemDto[];
  total!: number;
  page!: number;
  limit!: number;
}

