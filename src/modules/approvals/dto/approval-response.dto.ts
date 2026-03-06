import { AuthorizedFeeMode, FamilyRelationType, HomeStaffType, HouseholdRequestStatus, RegistrationStatus } from '@prisma/client';

export type ApprovalItemType = 'OWNER' | 'FAMILY' | 'DELEGATE' | 'HOME_STAFF';

export class ApprovalDocumentOtherDto {
  label!: string;
  url!: string;
}

export class ApprovalDocumentsDto {
  photo!: string | null;
  nationalId!: string | null;
  passport!: string | null;
  other!: ApprovalDocumentOtherDto[];
}

export class ApprovalItemResponseDto {
  id!: string;
  type!: ApprovalItemType;
  status!: RegistrationStatus | HouseholdRequestStatus;
  submittedAt!: string;
  isPreRegistration!: boolean;
  documents!: ApprovalDocumentsDto;
}

export class OwnerApprovalItemResponseDto extends ApprovalItemResponseDto {
  name!: string | null;
  phone!: string;
  email!: string | null;
  nationalId!: string;
  roleIntent!: string | null;
  origin!: string;
  expiresAt!: string;
  verificationCode!: string | null;
  photoUrl!: string | null;
  nationalIdFileUrl!: string | null;
  lookupResult!: Record<string, unknown> | null;
}

export class FamilyApprovalItemResponseDto extends ApprovalItemResponseDto {
  fullName!: string;
  phone!: string;
  email!: string | null;
  relationship!: FamilyRelationType;
  ownerUserId!: string;
  ownerName!: string;
  unitId!: string;
  unitNumber!: string | null;
  projectName!: string;
  nationality!: string;
  nationalIdOrPassport!: string | null;
  featurePermissions!: Record<string, unknown> | null;
}

export class DelegateApprovalItemResponseDto extends ApprovalItemResponseDto {
  fullName!: string;
  phone!: string;
  email!: string | null;
  ownerUserId!: string;
  ownerName!: string;
  unitId!: string;
  unitNumber!: string | null;
  projectName!: string;
  validFrom!: string;
  validTo!: string;
  qrScopes!: string[];
  feeMode!: AuthorizedFeeMode;
  feeAmount!: number | null;
  featurePermissions!: Record<string, unknown> | null;
}

export class HomeStaffApprovalItemResponseDto extends ApprovalItemResponseDto {
  fullName!: string;
  phone!: string;
  ownerUserId!: string;
  ownerName!: string;
  unitId!: string;
  unitNumber!: string | null;
  projectName!: string;
  staffType!: HomeStaffType;
  accessValidFrom!: string;
  accessValidTo!: string;
  isLiveIn!: boolean;
  employmentFrom!: string | null;
  employmentTo!: string | null;
}

export class ApprovalStatsResponseDto {
  pendingOwners!: number;
  pendingFamilyMembers!: number;
  pendingDelegates!: number;
  pendingHomeStaff!: number;
  totalPending!: number;
}

export class ApprovalActionResponseDto {
  success!: true;
  id!: string;
  status!: RegistrationStatus | HouseholdRequestStatus;
}

export class PreRegistrationResponseDto {
  success!: true;
  userId!: string;
  requestId!: string;
  status!: RegistrationStatus | HouseholdRequestStatus;
}

