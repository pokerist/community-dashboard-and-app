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
};

export type ComplaintRow = {
  id: string;
  complaintNumber?: string;
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

export type AccessQrRow = {
  id: string;
  qrId?: string;
  type?: string;
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
  category: string;
  description: string;
  priority?: string;
  attachmentIds?: string[];
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
