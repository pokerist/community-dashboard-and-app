export type PaginatedMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta: PaginatedMeta;
};

export type MobileBanner = {
  id: string;
  titleEn: string;
  titleAr?: string | null;
  description?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  imageFileId?: string | null;
  imageStreamPath?: string | null;
  imagePublicPath?: string | null;
  targetAudience?: string;
  audienceMeta?: Record<string, unknown> | null;
  startDate?: string;
  endDate?: string;
  status?: string;
  displayPriority?: string;
  views?: number;
  clicks?: number;
  ctr?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type UnitAccessSummary = {
  id: string;
  role?: string;
  status?: string;
  canBookFacilities?: boolean;
  canGenerateQR?: boolean;
  canManageWorkers?: boolean;
  canViewFinancials?: boolean;
  canReceiveBilling?: boolean;
};

export type ResidentUnit = {
  id: string;
  unitNumber?: string;
  block?: string | null;
  projectName?: string | null;
  status?: string;
  type?: string;
  unitAccesses?: UnitAccessSummary[];
};

export type FacilitySlotConfig = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number | null;
  slotCapacity?: number | null;
};

export type Facility = {
  id: string;
  name: string;
  description?: string | null;
  type?: string;
  isActive?: boolean;
  capacity?: number | null;
  price?: string | number | null;
  maxReservationsPerDay?: number | null;
  cooldownMinutes?: number | null;
  slotConfig?: FacilitySlotConfig[];
};

export type Booking = {
  id: string;
  status?: string;
  date: string;
  startTime: string;
  endTime: string;
  facilityId?: string;
  unitId?: string;
  createdAt?: string;
  cancelledAt?: string | null;
  facility?: {
    id?: string;
    name?: string;
  } | null;
  unit?: {
    id?: string;
    unitNumber?: string;
  } | null;
};

export type ServiceField = {
  id: string;
  label: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'MEMBER_SELECTOR' | 'FILE' | string;
  placeholder?: string | null;
  required?: boolean;
  order?: number | null;
};

export type CommunityService = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isUrgent?: boolean;
  status?: boolean;
  unitEligibility?: string | null;
  startingPrice?: string | number | null;
  formFields?: ServiceField[];
};

export type ServiceRequestRow = {
  id: string;
  serviceId?: string;
  unitId?: string | null;
  status?: string;
  priority?: string;
  description?: string;
  requestedAt?: string;
  updatedAt?: string;
  service?: { name?: string } | null;
  comments?: ServiceRequestCommentRow[] | null;
};

export type ServiceRequestCommentRow = {
  id: string;
  requestId?: string;
  body: string;
  isInternal?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdById?: string;
  createdBy?: {
    id?: string;
    nameEN?: string | null;
    nameAR?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export type ComplaintRow = {
  id: string;
  complaintNumber?: string;
  title?: string;
  team?: string;
  category?: string;
  description?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
  unitId?: string | null;
  unit?: {
    id?: string;
    unitNumber?: string;
    block?: string | null;
    projectName?: string | null;
  } | null;
  assignedTo?: {
    id?: string;
    nameEN?: string | null;
    nameAR?: string | null;
  } | null;
};

export type ComplaintCommentRow = {
  id: string;
  complaintId?: string;
  body: string;
  isInternal?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdById?: string;
  createdBy?: {
    id?: string;
    nameEN?: string | null;
    nameAR?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

export type AccessQrRow = {
  id: string;
  qrId?: string;
  type?: string;
  usageMode?: 'SINGLE_USE' | 'MULTI_USE' | string;
  scans?: number;
  visitorName?: string | null;
  validFrom?: string;
  validTo?: string;
  status?: string;
  notes?: string | null;
  unitId?: string | null;
  createdAt?: string;
};

export type CreateAccessQrResponse = {
  qrCode: AccessQrRow;
  qrImageBase64?: string | null;
  pendingApproval?: boolean;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber?: string;
  type?: string;
  status?: string;
  amount?: string | number;
  dueDate?: string;
  paidDate?: string | null;
  unitId?: string;
  residentId?: string | null;
  violationId?: string | null;
  unit?: {
    id?: string;
    unitNumber?: string;
    projectName?: string | null;
  } | null;
};

export type ViolationRow = {
  id: string;
  violationNumber?: string;
  type?: string;
  status?: string;
  description?: string;
  fineAmount?: string | number;
  dueDate?: string;
  createdAt?: string;
  unitId?: string;
  unit?: {
    id?: string;
    unitNumber?: string;
    block?: string | null;
    projectName?: string | null;
  } | null;
  invoices?: Array<{
    id: string;
    invoiceNumber?: string;
    status?: string;
    amount?: string | number;
    dueDate?: string;
    unitId?: string;
  }>;
};

export type PayableItem = {
  key: string;
  kind: 'INVOICE' | 'VIOLATION_FINE';
  invoiceId?: string;
  violationId?: string;
  title: string;
  amount: number;
  dueDate?: string | null;
  status: string;
  unitId?: string | null;
  sourceType?: string | null;
};

export type DemoInvoicePaymentInput = {
  paymentMethod: string;
  cardLast4?: string;
  transactionRef?: string;
  notes?: string;
};

export type DemoInvoicePaymentResponse = {
  success: boolean;
  invoice: InvoiceRow;
  simulationReceipt: {
    simulated: true;
    paymentMethod: string;
    cardLast4?: string | null;
    transactionRef: string;
    notes?: string | null;
    paidAt: string;
  };
};

export type CreateBookingInput = {
  facilityId: string;
  unitId: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type CreateComplaintInput = {
  unitId?: string;
  title: string;
  body: string;
  team: string;
};

export type AddServiceRequestCommentInput = {
  body: string;
  isInternal?: boolean;
};

export type CancelServiceRequestInput = {
  reason?: string;
};

export type DynamicFieldValueInput = {
  fieldId: string;
  valueText?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueDate?: string;
  fileAttachmentId?: string;
};

export type CreateServiceRequestInput = {
  serviceId: string;
  unitId: string;
  description: string;
  priority?: string;
  attachmentIds?: string[];
  fieldValues?: DynamicFieldValueInput[];
};

export type CreateAccessQrInput = {
  unitId: string;
  type: string;
  usageMode?: 'SINGLE_USE' | 'MULTI_USE';
  visitorName?: string;
  validFrom?: string;
  validTo?: string;
  notes?: string;
  gates?: string[];
  permissions?: string[];
};

export type MobileBannersResponse = {
  data: MobileBanner[];
  meta: {
    total: number;
    unitId?: string | null;
    generatedAt?: string;
  };
};

export type FamilyAccessRow = {
  id: string;
  userId?: string;
  role?: string;
  status?: string;
  user?: {
    id?: string;
    email?: string | null;
    phone?: string | null;
    nameEN?: string | null;
    nameAR?: string | null;
    resident?: {
      id?: string;
      relationship?: string | null;
      nationalId?: string | null;
    } | null;
  } | null;
};

export type DelegateAccessRow = {
  id: string;
  unitId?: string;
  userId?: string;
  role?: string;
  status?: string;
  delegateType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  canViewFinancials?: boolean;
  canReceiveBilling?: boolean;
  canBookFacilities?: boolean;
  canGenerateQR?: boolean;
  canManageWorkers?: boolean;
  user?: {
    id?: string;
    email?: string | null;
    phone?: string | null;
    nameEN?: string | null;
    nameAR?: string | null;
  } | null;
};

export type ContractorRow = {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
};

export type WorkerRow = {
  id: string;
  unitId?: string;
  contractorId?: string;
  jobType?: string | null;
  status?: string;
  createdAt?: string;
  contractor?: {
    id?: string;
    name?: string;
    status?: string;
  } | null;
  accessProfile?: {
    id?: string;
    fullName?: string;
    nationalId?: string;
    phone?: string | null;
    status?: string;
  } | null;
};

export type CreateContractorInput = {
  unitId: string;
  name: string;
};

export type CreateWorkerInput = {
  unitId: string;
  contractorId: string;
  fullName: string;
  nationalId: string;
  phone?: string;
  photoId?: string;
  jobType?: string;
};

export type GenerateWorkerQrInput = {
  validFrom?: string;
  validTo?: string;
  gates?: string[];
  notes?: string;
};

export type AddFamilyMemberInput = {
  relationship: 'CHILD' | 'PARENT' | 'SPOUSE';
  name: string;
  email?: string;
  phone: string;
  personalPhotoId: string;
  nationalId?: string;
  nationalIdFileId?: string;
  birthDate?: string;
  birthCertificateFileId?: string;
  marriageCertificateFileId?: string;
};

export type UpdateFamilyMemberInput = {
  nameEN?: string;
  nameAR?: string;
  email?: string;
  phone?: string;
  nationalId?: string;
  profilePhotoId?: string;
  relationship?: string;
};

export type CreateDelegateByContactInput = {
  unitId: string;
  type: 'FAMILY' | 'FRIEND' | 'INTERIOR_DESIGNER';
  idFileId: string;
  name: string;
  email: string;
  phone: string;
  startsAt?: string;
  endsAt?: string;
  canViewFinancials?: boolean;
  canReceiveBilling?: boolean;
  canBookFacilities?: boolean;
  canGenerateQR?: boolean;
  canManageWorkers?: boolean;
};

export type UpdateDelegateAccessInput = {
  type?: 'FAMILY' | 'FRIEND' | 'INTERIOR_DESIGNER';
  startsAt?: string;
  endsAt?: string;
  canViewFinancials?: boolean;
  canReceiveBilling?: boolean;
  canBookFacilities?: boolean;
  canGenerateQR?: boolean;
  canManageWorkers?: boolean;
};

export type FireEvacuationStatus = {
  active: boolean;
  targeted?: boolean;
  titleEn?: string;
  messageEn?: string;
  messageAr?: string;
  triggeredAt?: string | null;
  resolvedAt?: string | null;
  acknowledged?: boolean;
  acknowledgedAt?: string | null;
  needsHelp?: boolean;
  counters?: {
    totalRecipients?: number;
    pending?: number;
    needHelp?: number;
  };
};

export type HelpCenterEntry = {
  id: string;
  title: string;
  phone: string;
  availability?: string | null;
  priority?: number;
  isActive?: boolean;
};

export type DiscoverPlace = {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  mapLink?: string | null;
  phone?: string | null;
  workingHours?: string | null;
  imageFileId?: string | null;
  isActive?: boolean;
};

export type CreateRentRequestInput = {
  unitId: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantNationalId?: string;
  tenantNationality?: 'EGYPTIAN' | 'FOREIGN';
  tenantNationalIdFileId?: string;
  contractFileId: string;
};

export type RentRequestRow = {
  id: string;
  ownerUserId: string;
  unitId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantNationalId?: string | null;
  rejectionReason?: string | null;
  approvedLeaseId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  unit?: {
    id: string;
    unitNumber?: string | null;
    block?: string | null;
    projectName?: string | null;
    status?: string | null;
  };
};

export type ViolationActionRow = {
  id: string;
  violationId: string;
  requestedById: string;
  type: 'APPEAL' | 'FIX_SUBMISSION' | string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED' | string;
  note?: string | null;
  rejectionReason?: string | null;
  attachmentIds?: string[];
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | string;

export type FamilyRelationType = 'SON_DAUGHTER' | 'MOTHER_FATHER' | 'SPOUSE';

export type NationalityType = 'EGYPTIAN' | 'FOREIGN';

export type FamilyRequestRow = {
  id: string;
  unitId: string;
  ownerUserId: string;
  relationship: FamilyRelationType;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  nationality?: NationalityType;
  nationalIdOrPassport?: string | null;
  childAgeBracket?: '<16' | '>=16' | string | null;
  status: HouseholdRequestStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type AuthorizedRequestRow = {
  id: string;
  unitId: string;
  ownerUserId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  nationality?: NationalityType;
  nationalIdOrPassport?: string | null;
  validFrom: string;
  validTo: string;
  feeMode?: 'NO_FEE' | 'FEE_REQUIRED' | string;
  feeAmount?: number | string | null;
  status: HouseholdRequestStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type HomeStaffAccessRow = {
  id: string;
  unitId: string;
  ownerUserId: string;
  fullName: string;
  phone?: string | null;
  nationality?: NationalityType;
  nationalIdOrPassport?: string | null;
  staffType?: 'DRIVER' | 'NANNY' | 'SERVANT' | 'GARDENER' | 'OTHER' | string | null;
  employmentDuration?: string | null;
  isLiveIn?: boolean;
  accessValidFrom?: string | null;
  accessValidTo?: string | null;
  status: HouseholdRequestStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type HouseholdRequestsResponse = {
  family: FamilyRequestRow[];
  authorized: AuthorizedRequestRow[];
  homeStaff: HomeStaffAccessRow[];
};

export type CreateFamilyRequestInput = {
  unitId: string;
  relationship: FamilyRelationType;
  fullName: string;
  email?: string;
  phone: string;
  nationality?: NationalityType;
  nationalIdOrPassport?: string;
  personalPhotoFileId: string;
  nationalIdFileId?: string;
  passportFileId?: string;
  birthCertificateFileId?: string;
  marriageCertificateFileId?: string;
  childAgeBracket?: '<16' | '>=16';
  featurePermissions?: Record<string, boolean>;
};

export type CreateAuthorizedRequestInput = {
  unitId: string;
  fullName: string;
  phone: string;
  email?: string;
  nationality?: NationalityType;
  nationalIdOrPassport?: string;
  idOrPassportFileId: string;
  powerOfAttorneyFileId: string;
  personalPhotoFileId: string;
  validFrom: string;
  validTo: string;
  feeMode?: 'NO_FEE' | 'FEE_REQUIRED';
  feeAmount?: number;
  delegatePermissions?: Record<string, boolean>;
};

export type CreateHomeStaffInput = {
  unitId: string;
  fullName: string;
  phone: string;
  nationality?: NationalityType;
  nationalIdOrPassport?: string;
  idOrPassportFileId: string;
  personalPhotoFileId?: string;
  staffType?: 'DRIVER' | 'NANNY' | 'SERVANT' | 'GARDENER' | 'OTHER';
  employmentDuration?: string;
  liveIn?: boolean;
  accessFrom: string;
  accessTo: string;
};
