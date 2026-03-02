export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  userId: string | null;
  email: string;
  userStatus?: string | null;
  mustCompleteActivation?: boolean;
};

export type SavedLoginCredentials = {
  email: string;
  password: string;
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
  accessToken?: string;
  refreshToken?: string;
  userStatus?: string;
  mustCompleteActivation?: boolean;
  challengeRequired?: boolean;
  challengeToken?: string;
  method?: 'SMS' | 'EMAIL' | string;
  expiresInSeconds?: number;
};

export type VerifyLoginTwoFactorPayload = {
  challengeToken: string;
  otp: string;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};

export type ActivationStatusResponse = {
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    nameEN?: string | null;
    nameAR?: string | null;
    userStatus?: string | null;
    nationalIdFileId?: string | null;
    profilePhotoId?: string | null;
  };
  mustCompleteActivation: boolean;
  checklist: {
    requiresPhoneOtp: boolean;
    phoneVerified: boolean;
    hasNationalId: boolean;
    hasProfilePhoto: boolean;
    canCompleteActivation: boolean;
  };
};

export type CompleteActivationPayload = {
  nationalIdFileId: string;
  profilePhotoId: string;
  newPassword: string;
  nameEN?: string;
  nameAR?: string;
};

export type UpdateActivationDraftPayload = {
  nationalIdFileId?: string;
  profilePhotoId?: string;
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
    twoFactorEnabled?: boolean;
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
  vehicles?: Array<{
    id: string;
    vehicleType: string;
    model: string;
    plateNumber: string;
    color?: string | null;
    notes?: string | null;
    isPrimary?: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
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
    canUseDiscover?: boolean;
    canUseHelpCenter?: boolean;
    canUseUtilities?: boolean;
  };
};

export type UpdateMeProfileInput = {
  nameEN?: string;
  nameAR?: string;
  email?: string;
  phone?: string;
};

export type ProfileChangeRequestRow = {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  requestedFields?: Record<string, unknown> | null;
  previousSnapshot?: Record<string, unknown> | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
};
