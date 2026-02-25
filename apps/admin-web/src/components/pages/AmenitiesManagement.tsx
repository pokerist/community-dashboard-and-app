import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Dumbbell, Plus, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import apiClient from "../../lib/api-client";
import {
  errorMessage,
  extractRows,
  formatCurrencyEGP,
  formatDate,
  formatDateTime,
  getStatusColorClass,
  humanizeEnum,
} from "../../lib/live-data";

const FACILITY_TYPES = ["GYM", "POOL", "TENNIS_COURT", "MULTIPURPOSE_HALL", "CUSTOM"];

export function AmenitiesManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [facilitiesData, setFacilitiesData] = useState<any[]>([]);
  const [bookingRows, setBookingRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amenityFormData, setAmenityFormData] = useState({
    name: "",
    type: "CUSTOM",
    capacity: "",
  });

  const loadFacilities = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [facilitiesRes, bookingsRes] = await Promise.all([
        apiClient.get("/facilities"),
        apiClient.get("/bookings", { params: { page: 1, limit: 100 } }),
      ]);
      setFacilitiesData(Array.isArray(facilitiesRes.data) ? facilitiesRes.data : []);
      setBookingRows(extractRows(bookingsRes.data));
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load facilities", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFacilities();
  }, [loadFacilities]);

  const handleAddFacility = async () => {
    if (!amenityFormData.name) {
      toast.error("Facility name is required");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/facilities", {
        name: amenityFormData.name,
        type: amenityFormData.type,
        capacity: amenityFormData.capacity ? Number(amenityFormData.capacity) : undefined,
        isActive: true,
        billingCycle: "NONE",
      });
      toast.success("Facility created in backend");
      setIsAddDialogOpen(false);
      setAmenityFormData({ name: "", type: "CUSTOM", capacity: "" });
      await loadFacilities();
    } catch (error) {
      toast.error("Failed to create facility", { description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bookingCountByFacilityId = useMemo(() => {
    const map = new Map<string, number>();
    bookingRows.forEach((row: any) => {
      const facilityId = row.facilityId ?? row.facility?.id;
      if (!facilityId) return;
      map.set(facilityId, (map.get(facilityId) ?? 0) + 1);
    });
    return map;
  }, [bookingRows]);

  const bookingCalendarSummary = useMemo(() => {
    const groups = new Map<string, { date: string; count: number; facilities: Set<string> }>();
    bookingRows.forEach((booking: any) => {
      const rawDate = booking.bookingDate ?? booking.date ?? booking.startTime ?? booking.createdAt;
      const dateLabel = rawDate ? formatDate(rawDate) : "Unknown Date";
      if (!groups.has(dateLabel)) {
        groups.set(dateLabel, { date: dateLabel, count: 0, facilities: new Set<string>() });
      }
      const row = groups.get(dateLabel)!;
      row.count += 1;
      const facilityName = booking.facility?.name ?? booking.facilityId;
      if (facilityName) row.facilities.add(String(facilityName));
    });
    return Array.from(groups.values())
      .map((g) => ({
        ...g,
        facilitiesList: Array.from(g.facilities),
      }))
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (Number.isNaN(da) || Number.isNaN(db)) return a.date.localeCompare(b.date);
        return db - da;
      });
  }, [bookingRows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Amenities & Facilities</h1>
          <p className="text-[#64748B] mt-1">Live facilities catalog and bookings from backend</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadFacilities()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                <Plus className="w-4 h-4" />
                Add Facility
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Facility</DialogTitle>
                <DialogDescription>Creates a real facility record in backend.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="facilityName">Facility Name</Label>
                  <Input
                    id="facilityName"
                    placeholder="e.g., Tennis Court"
                    value={amenityFormData.name}
                    onChange={(e) => setAmenityFormData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facilityType">Type</Label>
                  <Select
                    value={amenityFormData.type}
                    onValueChange={(value) => setAmenityFormData((p) => ({ ...p, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FACILITY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {humanizeEnum(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    type="number"
                    placeholder="50"
                    value={amenityFormData.capacity}
                    onChange={(e) => setAmenityFormData((p) => ({ ...p, capacity: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void handleAddFacility()} disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Facility"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {facilitiesData.map((facility) => (
          <Card key={facility.id} className="p-6 shadow-card hover:shadow-hover transition-shadow rounded-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0B5FFF]/10 flex items-center justify-center">
                <Dumbbell className="w-6 h-6 text-[#0B5FFF]" />
              </div>
              <Badge className={getStatusColorClass(facility.isActive ? "ACTIVE" : "DISABLED")}>
                {facility.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <h3 className="text-[#1E293B] mb-1">{facility.name}</h3>
            <p className="text-sm text-[#64748B] mb-4">{humanizeEnum(facility.type)}</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Capacity</span>
                <span className="text-[#1E293B]">{facility.capacity ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Billing</span>
                <span className="text-[#1E293B]">{humanizeEnum(facility.billingCycle)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Price</span>
                <span className="text-[#1E293B]">{formatCurrencyEGP(facility.price ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Bookings</span>
                <span className="text-[#1E293B]">{bookingCountByFacilityId.get(facility.id) ?? 0}</span>
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && facilitiesData.length === 0 ? (
          <Card className="p-6 shadow-card rounded-xl md:col-span-2 lg:col-span-4 text-center text-[#64748B]">
            No facilities found yet. Create one from the button above.
          </Card>
        ) : null}
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="w-full justify-start border-b border-[#E5E7EB] rounded-none h-12 bg-transparent px-4">
            <TabsTrigger value="bookings" className="rounded-lg">Bookings</TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-lg">Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="m-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Amenity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time Slot</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingRows.map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-medium text-[#1E293B]">
                      {booking.bookingNumber ?? booking.id}
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {booking.resident?.nameEN ?? booking.user?.nameEN ?? booking.residentId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                        {booking.facility?.name ?? booking.facilityId ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#1E293B]">
                      {formatDate(booking.bookingDate ?? booking.date ?? booking.startTime)}
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {booking.startTime && booking.endTime
                        ? `${formatDateTime(booking.startTime)} - ${formatDateTime(booking.endTime)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{booking.guestCount ?? booking.guests ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColorClass(booking.status)}>{humanizeEnum(booking.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">{formatDateTime(booking.createdAt)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && bookingRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-[#64748B]">
                      No bookings found yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="calendar" className="m-0">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4 text-[#1E293B]">
                <Calendar className="w-5 h-5 text-[#0B5FFF]" />
                <h4>Booking Calendar Summary (Live)</h4>
              </div>
              <div className="space-y-3">
                {bookingCalendarSummary.slice(0, 30).map((day) => (
                  <div key={day.date} className="rounded-lg border border-[#E5E7EB] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-[#1E293B]">{day.date}</div>
                      <Badge variant="secondary">{day.count} bookings</Badge>
                    </div>
                    <div className="text-xs text-[#64748B] mt-2">
                      Facilities: {day.facilitiesList.length ? day.facilitiesList.join(", ") : "—"}
                    </div>
                  </div>
                ))}
                {!isLoading && bookingCalendarSummary.length === 0 ? (
                  <div className="text-center py-6 text-[#64748B]">No bookings available for calendar summary.</div>
                ) : null}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
