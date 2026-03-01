import { http } from '../../lib/http';
import type {
  AccessQrRow,
  AddServiceRequestCommentInput,
  Booking,
  CancelServiceRequestInput,
  CommunityService,
  ComplaintRow,
  ComplaintCommentRow,
  CreateAccessQrInput,
  CreateAccessQrResponse,
  CreateBookingInput,
  CreateComplaintInput,
  CreateContractorInput,
  CreateFamilyRequestInput,
  CreateAuthorizedRequestInput,
  CreateHomeStaffInput,
  CreateDelegateByContactInput,
  CreateServiceRequestInput,
  CreateWorkerInput,
  AddFamilyMemberInput,
  UpdateDelegateAccessInput,
  UpdateFamilyMemberInput,
  Facility,
  FamilyAccessRow,
  GenerateWorkerQrInput,
  InvoiceRow,
  MobileBannersResponse,
  PaginatedResponse,
  ResidentUnit,
  ServiceRequestRow,
  ServiceRequestCommentRow,
  DelegateAccessRow,
  DemoInvoicePaymentInput,
  DemoInvoicePaymentResponse,
  ContractorRow,
  WorkerRow,
  ViolationRow,
  FireEvacuationStatus,
  HelpCenterEntry,
  HouseholdRequestsResponse,
  DiscoverPlace,
  CreateRentRequestInput,
  RentRequestRow,
  ViolationActionRow,
} from './types';

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listMyUnits(accessToken: string) {
  const response = await http.get<PaginatedResponse<ResidentUnit>>('/units/my', {
    headers: authHeaders(accessToken),
    params: { page: 1, limit: 50 },
  });
  return response.data;
}

export async function listFacilities(accessToken: string) {
  const response = await http.get<Facility[]>('/facilities', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listMobileBanners(
  accessToken: string,
  options?: { unitId?: string | null },
) {
  const response = await http.get<MobileBannersResponse>('/banners/mobile-feed', {
    headers: authHeaders(accessToken),
    params: options?.unitId ? { unitId: options.unitId } : undefined,
  });
  return response.data;
}

export async function listMyBookings(accessToken: string) {
  const response = await http.get<Booking[]>('/bookings/me', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createBooking(
  accessToken: string,
  payload: CreateBookingInput,
) {
  const response = await http.post<Booking>('/bookings', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function cancelBooking(accessToken: string, bookingId: string) {
  const response = await http.patch<Booking>(
    `/bookings/${bookingId}/cancel`,
    {},
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listServices(
  accessToken: string,
  options?: { urgent?: boolean },
) {
  const response = await http.get<CommunityService[]>('/services', {
    headers: authHeaders(accessToken),
    params: {
      status: 'active',
      ...(options?.urgent === undefined ? {} : { urgent: String(options.urgent) }),
    },
  });
  return response.data;
}

export async function listMyServiceRequests(accessToken: string) {
  const response = await http.get<ServiceRequestRow[]>('/service-requests/my-requests', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createServiceRequest(
  accessToken: string,
  payload: CreateServiceRequestInput,
) {
  const response = await http.post<ServiceRequestRow>('/service-requests', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function getServiceRequestById(accessToken: string, requestId: string) {
  const response = await http.get<ServiceRequestRow>(`/service-requests/${requestId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listServiceRequestComments(accessToken: string, requestId: string) {
  const response = await http.get<ServiceRequestCommentRow[]>(`/service-requests/${requestId}/comments`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function addServiceRequestComment(
  accessToken: string,
  requestId: string,
  payload: AddServiceRequestCommentInput,
) {
  const response = await http.post<ServiceRequestCommentRow>(
    `/service-requests/${requestId}/comments`,
    payload,
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function cancelServiceRequest(
  accessToken: string,
  requestId: string,
  payload?: CancelServiceRequestInput,
) {
  const response = await http.patch<ServiceRequestRow>(
    `/service-requests/${requestId}/cancel`,
    payload ?? {},
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listMyComplaints(accessToken: string) {
  const response = await http.get<ComplaintRow[]>('/complaints/me', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createComplaint(
  accessToken: string,
  payload: CreateComplaintInput,
) {
  const response = await http.post<ComplaintRow>(
    '/complaints',
    {
      unitId: payload.unitId,
      title: payload.title?.trim(),
      team: payload.team?.trim(),
      category: payload.team?.trim() || 'GENERAL',
      description: payload.body?.trim(),
    },
    {
      headers: authHeaders(accessToken),
    },
  );
  return response.data;
}

export async function deleteComplaint(accessToken: string, complaintId: string) {
  await http.delete(`/complaints/${complaintId}`, {
    headers: authHeaders(accessToken),
  });
  return true;
}

export async function listComplaintComments(accessToken: string, complaintId: string) {
  const response = await http.get<ComplaintCommentRow[]>(`/complaints/${complaintId}/comments`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function addComplaintComment(
  accessToken: string,
  complaintId: string,
  payload: { body: string },
) {
  const response = await http.post<ComplaintCommentRow>(
    `/complaints/${complaintId}/comments`,
    payload,
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listAccessQrs(
  accessToken: string,
  options?: { unitId?: string; includeInactive?: boolean },
) {
  const response = await http.get<AccessQrRow[]>('/access-qrcodes', {
    headers: authHeaders(accessToken),
    params: {
      unitId: options?.unitId,
      includeInactive: options?.includeInactive ?? true,
    },
  });
  return response.data;
}

export async function createAccessQr(
  accessToken: string,
  payload: CreateAccessQrInput,
) {
  const response = await http.post<CreateAccessQrResponse>('/access-qrcodes', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function revokeAccessQr(accessToken: string, qrCodeId: string) {
  const response = await http.patch<AccessQrRow>(
    `/access-qrcodes/${qrCodeId}/revoke`,
    {},
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listMyInvoices(accessToken: string) {
  const response = await http.get<InvoiceRow[]>('/invoices/me', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function simulateInvoiceSelfPayment(
  accessToken: string,
  invoiceId: string,
  payload: DemoInvoicePaymentInput,
) {
  const response = await http.post<DemoInvoicePaymentResponse>(
    `/invoices/${invoiceId}/pay/simulate-self`,
    payload,
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listMyViolations(accessToken: string) {
  const response = await http.get<ViolationRow[]>('/violations/me', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listViolationActions(
  accessToken: string,
  violationId: string,
) {
  const response = await http.get<ViolationActionRow[]>(
    `/violations/${violationId}/actions`,
    {
      headers: authHeaders(accessToken),
    },
  );
  return response.data;
}

export async function submitViolationAction(
  accessToken: string,
  violationId: string,
  payload: {
    type: 'APPEAL' | 'FIX_SUBMISSION';
    note?: string;
    attachmentIds?: string[];
  },
) {
  const response = await http.post<ViolationActionRow>(
    `/violations/${violationId}/actions`,
    payload,
    {
      headers: authHeaders(accessToken),
    },
  );
  return response.data;
}

export async function listFamilyMembers(accessToken: string, unitId: string) {
  const response = await http.get<FamilyAccessRow[]>(`/owners/family/${unitId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function addFamilyMember(
  accessToken: string,
  unitId: string,
  payload: AddFamilyMemberInput,
  options?: { targetResidentId?: string },
) {
  const response = await http.post(
    `/owners/family/${unitId}`,
    payload,
    {
      headers: authHeaders(accessToken),
      params: options?.targetResidentId
        ? { targetResidentId: options.targetResidentId }
        : undefined,
    },
  );
  return response.data;
}

export async function removeFamilyMemberFromUnit(
  accessToken: string,
  unitId: string,
  userId: string,
) {
  const response = await http.post<{ message?: string }>(
    `/owners/units/${unitId}/remove-user/${userId}`,
    {},
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function updateFamilyMemberProfile(
  accessToken: string,
  familyUserId: string,
  payload: UpdateFamilyMemberInput,
) {
  const response = await http.patch(
    `/owners/family/${familyUserId}`,
    payload,
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listDelegatesForUnit(accessToken: string, unitId: string) {
  const response = await http.get<DelegateAccessRow[]>(`/delegates/unit/${unitId}`, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function updateDelegateAccess(
  accessToken: string,
  delegateAccessId: string,
  payload: UpdateDelegateAccessInput,
) {
  const response = await http.patch<DelegateAccessRow>(
    `/delegates/${delegateAccessId}`,
    {
      type: payload.type,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      canViewFinancials: payload.canViewFinancials,
      canReceiveBilling: payload.canReceiveBilling,
      canBookFacilities: payload.canBookFacilities,
      canGenerateQR: payload.canGenerateQR,
      canManageWorkers: payload.canManageWorkers,
    },
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function revokeDelegate(accessToken: string, delegateAccessId: string) {
  const response = await http.post<DelegateAccessRow>(
    `/delegates/${delegateAccessId}/revoke`,
    {},
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function createDelegateRequestByContact(
  accessToken: string,
  payload: CreateDelegateByContactInput,
) {
  const response = await http.post<DelegateAccessRow>(
    '/delegates/request-by-contact',
    payload,
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function listContractors(accessToken: string, unitId?: string) {
  const response = await http.get<ContractorRow[]>('/contractors', {
    headers: authHeaders(accessToken),
    params: unitId ? { unitId } : undefined,
  });
  return response.data;
}

export async function createContractor(
  accessToken: string,
  payload: CreateContractorInput,
) {
  const response = await http.post<ContractorRow>('/contractors', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listWorkers(accessToken: string, unitId: string) {
  const response = await http.get<WorkerRow[]>('/workers', {
    headers: authHeaders(accessToken),
    params: { unitId },
  });
  return response.data;
}

export async function createWorker(accessToken: string, payload: CreateWorkerInput) {
  const response = await http.post<WorkerRow>('/workers', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function generateWorkerQr(
  accessToken: string,
  workerId: string,
  payload?: GenerateWorkerQrInput,
) {
  const response = await http.post<{ qrCode?: AccessQrRow; qrImageBase64?: string | null }>(
    `/workers/${workerId}/qr`,
    payload ?? {},
    { headers: authHeaders(accessToken) },
  );
  return response.data;
}

export async function getMyFireEvacuationStatus(accessToken: string) {
  const response = await http.get<FireEvacuationStatus>('/fire-evacuation/me', {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function acknowledgeFireEvacuation(accessToken: string) {
  const response = await http.post<FireEvacuationStatus>(
    '/fire-evacuation/me/ack',
    {},
    {
      headers: authHeaders(accessToken),
    },
  );
  return response.data;
}

export async function listHelpCenterEntries(accessToken: string) {
  const response = await http.get<HelpCenterEntry[]>('/help-center', {
    headers: authHeaders(accessToken),
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function listDiscoverPlaces(accessToken: string) {
  const response = await http.get<DiscoverPlace[]>('/discover', {
    headers: authHeaders(accessToken),
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function createRentRequest(
  accessToken: string,
  payload: CreateRentRequestInput,
) {
  const response = await http.post<RentRequestRow>('/rent-requests', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function listMyRentRequests(accessToken: string) {
  const response = await http.get<RentRequestRow[]>('/rent-requests/my', {
    headers: authHeaders(accessToken),
  });
  return Array.isArray(response.data) ? response.data : [];
}

export async function listHouseholdRequests(
  accessToken: string,
  options?: { unitId?: string | null },
) {
  const response = await http.get<HouseholdRequestsResponse>('/household/my-requests', {
    headers: authHeaders(accessToken),
    params: options?.unitId ? { unitId: options.unitId } : undefined,
  });
  return response.data;
}

export async function createFamilyRequest(
  accessToken: string,
  payload: CreateFamilyRequestInput,
) {
  const response = await http.post('/household/family-requests', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createAuthorizedRequest(
  accessToken: string,
  payload: CreateAuthorizedRequestInput,
) {
  const response = await http.post('/household/authorized-requests', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function createHomeStaffAccess(
  accessToken: string,
  payload: CreateHomeStaffInput,
) {
  const response = await http.post('/household/home-staff', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}
