import { useEffect, useMemo, useState } from "react";
import { BillingCycle, BookingStatus, FacilityType } from "@prisma/client";
import { Check, Dumbbell, Edit2, Eye, Plus, Search, Waves, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "../DataTable";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";
import { SkeletonTable } from "../SkeletonTable";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { cn } from "../ui/utils";
import amenitiesService, {
  type AmenityStats,
  type BookingDetail,
  type BookingListItem,
  type FacilityDetail,
  type FacilityListItem,
} from "../../lib/amenitiesService";

type MainTab = "facilities" | "bookings";
type ManageTab = "overview" | "schedule" | "exceptions" | "bookings";

type FacilityFormState = {
  name: string;
  type: FacilityType;
  description: string;
  iconName: string;
  color: string;
  capacity: string;
  billingCycle: BillingCycle;
  price: string;
  maxReservationsPerDay: string;
  requiresPrepayment: boolean;
  reminderMinutesBefore: string;
  cooldownMinutes: string;
  rules: string;
};

type SlotEditState = {
  startTime: string;
  endTime: string;
  slotDurationMinutes: string;
  slotCapacity: string;
};

type ExceptionFormState = {
  date: string;
  isClosed: boolean;
  startTime: string;
  endTime: string;
  slotDurationMinutes: string;
  slotCapacity: string;
};

const COLOR_PRESETS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#F97316", "#14B8A6", "#F43F5E"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPTY_FACILITY_FORM: FacilityFormState = {
  name: "",
  type: FacilityType.CUSTOM,
  description: "",
  iconName: "",
  color: COLOR_PRESETS[0],
  capacity: "",
  billingCycle: BillingCycle.NONE,
  price: "",
  maxReservationsPerDay: "",
  requiresPrepayment: false,
  reminderMinutesBefore: "",
  cooldownMinutes: "",
  rules: "",
};

const EMPTY_SLOT_EDIT: SlotEditState = {
  startTime: "08:00",
  endTime: "22:00",
  slotDurationMinutes: "60",
  slotCapacity: "",
};

const EMPTY_EXCEPTION: ExceptionFormState = {
  date: "",
  isClosed: false,
  startTime: "",
  endTime: "",
  slotDurationMinutes: "",
  slotCapacity: "",
};

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function formatDateTime(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function parseOptionalInt(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
}

function parseOptionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function billingLabel(price: number | null, billingCycle: BillingCycle): string {
  if (!price || billingCycle === BillingCycle.NONE) return "Free";
  if (billingCycle === BillingCycle.PER_HOUR) return `EGP ${price}/hr`;
  if (billingCycle === BillingCycle.PER_SLOT) return `EGP ${price}/slot`;
  if (billingCycle === BillingCycle.PER_USE) return `EGP ${price}/use`;
  return `EGP ${price}`;
}

function amountLabel(value: number | null): string {
  if (value === null) return "Free";
  return `EGP ${value.toLocaleString()}`;
}

function borderClass(color: string | null): string {
  const normalized = (color ?? "").toLowerCase();
  if (normalized === "#10b981") return "border-l-emerald-500";
  if (normalized === "#f59e0b") return "border-l-amber-500";
  if (normalized === "#ef4444") return "border-l-red-500";
  if (normalized === "#8b5cf6") return "border-l-violet-500";
  if (normalized === "#f97316") return "border-l-orange-500";
  if (normalized === "#14b8a6") return "border-l-teal-500";
  if (normalized === "#f43f5e") return "border-l-rose-500";
  return "border-l-blue-500";
}

function iconForType(type: FacilityType) {
  if (type === FacilityType.POOL) return Waves;
  return Dumbbell;
}

export function AmenitiesManagement() {
  const [tab, setTab] = useState<MainTab>("facilities");

  const [stats, setStats] = useState<AmenityStats | null>(null);
  const [facilities, setFacilities] = useState<FacilityListItem[]>([]);
  const [facilityDetails, setFacilityDetails] = useState<Record<string, FacilityDetail>>({});
  const [facilitiesLoading, setFacilitiesLoading] = useState<boolean>(true);

  const [facilityDrawerOpen, setFacilityDrawerOpen] = useState<boolean>(false);
  const [editingFacilityId, setEditingFacilityId] = useState<string | null>(null);
  const [facilityForm, setFacilityForm] = useState<FacilityFormState>(EMPTY_FACILITY_FORM);

  const [manageDrawerOpen, setManageDrawerOpen] = useState<boolean>(false);
  const [manageFacilityId, setManageFacilityId] = useState<string | null>(null);
  const [manageTab, setManageTab] = useState<ManageTab>("overview");
  const [slotEditDay, setSlotEditDay] = useState<number | null>(null);
  const [slotEdit, setSlotEdit] = useState<SlotEditState>(EMPTY_SLOT_EDIT);
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(EMPTY_EXCEPTION);

  const [manageBookings, setManageBookings] = useState<BookingListItem[]>([]);
  const [manageBookingsLoading, setManageBookingsLoading] = useState<boolean>(false);
  const [manageBookingStatus, setManageBookingStatus] = useState<string>("ALL");

  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [bookingSearch, setBookingSearch] = useState<string>("");
  const [bookingFacilityId, setBookingFacilityId] = useState<string>("ALL");
  const [bookingStatus, setBookingStatus] = useState<string>("ALL");
  const [bookingDateFrom, setBookingDateFrom] = useState<string>("");
  const [bookingDateTo, setBookingDateTo] = useState<string>("");
  const [bookingPage, setBookingPage] = useState<number>(1);
  const [bookingTotal, setBookingTotal] = useState<number>(0);
  const [bookingTotalPages, setBookingTotalPages] = useState<number>(1);

  const [bookingDetailOpen, setBookingDetailOpen] = useState<boolean>(false);
  const [bookingDetail, setBookingDetail] = useState<BookingDetail | null>(null);
  const [showRejectInput, setShowRejectInput] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  const managedFacility = useMemo(
    () => (manageFacilityId ? facilityDetails[manageFacilityId] ?? null : null),
    [facilityDetails, manageFacilityId],
  );

  const loadStats = async (): Promise<void> => {
    const response = await amenitiesService.getAmenityStats();
    setStats(response);
  };

  const loadFacilities = async (): Promise<void> => {
    setFacilitiesLoading(true);
    try {
      const [list] = await Promise.all([amenitiesService.listFacilities(true), loadStats()]);
      setFacilities(list);

      const details = await Promise.all(
        list.map(async (facility) => {
          try {
            const detail = await amenitiesService.getFacilityDetail(facility.id);
            return [facility.id, detail] as const;
          } catch {
            return [facility.id, null] as const;
          }
        }),
      );

      const nextMap: Record<string, FacilityDetail> = {};
      details.forEach(([id, detail]) => {
        if (detail) nextMap[id] = detail;
      });
      setFacilityDetails(nextMap);
    } catch {
      toast.error("Failed to load facilities");
    } finally {
      setFacilitiesLoading(false);
    }
  };

  const loadBookings = async (): Promise<void> => {
    setBookingsLoading(true);
    try {
      const response = await amenitiesService.listBookings({
        page: bookingPage,
        limit: 25,
        search: bookingSearch || undefined,
        facilityId: bookingFacilityId === "ALL" ? undefined : bookingFacilityId,
        status: bookingStatus === "ALL" ? undefined : (bookingStatus as BookingStatus),
        dateFrom: bookingDateFrom ? new Date(bookingDateFrom).toISOString() : undefined,
        dateTo: bookingDateTo ? new Date(`${bookingDateTo}T23:59:59`).toISOString() : undefined,
      });
      setBookings(response.data);
      setBookingTotal(response.total);
      setBookingTotalPages(response.totalPages);
      await loadStats();
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "facilities") {
      void loadFacilities();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === "bookings") {
      void loadBookings();
    }
  }, [tab, bookingPage, bookingSearch, bookingFacilityId, bookingStatus, bookingDateFrom, bookingDateTo]);

  const openCreateFacility = (): void => {
    setEditingFacilityId(null);
    setFacilityForm(EMPTY_FACILITY_FORM);
    setFacilityDrawerOpen(true);
  };

  const openEditFacility = async (facilityId: string): Promise<void> => {
    try {
      const detail = await amenitiesService.getFacilityDetail(facilityId);
      setFacilityDetails((prev) => ({ ...prev, [facilityId]: detail }));
      setEditingFacilityId(facilityId);
      setFacilityForm({
        name: detail.name,
        type: detail.type,
        description: detail.description ?? "",
        iconName: detail.iconName ?? "",
        color: detail.color ?? COLOR_PRESETS[0],
        capacity: detail.capacity?.toString() ?? "",
        billingCycle: detail.billingCycle,
        price: detail.price?.toString() ?? "",
        maxReservationsPerDay: detail.maxReservationsPerDay?.toString() ?? "",
        requiresPrepayment: detail.requiresPrepayment,
        reminderMinutesBefore: detail.reminderMinutesBefore?.toString() ?? "",
        cooldownMinutes: detail.cooldownMinutes?.toString() ?? "",
        rules: detail.rules ?? "",
      });
      setFacilityDrawerOpen(true);
    } catch {
      toast.error("Failed to load facility");
    }
  };

  const saveFacility = async (): Promise<void> => {
    if (!facilityForm.name.trim()) {
      toast.error("Facility name is required");
      return;
    }

    const payload = {
      name: facilityForm.name.trim(),
      type: facilityForm.type,
      description: facilityForm.description.trim() || undefined,
      iconName: facilityForm.iconName.trim() || undefined,
      color: facilityForm.color || undefined,
      capacity: parseOptionalInt(facilityForm.capacity),
      billingCycle: facilityForm.billingCycle,
      price: facilityForm.billingCycle === BillingCycle.NONE ? undefined : parseOptionalNumber(facilityForm.price),
      maxReservationsPerDay: parseOptionalInt(facilityForm.maxReservationsPerDay),
      requiresPrepayment: facilityForm.requiresPrepayment,
      reminderMinutesBefore: parseOptionalInt(facilityForm.reminderMinutesBefore),
      cooldownMinutes: parseOptionalInt(facilityForm.cooldownMinutes),
      rules: facilityForm.rules.trim() || undefined,
    };

    try {
      if (editingFacilityId) {
        await amenitiesService.updateFacility(editingFacilityId, payload);
      } else {
        await amenitiesService.createFacility(payload);
      }
      setFacilityDrawerOpen(false);
      await loadFacilities();
      toast.success("Facility saved");
    } catch {
      toast.error("Failed to save facility");
    }
  };

  const toggleFacility = async (facilityId: string): Promise<void> => {
    try {
      await amenitiesService.toggleFacility(facilityId);
      await loadFacilities();
      toast.success("Facility status updated");
    } catch {
      toast.error("Failed to update facility");
    }
  };

  const openManageDrawer = async (facilityId: string): Promise<void> => {
    try {
      const detail = await amenitiesService.getFacilityDetail(facilityId);
      setFacilityDetails((prev) => ({ ...prev, [facilityId]: detail }));
      setManageFacilityId(facilityId);
      setManageTab("overview");
      setSlotEditDay(null);
      setSlotEdit(EMPTY_SLOT_EDIT);
      setExceptionForm(EMPTY_EXCEPTION);
      setManageDrawerOpen(true);
    } catch {
      toast.error("Failed to load facility details");
    }
  };

  const refreshManagedFacility = async (): Promise<void> => {
    if (!manageFacilityId) return;
    const detail = await amenitiesService.getFacilityDetail(manageFacilityId);
    setFacilityDetails((prev) => ({ ...prev, [manageFacilityId]: detail }));
  };

  const loadManageBookings = async (): Promise<void> => {
    if (!manageFacilityId) return;
    setManageBookingsLoading(true);
    try {
      const response = await amenitiesService.listBookings({
        page: 1,
        limit: 50,
        facilityId: manageFacilityId,
        status: manageBookingStatus === "ALL" ? undefined : (manageBookingStatus as BookingStatus),
      });
      setManageBookings(response.data);
    } catch {
      toast.error("Failed to load facility bookings");
    } finally {
      setManageBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (manageDrawerOpen && manageTab === "bookings") {
      void loadManageBookings();
    }
  }, [manageDrawerOpen, manageTab, manageFacilityId, manageBookingStatus]);

  const bookingColumns = useMemo<DataTableColumn<BookingListItem>[]>(() => [
    { key: "facility", header: "Facility", className: "w-[180px]", render: (row) => <span>{row.facilityName}</span> },
    { key: "user", header: "User", className: "w-[160px]", render: (row) => <span>{row.userName}</span> },
    { key: "unit", header: "Unit", className: "w-[100px]", render: (row) => <span>{row.unitNumber ?? "-"}</span> },
    { key: "date", header: "Date", className: "w-[130px]", render: (row) => <span>{formatDate(row.date)}</span> },
    { key: "time", header: "Time Slot", className: "w-[130px]", render: (row) => <span>{row.startTime} - {row.endTime}</span> },
    { key: "amount", header: "Amount", className: "w-[130px] text-right", render: (row) => <span className={cn("block text-right font-['DM_Mono']", row.totalAmount === null ? "text-[#475569]" : "text-[#1E293B]")}>{amountLabel(row.totalAmount)}</span> },
    { key: "status", header: "Status", className: "w-[120px]", render: (row) => <StatusBadge value={row.status} /> },
    {
      key: "actions",
      header: "Actions",
      className: "w-[120px] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => void openBookingDetail(row.id)} className="inline-flex p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Eye className="w-4 h-4" /></button>
          {(row.status === BookingStatus.PENDING || row.status === BookingStatus.PENDING_PAYMENT) ? (
            <>
              <button type="button" onClick={() => void approveBooking(row.id)} className="inline-flex p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400"><Check className="w-4 h-4" /></button>
              <button type="button" onClick={() => void openBookingDetail(row.id)} className="inline-flex p-2 rounded-lg hover:bg-red-500/10 text-red-400"><X className="w-4 h-4" /></button>
            </>
          ) : null}
        </div>
      ),
    },
  ], []);

  const manageBookingColumns = useMemo<DataTableColumn<BookingListItem>[]>(() => [
    { key: "date", header: "Date", className: "w-[120px]", render: (row) => <span>{formatDate(row.date)}</span> },
    { key: "time", header: "Time", className: "w-[120px]", render: (row) => <span>{row.startTime} - {row.endTime}</span> },
    { key: "user", header: "User", className: "w-[160px]", render: (row) => <span>{row.userName}</span> },
    { key: "unit", header: "Unit", className: "w-[100px]", render: (row) => <span>{row.unitNumber ?? "-"}</span> },
    { key: "status", header: "Status", className: "w-[120px]", render: (row) => <StatusBadge value={row.status} /> },
    { key: "actions", header: "Actions", className: "w-[80px] text-right", render: (row) => <button type="button" onClick={() => void openBookingDetail(row.id)} className="inline-flex p-1.5 rounded hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Eye className="w-3.5 h-3.5" /></button> },
  ], []);

  const openBookingDetail = async (bookingId: string): Promise<void> => {
    try {
      const detail = await amenitiesService.getBookingDetail(bookingId);
      setBookingDetail(detail);
      setShowRejectInput(false);
      setRejectReason("");
      setBookingDetailOpen(true);
    } catch {
      toast.error("Failed to load booking detail");
    }
  };

  const approveBooking = async (bookingId: string): Promise<void> => {
    try {
      await amenitiesService.approveBooking(bookingId);
      await Promise.all([loadBookings(), loadFacilities(), loadManageBookings()]);
      if (bookingDetail?.id === bookingId) {
        const detail = await amenitiesService.getBookingDetail(bookingId);
        setBookingDetail(detail);
      }
      toast.success("Booking approved");
    } catch {
      toast.error("Failed to approve booking");
    }
  };

  const rejectBooking = async (bookingId: string): Promise<void> => {
    if (!rejectReason.trim()) {
      toast.error("Reject reason is required");
      return;
    }

    try {
      await amenitiesService.rejectBooking(bookingId, rejectReason.trim());
      await Promise.all([loadBookings(), loadFacilities(), loadManageBookings()]);
      if (bookingDetail?.id === bookingId) {
        const detail = await amenitiesService.getBookingDetail(bookingId);
        setBookingDetail(detail);
      }
      setShowRejectInput(false);
      setRejectReason("");
      toast.success("Booking rejected");
    } catch {
      toast.error("Failed to reject booking");
    }
  };

  const startEditDay = (dayOfWeek: number): void => {
    const existing = managedFacility?.slotConfig.find((item) => item.dayOfWeek === dayOfWeek);
    setSlotEditDay(dayOfWeek);
    setSlotEdit({
      startTime: existing?.startTime ?? "08:00",
      endTime: existing?.endTime ?? "22:00",
      slotDurationMinutes: existing?.slotDurationMinutes?.toString() ?? "60",
      slotCapacity: existing?.slotCapacity?.toString() ?? "",
    });
  };

  const saveDayConfig = async (): Promise<void> => {
    if (!manageFacilityId || slotEditDay === null) return;

    const slotDurationMinutes = parseOptionalInt(slotEdit.slotDurationMinutes);
    if (!slotDurationMinutes || slotDurationMinutes < 15) {
      toast.error("Slot duration must be at least 15 minutes");
      return;
    }

    try {
      await amenitiesService.upsertSlotConfig(manageFacilityId, slotEditDay, {
        startTime: slotEdit.startTime,
        endTime: slotEdit.endTime,
        slotDurationMinutes,
        slotCapacity: parseOptionalInt(slotEdit.slotCapacity),
      });
      await refreshManagedFacility();
      setSlotEditDay(null);
      toast.success("Slot configuration saved");
    } catch {
      toast.error("Failed to save slot configuration");
    }
  };

  const removeDayConfig = async (slotConfigId: string): Promise<void> => {
    try {
      await amenitiesService.removeSlotConfig(slotConfigId);
      await refreshManagedFacility();
      toast.success("Slot configuration removed");
    } catch {
      toast.error("Failed to remove slot configuration");
    }
  };

  const saveException = async (): Promise<void> => {
    if (!manageFacilityId || !exceptionForm.date) {
      toast.error("Exception date is required");
      return;
    }

    try {
      await amenitiesService.addSlotException(manageFacilityId, {
        date: new Date(exceptionForm.date).toISOString(),
        isClosed: exceptionForm.isClosed,
        startTime: exceptionForm.isClosed ? undefined : exceptionForm.startTime || undefined,
        endTime: exceptionForm.isClosed ? undefined : exceptionForm.endTime || undefined,
        slotDurationMinutes: exceptionForm.isClosed
          ? undefined
          : parseOptionalInt(exceptionForm.slotDurationMinutes),
        slotCapacity: exceptionForm.isClosed ? undefined : parseOptionalInt(exceptionForm.slotCapacity),
      });
      setExceptionForm(EMPTY_EXCEPTION);
      await refreshManagedFacility();
      toast.success("Exception saved");
    } catch {
      toast.error("Failed to save exception");
    }
  };

  const removeException = async (exceptionId: string): Promise<void> => {
    try {
      await amenitiesService.removeSlotException(exceptionId);
      await refreshManagedFacility();
      toast.success("Exception removed");
    } catch {
      toast.error("Failed to remove exception");
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F8FAFC] rounded-2xl p-8 space-y-6">
      <PageHeader variant="light" title="Amenities" description="Manage facilities and bookings" />

      <Tabs value={tab} onValueChange={(value) => setTab(value as MainTab)} className="space-y-6">
        <TabsList className="bg-white border border-[#E2E8F0] p-1 rounded-lg">
          <TabsTrigger value="facilities" className="text-[#334155]">Facilities</TabsTrigger>
          <TabsTrigger value="bookings" className="text-[#334155]">Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="facilities" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard variant="light" title="Total Facilities" value={String(stats?.totalFacilities ?? 0)} subtitle="All configured" icon="occupancy" />
            <StatCard variant="light" title="Active" value={String(stats?.activeFacilities ?? 0)} subtitle="Bookable now" icon="active-users" />
            <StatCard variant="light" title="Bookings Today" value={String(stats?.bookingsToday ?? 0)} subtitle="All facilities" icon="tickets" />
            <StatCard variant="light" title="Revenue This Month" value={`EGP ${(stats?.revenueThisMonth ?? 0).toLocaleString()}`} subtitle="Collected" icon="revenue" />
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium text-[#1E293B]">Facilities</h2>
                <p className="text-xs text-slate-500 mt-1">Visual cards with slot status and actions</p>
              </div>
              <button type="button" onClick={openCreateFacility} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><Plus className="w-4 h-4" />Add Facility</button>
            </div>

            {facilitiesLoading ? <SkeletonTable columns={4} variant="light" rows={6} /> : facilities.length === 0 ? <EmptyState variant="light" title="No facilities found" description="Create your first facility." /> : (
              <div className="grid grid-cols-3 gap-4">
                {facilities.map((facility) => {
                  const Icon = iconForType(facility.type);
                  const detail = facilityDetails[facility.id];
                  const configuredDays = new Set((detail?.slotConfig ?? []).map((slot) => slot.dayOfWeek));
                  return (
                    <div key={facility.id} className={cn("bg-white rounded-xl border border-[#E2E8F0] border-l-4 p-6", borderClass(facility.color))}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-blue-400" /></div><h3 className="text-sm font-medium text-[#1E293B]">{facility.name}</h3></div>
                        <span className="text-xs px-2 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">{facility.type}</span>
                      </div>
                      <p className="text-sm text-slate-400">Capacity: <span className="text-[#1E293B]">{facility.capacity ?? "-"}</span>  �  {billingLabel(facility.price, facility.billingCycle)}</p>
                      <div className="mt-3 flex items-center gap-2">{DAYS.map((label, index) => <div key={`${facility.id}-${label}`} className={cn("w-4 h-4 rounded-sm", configuredDays.has(index) ? "bg-blue-500/30" : "bg-[#F8FAFC]")} />)}</div>
                      <p className="text-xs text-slate-500 mt-3">{facility.upcomingBookingsToday} bookings today  �  {detail?.bookingStats.pendingBookings ?? 0} pending</p>
                      <div className="mt-4 flex items-center gap-2">
                        <button type="button" onClick={() => void openManageDrawer(facility.id)} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-xs font-medium px-3 py-2 rounded-lg">Manage Slots</button>
                        <button type="button" onClick={() => void openEditFacility(facility.id)} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-xs font-medium px-3 py-2 rounded-lg">Edit</button>
                        <button type="button" onClick={() => void toggleFacility(facility.id)} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-xs font-medium px-3 py-2 rounded-lg">Toggle</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard variant="light" title="Total Bookings" value={String((stats?.bookingsByStatus.PENDING ?? 0) + (stats?.bookingsByStatus.PENDING_PAYMENT ?? 0) + (stats?.bookingsByStatus.APPROVED ?? 0) + (stats?.bookingsByStatus.CANCELLED ?? 0) + (stats?.bookingsByStatus.REJECTED ?? 0))} subtitle="All statuses" icon="tickets" />
            <StatCard variant="light" title="Pending Approval" value={String(stats?.pendingApprovals ?? 0)} subtitle="Awaiting action" icon="complaints-open" />
            <StatCard variant="light" title="Approved Today" value={String(stats?.bookingsToday ?? 0)} subtitle="Daily activity" icon="active-users" />
            <StatCard variant="light" title="Revenue This Month" value={`EGP ${(stats?.revenueThisMonth ?? 0).toLocaleString()}`} subtitle="Collected" icon="revenue" />
          </div>

          <div className="bg-white rounded-xl border border-[#E2E8F0]">
            <div className="p-4 border-b border-[#E2E8F0] flex flex-row items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={bookingSearch} onChange={(event) => { setBookingSearch(event.target.value); setBookingPage(1); }} placeholder="Search user or unit..." className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1E293B] placeholder:text-[#475569] focus:outline-none focus:border-blue-500/50" />
              </div>
              <select value={bookingFacilityId} onChange={(event) => { setBookingFacilityId(event.target.value); setBookingPage(1); }} className="w-48 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none">
                <option value="ALL">All Facilities</option>
                {facilities.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
              </select>
              <select value={bookingStatus} onChange={(event) => { setBookingStatus(event.target.value); setBookingPage(1); }} className="w-40 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none">
                <option value="ALL">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
                <option value="APPROVED">APPROVED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <input type="date" value={bookingDateFrom} onChange={(event) => { setBookingDateFrom(event.target.value); setBookingPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50" />
              <input type="date" value={bookingDateTo} onChange={(event) => { setBookingDateTo(event.target.value); setBookingPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50" />
            </div>

            <div className="p-6">
              {bookingsLoading ? <SkeletonTable columns={8} variant="light" /> : <DataTable variant="light" columns={bookingColumns} rows={bookings} rowKey={(row) => row.id} emptyTitle="No bookings found" emptyDescription="Try adjusting filters." />}
            </div>

            <div className="px-6 pb-6 flex items-center justify-between">
              <p className="text-xs text-slate-500">Page {bookingPage} of {bookingTotalPages} ({bookingTotal} records)</p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={bookingPage <= 1} onClick={() => setBookingPage((previous) => Math.max(1, previous - 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Previous</button>
                <button type="button" disabled={bookingPage >= bookingTotalPages} onClick={() => setBookingPage((previous) => Math.min(bookingTotalPages, previous + 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={facilityDrawerOpen} onOpenChange={setFacilityDrawerOpen}>
        <DialogContent className="w-full max-w-[540px] bg-white border border-[#E2E8F0] p-0 overflow-hidden max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader className="px-6 py-5 border-b border-[#E2E8F0] flex-shrink-0">
            <DialogTitle className="text-lg font-semibold text-[#0F172A]">{editingFacilityId ? "Edit Facility" : "Add Facility"}</DialogTitle>
            <p className="text-sm text-[#64748B] mt-1">{editingFacilityId ? "Update facility details and settings" : "Create a new facility and configure availability"}</p>
          </DialogHeader>
          <div className="px-6 py-6 space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-4">Basic Info</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Facility Name</label>
                  <input value={facilityForm.name} onChange={(event) => setFacilityForm((prev) => ({ ...prev, name: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-blue-500/50" placeholder="e.g., Main Swimming Pool" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Type</label>
                  <select value={facilityForm.type} onChange={(event) => setFacilityForm((prev) => ({ ...prev, type: event.target.value as FacilityType }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none">
                    {Object.values(FacilityType).map((type) => <option key={type} value={type}>{type === "POOL" ? "Swimming Pool" : type === "GYM" ? "Gym" : type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Description</label>
                  <textarea value={facilityForm.description} onChange={(event) => setFacilityForm((prev) => ({ ...prev, description: event.target.value }))} className="w-full min-h-[80px] bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-blue-500/50" placeholder="Describe this facility..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Icon Name</label>
                  <input value={facilityForm.iconName} onChange={(event) => setFacilityForm((prev) => ({ ...prev, iconName: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-blue-500/50" placeholder="e.g., waves, dumbbell" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-3">Theme Color</label>
                  <p className="text-xs text-[#64748B] mb-3">Choose a color to identify this facility in the interface</p>
                  <div className="grid grid-cols-4 gap-3">
                    {COLOR_PRESETS.map((preset, idx) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFacilityForm((prev) => ({ ...prev, color: preset }))}
                        className={cn(
                          "h-10 rounded-lg border-2 transition-all",
                          facilityForm.color === preset
                            ? "border-[#0F172A] shadow-md scale-105"
                            : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                        )}
                        style={{ backgroundColor: preset }}
                        title={`Color: ${preset}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-4">Capacity & Pricing</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Max Capacity</label>
                  <input type="number" min={1} value={facilityForm.capacity} onChange={(event) => setFacilityForm((prev) => ({ ...prev, capacity: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" placeholder="e.g., 50" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Billing Type</label>
                  <select value={facilityForm.billingCycle} onChange={(event) => setFacilityForm((prev) => ({ ...prev, billingCycle: event.target.value as BillingCycle }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] appearance-none">
                    <option value={BillingCycle.NONE}>Free</option>
                    <option value={BillingCycle.PER_HOUR}>Per Hour</option>
                    <option value={BillingCycle.PER_SLOT}>Per Slot</option>
                    <option value={BillingCycle.PER_USE}>Per Use</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Price (EGP)</label>
                  <input type="number" min={0} value={facilityForm.price} disabled={facilityForm.billingCycle === BillingCycle.NONE} onChange={(event) => setFacilityForm((prev) => ({ ...prev, price: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] disabled:opacity-50" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#334155] mb-2">Max Bookings/Day</label>
                  <input type="number" min={1} value={facilityForm.maxReservationsPerDay} onChange={(event) => setFacilityForm((prev) => ({ ...prev, maxReservationsPerDay: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" placeholder="Per resident" />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm text-[#334155]">Requires Prepayment</span>
                  <button type="button" onClick={() => setFacilityForm((prev) => ({ ...prev, requiresPrepayment: !prev.requiresPrepayment }))} className={cn("relative w-11 h-6 rounded-full border transition-colors", facilityForm.requiresPrepayment ? "bg-emerald-500/20 border-emerald-500/30" : "bg-[#F8FAFC] border-[#CBD5E1]")}>
                    <span className={cn("absolute top-0.5 w-5 h-5 rounded-full transition-all", facilityForm.requiresPrepayment ? "left-5 bg-emerald-400" : "left-0.5 bg-slate-500")} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-2">Reminder Before (min)</label>
                    <input type="number" min={0} value={facilityForm.reminderMinutesBefore} onChange={(event) => setFacilityForm((prev) => ({ ...prev, reminderMinutesBefore: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" placeholder="15" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#334155] mb-2">Cooldown (min)</label>
                    <input type="number" min={0} value={facilityForm.cooldownMinutes} onChange={(event) => setFacilityForm((prev) => ({ ...prev, cooldownMinutes: event.target.value }))} className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" placeholder="0" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] uppercase tracking-wider mb-3">Rules & Policies</label>
              <textarea value={facilityForm.rules} onChange={(event) => setFacilityForm((prev) => ({ ...prev, rules: event.target.value }))} className="w-full min-h-[80px] bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" placeholder="Enter any rules or policies for this facility..." />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs text-amber-800"><span className="font-medium">💡 Tip:</span> Configure time slots and exceptions after creating the facility.</p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={() => setFacilityDrawerOpen(false)} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg transition-colors">Cancel</button>
            <button type="button" onClick={() => void saveFacility()} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">Save Facility</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DrawerForm open={manageDrawerOpen} onOpenChange={setManageDrawerOpen} title={managedFacility ? `Manage ${managedFacility.name}` : "Manage Slots"} description="Configure time slots, exceptions, and schedules" widthClassName="w-full sm:max-w-[640px]" variant="light">
        {!managedFacility ? <EmptyState variant="light" compact title="No facility selected" description="Select a facility first." /> : (
          <div className="space-y-4">
            <Tabs value={manageTab} onValueChange={(value) => setManageTab(value as ManageTab)} className="space-y-4">
              <TabsList className="bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg">
                <TabsTrigger value="overview" className="text-[#334155]">Overview</TabsTrigger>
                <TabsTrigger value="schedule" className="text-[#334155]">Slot Schedule</TabsTrigger>
                <TabsTrigger value="exceptions" className="text-[#334155]">Exceptions</TabsTrigger>
                <TabsTrigger value="bookings" className="text-[#334155]">Bookings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview"><div className="grid grid-cols-2 gap-4"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Facility Info</p><p className="text-sm text-[#334155]">Name: <span className="text-[#0F172A]">{managedFacility.name}</span></p><p className="text-sm text-[#334155]">Type: <span className="text-[#0F172A]">{managedFacility.type}</span></p><p className="text-sm text-[#334155]">Capacity: <span className="text-[#0F172A]">{managedFacility.capacity ?? "-"}</span></p><p className="text-sm text-[#334155]">Price: <span className="text-[#0F172A]">{billingLabel(managedFacility.price, managedFacility.billingCycle)}</span></p>{managedFacility.rules ? <div className="bg-[#F8FAFC] rounded-lg p-3"><p className="text-sm text-[#334155] whitespace-pre-wrap">{managedFacility.rules}</p></div> : null}</div><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Today&apos;s Stats</p><p className="text-sm text-[#334155]">Bookings today: <span className="text-[#0F172A]">{managedFacility.upcomingBookingsToday}</span></p><p className="text-sm text-[#334155]">Pending: <span className="text-[#0F172A]">{managedFacility.bookingStats.pendingBookings}</span></p><p className="text-sm text-[#334155]">Revenue this month: <span className="font-['DM_Mono'] text-[#0F172A]">EGP {managedFacility.bookingStats.revenueThisMonth.toLocaleString()}</span></p></div></div></TabsContent>

              <TabsContent value="schedule"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6">{DAYS.map((label, dayOfWeek) => { const row = managedFacility.slotConfig.find((item) => item.dayOfWeek === dayOfWeek); return <div key={label} className="py-3 border-b border-[#E2E8F0] last:border-0"><div className="flex items-center gap-4"><span className="text-sm font-medium text-[#334155] w-12">{label}</span>{row ? <><span className="text-sm text-slate-400">{row.startTime} - {row.endTime}</span><span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{row.slotDurationMinutes} min slots</span><span className="text-xs text-slate-500">Cap: {row.slotCapacity ?? 1}/slot</span><button type="button" onClick={() => startEditDay(dayOfWeek)} className="ml-auto p-1.5 rounded hover:bg-[#F8FAFC] text-slate-500 hover:text-[#334155]"><Edit2 className="w-3.5 h-3.5" /></button><button type="button" onClick={() => void removeDayConfig(row.id)} className="p-1.5 rounded hover:bg-red-500/10 text-red-400"><X className="w-3.5 h-3.5" /></button></> : <><span className="text-sm text-[#475569]">Not configured</span><button type="button" onClick={() => startEditDay(dayOfWeek)} className="ml-auto text-xs text-blue-400 hover:text-blue-300">+ Add</button></>}</div>{slotEditDay === dayOfWeek ? <div className="mt-4 space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs text-slate-400 mb-1.5">Start time</label><input type="time" value={slotEdit.startTime} onChange={(event) => setSlotEdit((prev) => ({ ...prev, startTime: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div><div><label className="block text-xs text-slate-400 mb-1.5">End time</label><input type="time" value={slotEdit.endTime} onChange={(event) => setSlotEdit((prev) => ({ ...prev, endTime: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div><div><label className="block text-xs text-slate-400 mb-1.5">Slot duration</label><input type="number" min={15} value={slotEdit.slotDurationMinutes} onChange={(event) => setSlotEdit((prev) => ({ ...prev, slotDurationMinutes: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div><div><label className="block text-xs text-slate-400 mb-1.5">Slot capacity</label><input type="number" min={1} value={slotEdit.slotCapacity} onChange={(event) => setSlotEdit((prev) => ({ ...prev, slotCapacity: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => void saveDayConfig()} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button><button type="button" onClick={() => setSlotEditDay(null)} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg">Cancel</button></div></div> : null}</div>; })}</div></TabsContent>

              <TabsContent value="exceptions" className="space-y-4"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><h3 className="text-sm font-medium text-[#1E293B]">Exceptions</h3>{managedFacility.slotExceptions.length === 0 ? <EmptyState variant="light" compact title="No exceptions" description="Add a date-specific exception." /> : managedFacility.slotExceptions.map((item) => <div key={item.id} className="flex items-center justify-between py-3 border-b border-[#E2E8F0] last:border-0"><div><p className="text-sm text-[#1E293B]">{formatDate(item.date)}</p>{item.isClosed ? <StatusBadge value="CLOSED" /> : <p className="text-xs text-slate-500">{item.startTime} - {item.endTime}</p>}</div><button type="button" onClick={() => void removeException(item.id)} className="text-xs text-red-400 hover:text-red-300">Remove</button></div>)}</div><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><h3 className="text-sm font-medium text-[#1E293B]">Add Exception</h3><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs text-slate-400 mb-1.5">Date</label><input type="date" value={exceptionForm.date} onChange={(event) => setExceptionForm((prev) => ({ ...prev, date: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div><div className="flex items-end"><button type="button" onClick={() => setExceptionForm((prev) => ({ ...prev, isClosed: !prev.isClosed }))} className={cn("text-xs px-3 py-1.5 rounded-full border", exceptionForm.isClosed ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-[#F8FAFC] text-slate-400 border-transparent")}>Closed day</button></div>{!exceptionForm.isClosed ? <><div><label className="block text-xs text-slate-400 mb-1.5">Start</label><input type="time" value={exceptionForm.startTime} onChange={(event) => setExceptionForm((prev) => ({ ...prev, startTime: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div><div><label className="block text-xs text-slate-400 mb-1.5">End</label><input type="time" value={exceptionForm.endTime} onChange={(event) => setExceptionForm((prev) => ({ ...prev, endTime: event.target.value }))} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" /></div></> : null}</div><button type="button" onClick={() => void saveException()} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button></div></TabsContent>

              <TabsContent value="bookings"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><div className="flex items-center gap-3"><select value={manageBookingStatus} onChange={(event) => setManageBookingStatus(event.target.value)} className="w-40 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] appearance-none"><option value="ALL">All</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="CANCELLED">Cancelled</option></select></div>{manageBookingsLoading ? <SkeletonTable columns={6} variant="light" /> : <DataTable variant="light" columns={manageBookingColumns} rows={manageBookings} rowKey={(row) => row.id} emptyTitle="No bookings for this facility" emptyDescription="Bookings will appear here." />}</div></TabsContent>
            </Tabs>
          </div>
        )}
      </DrawerForm>

      <DrawerForm open={bookingDetailOpen} onOpenChange={setBookingDetailOpen} title={bookingDetail ? `${bookingDetail.facilityName} · ${formatDate(bookingDetail.date)}` : "Booking Detail"} description="View and manage booking requests and approvals" variant="light">
        {!bookingDetail ? <EmptyState variant="light" compact title="No booking selected" description="Select a booking to view details." /> : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap"><StatusBadge value={bookingDetail.status} />{bookingDetail.requiresPrepayment ? <StatusBadge value={bookingDetail.paymentStatus ?? "PENDING"} /> : null}</div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Booking Info</p><p className="text-sm text-[#334155]">User: <span className="text-[#0F172A]">{bookingDetail.userName}</span></p><p className="text-sm text-[#334155]">Phone: <span className="text-[#0F172A]">{bookingDetail.userPhone ?? "-"}</span></p><p className="text-sm text-[#334155]">Unit: <span className="text-[#0F172A]">{bookingDetail.unitNumber ?? "-"}</span></p><p className="text-sm text-[#334155]">Date: <span className="text-[#0F172A]">{formatDate(bookingDetail.date)}</span></p><p className="text-sm text-[#334155]">Time: <span className="text-[#0F172A]">{bookingDetail.startTime} - {bookingDetail.endTime}</span></p><p className="text-xs text-slate-500">Booked at {formatDateTime(bookingDetail.createdAt)}</p></div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Facility</p><p className="text-sm text-[#334155]">{bookingDetail.facilityName} ({bookingDetail.facilityType})</p>{bookingDetail.facilityRules ? <div className="bg-[#F8FAFC] rounded-lg p-3"><p className="text-sm text-[#334155] whitespace-pre-wrap">{bookingDetail.facilityRules}</p></div> : null}</div>
            {bookingDetail.totalAmount !== null && bookingDetail.totalAmount > 0 ? <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Payment</p><p className="text-2xl font-semibold font-['DM_Mono'] text-[#0F172A]">EGP {bookingDetail.totalAmount.toLocaleString()}</p><p className="text-sm text-slate-400">Payment status: {bookingDetail.paymentStatus ?? "PENDING"}</p>{bookingDetail.invoices[0] ? <p className="text-sm text-slate-400">Linked invoice: {bookingDetail.invoices[0].invoiceNumber}</p> : null}</div> : null}
            {(bookingDetail.status === BookingStatus.PENDING || bookingDetail.status === BookingStatus.PENDING_PAYMENT) ? <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</p><div className="flex items-center gap-2"><button type="button" onClick={() => void approveBooking(bookingDetail.id)} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Approve Booking</button><button type="button" onClick={() => setShowRejectInput((prev) => !prev)} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2 rounded-lg">Reject Booking</button></div>{showRejectInput ? <div className="space-y-3"><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="w-full min-h-[80px] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B]" placeholder="Reason for rejection" /><button type="button" onClick={() => void rejectBooking(bookingDetail.id)} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Confirm Reject</button></div> : null}</div> : null}
          </div>
        )}
      </DrawerForm>
    </div>
  );
}




