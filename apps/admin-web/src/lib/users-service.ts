import apiClient from "./api-client";

export type UserStatus = "PENDING" | "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED";
export type LeaseStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "TERMINATED";
export type HouseholdRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type HomeStaffType = "DRIVER" | "NANNY" | "SERVANT" | "GARDENER" | "OTHER";
export type UserType =
  | "OWNER"
  | "TENANT"
  | "FAMILY"
  | "DELEGATE"
  | "HOME_STAFF"
  | "BROKER"
  | "SYSTEM_USER"
  | "COMPOUND_STAFF";

export interface PaginatedResponse<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserStats {
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

export interface OwnerListItem {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  unitsCount: number;
  unitNumbers: string[];
  familyMembersCount: number;
  homeStaffCount: number;
}

export interface FamilyMemberListItem {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  primaryOwnerName: string;
  unitNumber: string | null;
  relationshipType: string;
  activatedAt: string;
}

export interface TenantListItem {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  unitNumber: string | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  monthlyRent: number | null;
  leaseStatus: LeaseStatus | null;
}

export interface HomeStaffListItem {
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

export interface DelegateListItem {
  id: string;
  fullName: string;
  phone: string;
  ownerName: string;
  unitNumber: string | null;
  delegateType: string;
  validFrom: string;
  validTo: string;
  qrScopes: string[];
  feeMode: "NO_FEE" | "FEE_REQUIRED";
}

export interface Broker {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  agencyName: string | null;
  licenseNumber: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface SystemUserListItem {
  userId: string;
  name: string;
  email: string | null;
  roles: string[];
  status: UserStatus;
  lastLoginAt: string | null;
}

export interface UnitItem {
  id: string;
  unitNumber: string;
}

export interface LeaseItem {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  status: LeaseStatus;
}

export interface UserItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface UserStatusLogItem {
  id: string;
  newStatus: UserStatus;
  note: string | null;
  createdAt: string;
}

export interface UserDetailResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  userType: UserType;
  profilePhotoUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  ownerData?: { units: UnitItem[]; familyCount: number; staffCount: number };
  tenantData?: { lease: LeaseItem; unit: UnitItem };
  familyData?: { primaryOwner: UserItem; unit: UnitItem | null; relationship: string };
  delegateData?: { owner: UserItem; unit: UnitItem; permissions: string[] };
  homeStaffData?: { owner: UserItem; unit: UnitItem; staffType: string };
  brokerData?: { agencyName: string | null; licenseNumber: string | null };
  activity: UserStatusLogItem[];
  linkedRecords: {
    units: UnitItem[];
    leases: LeaseItem[];
    complaints: number;
    violations: number;
  };
}

export interface SuspendUserPayload {
  reason: string;
}

export interface CreateBrokerPayload {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
  agencyName?: string;
  licenseNumber?: string;
}

export interface UpdateBrokerPayload {
  name?: string;
  email?: string | null;
  phone?: string | null;
  agencyName?: string | null;
  licenseNumber?: string | null;
  status?: UserStatus;
}

type BaseListFilters = {
  page?: number;
  limit?: number;
  search?: string;
};

type OwnersFilters = BaseListFilters & {
  status?: UserStatus;
  communityId?: string;
};

type FamilyFilters = BaseListFilters & {
  status?: UserStatus;
  ownerUserId?: string;
  unitId?: string;
};

type TenantFilters = BaseListFilters & {
  status?: UserStatus;
  communityId?: string;
  leaseStatus?: LeaseStatus;
};

type HomeStaffFilters = BaseListFilters & {
  staffType?: HomeStaffType;
  status?: HouseholdRequestStatus;
  unitId?: string;
};

type DelegateFilters = BaseListFilters & {
  status?: HouseholdRequestStatus;
  ownerUserId?: string;
};

type BrokersFilters = BaseListFilters & {
  status?: UserStatus;
};

type SystemUsersFilters = BaseListFilters & {
  status?: UserStatus;
  roleId?: string;
};

const usersService = {
  async getStats(): Promise<UserStats> {
    const response = await apiClient.get<UserStats>("/users/stats");
    return response.data;
  },

  async listOwners(filters?: OwnersFilters): Promise<PaginatedResponse<OwnerListItem>> {
    const response = await apiClient.get<PaginatedResponse<OwnerListItem>>("/users/owners", {
      params: filters,
    });
    return response.data;
  },

  async listFamilyMembers(
    filters?: FamilyFilters,
  ): Promise<PaginatedResponse<FamilyMemberListItem>> {
    const response = await apiClient.get<PaginatedResponse<FamilyMemberListItem>>(
      "/users/family-members",
      {
        params: filters,
      },
    );
    return response.data;
  },

  async listTenants(filters?: TenantFilters): Promise<PaginatedResponse<TenantListItem>> {
    const response = await apiClient.get<PaginatedResponse<TenantListItem>>("/users/tenants", {
      params: filters,
    });
    return response.data;
  },

  async listHomeStaff(
    filters?: HomeStaffFilters,
  ): Promise<PaginatedResponse<HomeStaffListItem>> {
    const response = await apiClient.get<PaginatedResponse<HomeStaffListItem>>(
      "/users/home-staff",
      {
        params: filters,
      },
    );
    return response.data;
  },

  async listDelegates(
    filters?: DelegateFilters,
  ): Promise<PaginatedResponse<DelegateListItem>> {
    const response = await apiClient.get<PaginatedResponse<DelegateListItem>>(
      "/users/delegates",
      {
        params: filters,
      },
    );
    return response.data;
  },

  async listBrokers(filters?: BrokersFilters): Promise<PaginatedResponse<Broker>> {
    const response = await apiClient.get<PaginatedResponse<Broker>>("/users/brokers", {
      params: filters,
    });
    return response.data;
  },

  async listSystemUsers(
    filters?: SystemUsersFilters,
  ): Promise<PaginatedResponse<SystemUserListItem>> {
    const response = await apiClient.get<PaginatedResponse<SystemUserListItem>>(
      "/users/system-users",
      {
        params: filters,
      },
    );
    return response.data;
  },

  async getUserDetail(userId: string): Promise<UserDetailResponse> {
    const response = await apiClient.get<UserDetailResponse>(`/users/${userId}`);
    return response.data;
  },

  async suspendUser(userId: string, payload: SuspendUserPayload) {
    const response = await apiClient.patch<{ success: true; userId: string; status: UserStatus }>(
      `/users/${userId}/suspend`,
      payload,
    );
    return response.data;
  },

  async activateUser(userId: string, note?: string) {
    const response = await apiClient.patch<{ success: true; userId: string; status: UserStatus }>(
      `/users/${userId}/activate`,
      note ? { note } : {},
    );
    return response.data;
  },

  async createBroker(payload: CreateBrokerPayload): Promise<Broker> {
    const response = await apiClient.post<Broker>("/brokers", payload);
    return response.data;
  },

  async updateBroker(brokerId: string, payload: UpdateBrokerPayload): Promise<Broker> {
    const response = await apiClient.patch<Broker>(`/brokers/${brokerId}`, payload);
    return response.data;
  },
};

export default usersService;
