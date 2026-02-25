export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  userId: string | null;
  email: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupRoleIntent = 'OWNER' | 'TENANT' | 'FAMILY';

export type SignupPayload = {
  name: string;
  phone: string;
  email?: string;
  nationalId: string;
  personalPhotoId: string;
  roleIntent?: SignupRoleIntent;
  password?: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};

export type SignupResponse = {
  id: string;
  status?: string;
  createdAt?: string;
};

export type AuthBootstrapProfile = {
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    nameEN?: string | null;
    nameAR?: string | null;
    userStatus?: string;
    signupSource?: string;
    emailVerifiedAt?: string | null;
    phoneVerifiedAt?: string | null;
    lastLoginAt?: string | null;
    profilePhoto?: {
      id: string;
      name?: string | null;
      mimeType?: string | null;
      size?: number | null;
    } | null;
  };
  roles: string[];
  permissions: string[];
  profileKinds: {
    resident: boolean;
    owner: boolean;
    tenant: boolean;
    admin: boolean;
  };
  residentProfile?: {
    id: string;
    nationalId?: string | null;
    dateOfBirth?: string | null;
    relationship?: string | null;
  } | null;
  units: Array<{
    id: string;
    unitNumber?: string | null;
    block?: string | null;
    projectName?: string | null;
    status?: string;
    type?: string;
    accesses?: Array<{
      id: string;
      role?: string;
      status?: string;
      canViewFinancials?: boolean;
      canReceiveBilling?: boolean;
      canBookFacilities?: boolean;
      canGenerateQR?: boolean;
      canManageWorkers?: boolean;
    }>;
    legacyResidentLinks?: Array<{
      residentUnitId: string;
      isPrimary: boolean;
    }>;
  }>;
  legacyResidentLinks?: Array<{
    residentUnitId: string;
    isPrimary: boolean;
    unitId: string;
    unit?: {
      id: string;
      unitNumber?: string | null;
      block?: string | null;
      projectName?: string | null;
      status?: string;
      type?: string;
    } | null;
  }>;
  personaHints?: {
    resolvedPersona?:
      | 'PRE_DELIVERY_OWNER'
      | 'CONTRACTOR'
      | 'AUTHORIZED'
      | 'OWNER'
      | 'TENANT'
      | 'FAMILY'
      | 'RESIDENT';
    isOwner?: boolean;
    isTenant?: boolean;
    isFamily?: boolean;
    isDelegate?: boolean;
    isPreDeliveryOwner?: boolean;
    canManageWorkers?: boolean;
  };
  featureAvailability?: {
    canViewBanners?: boolean;
    canUseServices?: boolean;
    canUseBookings?: boolean;
    canUseComplaints?: boolean;
    canUseQr?: boolean;
    canViewFinance?: boolean;
    canManageHousehold?: boolean;
  };
};

export type UpdateMeProfileInput = {
  nameEN?: string;
  nameAR?: string;
};
