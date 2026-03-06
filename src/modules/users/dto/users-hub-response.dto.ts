import {
  AuthorizedFeeMode,
  HomeStaffType,
  HouseholdRequestStatus,
  LeaseStatus,
  UserStatusEnum,
} from '@prisma/client';

export type UserTypeValue =
  | 'OWNER'
  | 'TENANT'
  | 'FAMILY'
  | 'DELEGATE'
  | 'HOME_STAFF'
  | 'BROKER'
  | 'SYSTEM_USER'
  | 'COMPOUND_STAFF';

export class PaginatedResponseDto<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;

  constructor(input: {
    items: TItem[];
    page: number;
    limit: number;
    total: number;
  }) {
    this.items = input.items;
    this.page = input.page;
    this.limit = input.limit;
    this.total = input.total;
    this.totalPages = Math.max(1, Math.ceil(input.total / input.limit));
  }
}

export interface UnitItemDto {
  id: string;
  unitNumber: string;
}

export interface UserItemDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface LeaseItemDto {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: LeaseStatus;
}

export interface OwnerListItemDto {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatusEnum;
  unitsCount: number;
  unitNumbers: string[];
  familyMembersCount: number;
  homeStaffCount: number;
}

export interface FamilyMemberListItemDto {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatusEnum;
  primaryOwnerName: string;
  unitNumber: string | null;
  relationshipType: string;
  activatedAt: string;
}

export interface TenantListItemDto {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatusEnum;
  unitNumber: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  monthlyRent: number | null;
  leaseStatus: LeaseStatus | null;
}

export interface HomeStaffListItemDto {
  id: string;
  fullName: string;
  staffType: HomeStaffType;
  phone: string;
  ownerName: string;
  unitNumber: string | null;
  employmentFrom: string | null;
  employmentTo: string | null;
  isLiveIn: boolean;
  accessValidFrom: string;
  accessValidTo: string;
  status: HouseholdRequestStatus;
}

export interface DelegateListItemDto {
  id: string;
  fullName: string;
  phone: string;
  ownerName: string;
  unitNumber: string | null;
  delegateType: string;
  validFrom: string;
  validTo: string;
  qrScopes: string[];
  feeMode: AuthorizedFeeMode;
}

export interface BrokerResponseDto {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  agencyName: string | null;
  licenseNumber: string | null;
  status: UserStatusEnum;
  createdAt: string;
}

export interface SystemUserListItemDto {
  userId: string;
  name: string;
  email: string | null;
  roles: string[];
  status: UserStatusEnum;
  lastLoginAt: string | null;
}

export interface UserStatusLogItemDto {
  id: string;
  newStatus: UserStatusEnum;
  note: string | null;
  createdAt: string;
}

export interface UserDetailResponseDto {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatusEnum;
  userType: UserTypeValue;
  profilePhotoUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  ownerData?: { units: UnitItemDto[]; familyCount: number; staffCount: number };
  tenantData?: { lease: LeaseItemDto; unit: UnitItemDto };
  familyData?: {
    primaryOwner: UserItemDto;
    unit: UnitItemDto | null;
    relationship: string;
  };
  delegateData?: {
    owner: UserItemDto;
    unit: UnitItemDto;
    permissions: string[];
  };
  homeStaffData?: {
    owner: UserItemDto;
    unit: UnitItemDto;
    staffType: string;
  };
  brokerData?: { agencyName: string | null; licenseNumber: string | null };
  activity: UserStatusLogItemDto[];
  linkedRecords: {
    units: UnitItemDto[];
    leases: LeaseItemDto[];
    complaints: number;
    violations: number;
  };
}

export interface UserStatsResponseDto {
  totalUsers: number;
  totalOwners: number;
  totalFamilyMembers: number;
  totalTenants: number;
  totalHomeStaff: number;
  totalDelegates: number;
  totalBrokers: number;
  totalSystemUsers: number;
  pendingApprovals: number;
  suspendedUsers: number;
}
