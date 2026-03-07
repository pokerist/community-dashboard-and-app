import { BillingCycle, BookingStatus, FacilityType, InvoiceStatus } from "@prisma/client";
import apiClient from "./api-client";

export type FacilityListItem = {
  id: string;
  name: string;
  type: FacilityType;
  description: string | null;
  iconName: string | null;
  color: string | null;
  rules: string | null;
  isActive: boolean;
  isBookable: boolean;
  requiresPrepayment: boolean;
  capacity: number | null;
  price: number | null;
  billingCycle: BillingCycle;
  reminderMinutesBefore: number | null;
  maxReservationsPerDay: number | null;
  cooldownMinutes: number | null;
  slotCount: number;
  upcomingBookingsToday: number;
  createdAt: string;
  updatedAt: string;
};

export type FacilitySlotConfigItem = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  slotCapacity: number | null;
};

export type FacilitySlotExceptionItem = {
  id: string;
  date: string;
  isClosed: boolean;
  startTime: string | null;
  endTime: string | null;
  slotDurationMinutes: number | null;
  slotCapacity: number | null;
};

export type FacilityDetail = FacilityListItem & {
  slotConfig: FacilitySlotConfigItem[];
  slotExceptions: FacilitySlotExceptionItem[];
  bookingStats: {
    totalBookings: number;
    pendingBookings: number;
    revenueThisMonth: number;
  };
};

export type FacilityAvailableSlot = {
  startTime: string;
  endTime: string;
  status: "AVAILABLE" | "BOOKED" | "CLOSED";
  bookingId: string | null;
};

export type FacilityAvailableSlotsResponse = {
  date: string;
  slots: FacilityAvailableSlot[];
};

export type AmenityStats = {
  totalFacilities: number;
  activeFacilities: number;
  bookingsToday: number;
  pendingApprovals: number;
  revenueThisMonth: number;
  bookingsByFacility: Array<{
    facilityId: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  bookingsByStatus: Record<BookingStatus, number>;
};

export type BookingListItem = {
  id: string;
  facilityName: string;
  facilityType: FacilityType;
  userName: string;
  unitNumber: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalAmount: number | null;
  requiresPrepayment: boolean;
  paymentStatus: InvoiceStatus | string | null;
  createdAt: string;
};

export type BookingListResponse = {
  data: BookingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type BookingDetailInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus | string;
  dueDate: string;
  paidDate: string | null;
};

export type BookingDetail = BookingListItem & {
  facilityId: string;
  facilityDescription: string | null;
  facilityRules: string | null;
  userId: string;
  userPhone: string | null;
  cancellationReason: string | null;
  rejectionReason: string | null;
  cancelledById: string | null;
  rejectedById: string | null;
  checkedInAt: string | null;
  cancelledAt: string | null;
  refundRequired: boolean;
  invoices: BookingDetailInvoice[];
  updatedAt: string;
};

export type CreateFacilityPayload = {
  name: string;
  description?: string;
  type: FacilityType;
  capacity?: number;
  price?: number;
  billingCycle?: BillingCycle;
  requiresPrepayment?: boolean;
  maxReservationsPerDay?: number;
  cooldownMinutes?: number;
  reminderMinutesBefore?: number;
  iconName?: string;
  color?: string;
  rules?: string;
};

export type UpsertSlotConfigPayload = {
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  slotCapacity?: number;
};

export type AddSlotExceptionPayload = {
  date: string;
  isClosed: boolean;
  startTime?: string;
  endTime?: string;
  slotDurationMinutes?: number;
  slotCapacity?: number;
};

export type ListBookingsParams = {
  page?: number;
  limit?: number;
  search?: string;
  facilityId?: string;
  status?: BookingStatus;
  userId?: string;
  unitId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const amenitiesService = {
  async listFacilities(includeInactive = false): Promise<FacilityListItem[]> {
    const response = await apiClient.get<FacilityListItem[]>("/facilities", {
      params: { includeInactive },
    });
    return response.data;
  },

  async getAmenityStats(): Promise<AmenityStats> {
    const response = await apiClient.get<AmenityStats>("/facilities/stats");
    return response.data;
  },

  async getFacilityDetail(id: string): Promise<FacilityDetail> {
    const response = await apiClient.get<FacilityDetail>(`/facilities/${id}`);
    return response.data;
  },

  async createFacility(payload: CreateFacilityPayload): Promise<FacilityDetail> {
    const response = await apiClient.post<FacilityDetail>("/facilities", payload);
    return response.data;
  },

  async updateFacility(id: string, payload: Partial<CreateFacilityPayload>): Promise<FacilityDetail> {
    const response = await apiClient.patch<FacilityDetail>(`/facilities/${id}`, payload);
    return response.data;
  },

  async toggleFacility(id: string): Promise<FacilityDetail> {
    const response = await apiClient.patch<FacilityDetail>(`/facilities/${id}/toggle`);
    return response.data;
  },

  async upsertSlotConfig(
    facilityId: string,
    dayOfWeek: number,
    payload: UpsertSlotConfigPayload,
  ): Promise<FacilitySlotConfigItem> {
    const response = await apiClient.put<FacilitySlotConfigItem>(
      `/facilities/${facilityId}/slots/${dayOfWeek}`,
      payload,
    );
    return response.data;
  },

  async removeSlotConfig(id: string): Promise<FacilitySlotConfigItem> {
    const response = await apiClient.delete<FacilitySlotConfigItem>(`/facilities/slots/${id}`);
    return response.data;
  },

  async addSlotException(
    facilityId: string,
    payload: AddSlotExceptionPayload,
  ): Promise<FacilitySlotExceptionItem> {
    const response = await apiClient.post<FacilitySlotExceptionItem>(
      `/facilities/${facilityId}/exceptions`,
      payload,
    );
    return response.data;
  },

  async removeSlotException(id: string): Promise<FacilitySlotExceptionItem> {
    const response = await apiClient.delete<FacilitySlotExceptionItem>(`/facilities/exceptions/${id}`);
    return response.data;
  },

  async getAvailableSlots(facilityId: string, date?: string): Promise<FacilityAvailableSlotsResponse> {
    const response = await apiClient.get<FacilityAvailableSlotsResponse>(
      `/facilities/${facilityId}/available-slots`,
      { params: { date } },
    );
    return response.data;
  },

  async listBookings(params: ListBookingsParams = {}): Promise<BookingListResponse> {
    const response = await apiClient.get<BookingListResponse>("/bookings", { params });
    return response.data;
  },

  async getBookingDetail(id: string): Promise<BookingDetail> {
    const response = await apiClient.get<BookingDetail>(`/bookings/${id}`);
    return response.data;
  },

  async approveBooking(id: string): Promise<BookingDetail> {
    const response = await apiClient.post<BookingDetail>(`/bookings/${id}/approve`);
    return response.data;
  },

  async rejectBooking(id: string, reason: string): Promise<BookingDetail> {
    const response = await apiClient.post<BookingDetail>(`/bookings/${id}/reject`, { reason });
    return response.data;
  },

  async cancelBooking(id: string, reason: string): Promise<BookingDetail> {
    const response = await apiClient.post<BookingDetail>(`/bookings/${id}/cancel`, { reason });
    return response.data;
  },
};

export default amenitiesService;

