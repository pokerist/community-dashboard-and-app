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
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { AlertTriangle, CheckCircle, Clock, Flame, Video } from "lucide-react";
import apiClient from "../../lib/api-client";
import {
  errorMessage,
  extractRows,
  formatDateTime,
  getPriorityColorClass,
  getStatusColorClass,
  humanizeEnum,
} from "../../lib/live-data";

export function SecurityEmergency() {
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [incidentsData, setIncidentsData] = useState<any[]>([]);
  const [cards, setCards] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fireStatus, setFireStatus] = useState<any | null>(null);
  const [fireMessageEn, setFireMessageEn] = useState(
    "Emergency alarm triggered. Please evacuate immediately and confirm once you are safe.",
  );
  const [fireMessageAr, setFireMessageAr] = useState(
    "تم إطلاق إنذار حريق. يرجى الإخلاء فورًا وتأكيد الوصول إلى مكان آمن.",
  );
  const [isFireDialogOpen, setIsFireDialogOpen] = useState(false);
  const [isFireTriggering, setIsFireTriggering] = useState(false);
  const [isFireResolving, setIsFireResolving] = useState(false);
  const [reportFormData, setReportFormData] = useState({
    type: "",
    location: "",
    resident: "",
    description: "",
    priority: "MEDIUM",
  });

  const loadIncidents = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [cardsRes, listRes, fireRes] = await Promise.all([
        apiClient.get("/incidents/cards"),
        apiClient.get("/incidents/list", { params: { page: 1, limit: 100 } }),
        apiClient.get("/fire-evacuation/admin/status").catch(() => ({ data: null })),
      ]);
      setCards(cardsRes.data ?? {});
      setIncidentsData(extractRows(listRes.data));
      setFireStatus(fireRes?.data ?? null);
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load incidents", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTriggerFireEvacuation = useCallback(async () => {
    setIsFireTriggering(true);
    try {
      const response = await apiClient.post("/fire-evacuation/admin/trigger", {
        messageEn: fireMessageEn,
        messageAr: fireMessageAr,
      });
      setFireStatus(response.data ?? null);
      setIsFireDialogOpen(false);
      toast.success("Fire evacuation alert triggered");
    } catch (error) {
      toast.error("Failed to trigger fire evacuation", { description: errorMessage(error) });
    } finally {
      setIsFireTriggering(false);
    }
  }, [fireMessageAr, fireMessageEn]);

  const handleResolveFireEvacuation = useCallback(async () => {
    setIsFireResolving(true);
    try {
      const response = await apiClient.post("/fire-evacuation/admin/resolve", {
        note: "Evacuation alert closed by admin",
      });
      setFireStatus(response.data ?? null);
      toast.success("Fire evacuation alert resolved");
    } catch (error) {
      toast.error("Failed to resolve fire evacuation", { description: errorMessage(error) });
    } finally {
      setIsFireResolving(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const handleReportEmergency = async () => {
    if (!reportFormData.type || !reportFormData.description || !reportFormData.priority) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/incidents", {
        type: reportFormData.type,
        location: reportFormData.location || undefined,
        residentName: reportFormData.resident || undefined,
        description: reportFormData.description,
        priority: reportFormData.priority,
      });
      toast.success("Incident reported");
      setIsReportDialogOpen(false);
      setReportFormData({ type: "", location: "", resident: "", description: "", priority: "MEDIUM" });
      await loadIncidents();
    } catch (error) {
      toast.error("Failed to report incident", { description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeIncidents = Number(cards?.activeIncidents ?? 0);
  const resolvedToday = Number(cards?.incidentsResolvedToday ?? 0);
  const avgResponseTime = Number(cards?.averageResponseTime ?? 0);
  const totalCameras = Number(cards?.totalCCTVCameras ?? 0);

  const openRows = useMemo(
    () => incidentsData.filter((i) => String(i.status || "").toUpperCase() !== "RESOLVED"),
    [incidentsData],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Security & Emergency</h1>
          <p className="text-[#64748B] mt-1">Live incident monitoring and emergency reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadIncidents()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
          <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white rounded-lg gap-2">
                <AlertTriangle className="w-4 h-4" />
                Report Emergency
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Report Security Incident</DialogTitle>
                <DialogDescription>Creates a real incident record via backend.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="incidentType">Incident Type</Label>
                  <Input
                    id="incidentType"
                    placeholder="Security Breach / Medical Emergency..."
                    value={reportFormData.type}
                    onChange={(e) => setReportFormData((p) => ({ ...p, type: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Block C - Main Entrance"
                    value={reportFormData.location}
                    onChange={(e) => setReportFormData((p) => ({ ...p, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="residentName">Resident Name (Optional)</Label>
                  <Input
                    id="residentName"
                    placeholder="Resident involved"
                    value={reportFormData.resident}
                    onChange={(e) => setReportFormData((p) => ({ ...p, resident: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={reportFormData.priority}
                    onValueChange={(value) => setReportFormData((p) => ({ ...p, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the incident..."
                    rows={3}
                    value={reportFormData.description}
                    onChange={(e) => setReportFormData((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>Cancel</Button>
                <Button className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white" onClick={() => void handleReportEmergency()} disabled={isSubmitting}>
                  {isSubmitting ? "Reporting..." : "Report Now"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Active Incidents</p>
              <h3 className="text-[#1E293B]">{activeIncidents}</h3>
              <p className="text-xs text-[#EF4444] mt-1">{openRows.length} open in table</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Resolved Today</p>
              <h3 className="text-[#1E293B]">{resolvedToday}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Avg Response Time</p>
              <h3 className="text-[#1E293B]">{avgResponseTime || 0} min</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#3B82F6]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">CCTV Cameras</p>
              <h3 className="text-[#1E293B]">{totalCameras}</h3>
              <p className="text-xs text-[#64748B] mt-1">From incident cards endpoint</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0B5FFF]/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-[#0B5FFF]" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 shadow-card rounded-xl border border-[#FCA5A5] bg-gradient-to-r from-[#FEF2F2] to-[#FFF7ED]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#DC2626]" />
              <h3 className="text-[#7F1D1D]">Fire Evacuation</h3>
              {fireStatus?.active ? (
                <Badge className="bg-[#DC2626] text-white">Active Alarm</Badge>
              ) : (
                <Badge variant="secondary" className="bg-[#E2E8F0] text-[#334155]">Standby</Badge>
              )}
            </div>
            <p className="text-sm text-[#7F1D1D]/90">
              Trigger emergency alarm for residents and track confirmations in real time.
            </p>
            {fireStatus?.triggeredAt ? (
              <p className="text-xs text-[#991B1B]">
                Last trigger: {formatDateTime(fireStatus.triggeredAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={isFireDialogOpen} onOpenChange={setIsFireDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg gap-2">
                  <Flame className="w-4 h-4" />
                  Trigger Fire Alarm
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Trigger Fire Evacuation Alarm</DialogTitle>
                  <DialogDescription>
                    Sends emergency alert to all active residents (in-app + push if configured).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="fireMessageEn">English Message</Label>
                    <Textarea
                      id="fireMessageEn"
                      rows={3}
                      value={fireMessageEn}
                      onChange={(e) => setFireMessageEn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fireMessageAr">Arabic Message</Label>
                    <Textarea
                      id="fireMessageAr"
                      rows={3}
                      value={fireMessageAr}
                      onChange={(e) => setFireMessageAr(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFireDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                    onClick={() => void handleTriggerFireEvacuation()}
                    disabled={isFireTriggering}
                  >
                    {isFireTriggering ? "Sending..." : "Send Alarm"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              className="border-[#DC2626]/30 text-[#B91C1C] hover:bg-[#FEE2E2]"
              onClick={() => void handleResolveFireEvacuation()}
              disabled={!fireStatus?.active || isFireResolving}
            >
              {isFireResolving ? "Resolving..." : "Mark All Clear"}
            </Button>

            <Button variant="outline" onClick={() => void loadIncidents()} disabled={isLoading}>
              Refresh Status
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#FECACA] bg-white p-3">
            <p className="text-xs text-[#7F1D1D]">Targeted Residents</p>
            <p className="text-xl font-semibold text-[#7F1D1D]">
              {Number(fireStatus?.counters?.totalRecipients ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-[#BBF7D0] bg-white p-3">
            <p className="text-xs text-[#166534]">Confirmed Evacuated</p>
            <p className="text-xl font-semibold text-[#166534]">
              {Number(fireStatus?.counters?.acknowledged ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-[#FCD34D] bg-white p-3">
            <p className="text-xs text-[#92400E]">Still Pending</p>
            <p className="text-xl font-semibold text-[#92400E]">
              {Number(fireStatus?.counters?.pending ?? 0)}
            </p>
          </div>
        </div>

        {Array.isArray(fireStatus?.pendingRecipients) && fireStatus.pendingRecipients.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-[#7F1D1D] mb-2">Pending confirmations</p>
            <div className="flex flex-wrap gap-2">
              {fireStatus.pendingRecipients.slice(0, 12).map((resident: any) => (
                <Badge key={resident.userId} variant="secondary" className="bg-[#FEE2E2] text-[#991B1B]">
                  {resident.name || resident.userId}
                </Badge>
              ))}
              {fireStatus.pendingRecipients.length > 12 ? (
                <Badge variant="secondary" className="bg-[#F1F5F9] text-[#475569]">
                  +{fireStatus.pendingRecipients.length - 12} more
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB]">
          <h3 className="text-[#1E293B]">Security Incidents</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Incident ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Resident</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Response Time</TableHead>
              <TableHead>Reported At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidentsData.map((incident) => (
              <TableRow key={incident.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1E293B]">
                  {incident.incidentNumber ?? incident.id}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                    {incident.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-[#64748B]">
                  {incident.location ?? incident.unit?.unitNumber ?? "—"}
                </TableCell>
                <TableCell className="text-[#1E293B]">{incident.residentName || "—"}</TableCell>
                <TableCell className="text-[#64748B] max-w-xs truncate">{incident.description}</TableCell>
                <TableCell>
                  <Badge className={getPriorityColorClass(incident.priority)}>
                    {humanizeEnum(incident.priority)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColorClass(incident.status)}>
                    {humanizeEnum(incident.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-[#1E293B]">{incident.responseTime ?? "—"}</TableCell>
                <TableCell className="text-[#64748B]">{formatDateTime(incident.reportedAt ?? incident.createdAt)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && incidentsData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-[#64748B]">
                  No incidents found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

    </div>
  );
}
