import { http } from '../../lib/http';
import type {
  AccessQrRow,
  Booking,
  CommunityService,
  ComplaintRow,
  CreateAccessQrInput,
  CreateAccessQrResponse,
  CreateBookingInput,
  CreateComplaintInput,
  CreateContractorInput,
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
  DelegateAccessRow,
  DemoInvoicePaymentInput,
  DemoInvoicePaymentResponse,
  ContractorRow,
  WorkerRow,
  ViolationRow,
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

export async function listServices(accessToken: string) {
  const response = await http.get<CommunityService[]>('/services', {
    headers: authHeaders(accessToken),
    params: { status: 'active' },
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
  const response = await http.post<ComplaintRow>('/complaints', payload, {
    headers: authHeaders(accessToken),
  });
  return response.data;
}

export async function deleteComplaint(accessToken: string, complaintId: string) {
  await http.delete(`/complaints/${complaintId}`, {
    headers: authHeaders(accessToken),
  });
  return true;
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
