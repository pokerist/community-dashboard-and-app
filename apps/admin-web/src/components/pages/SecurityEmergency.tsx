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
import { AlertTriangle, CheckCircle, Clock, Video } from "lucide-react";
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
      const [cardsRes, listRes] = await Promise.all([
        apiClient.get("/incidents/cards"),
        apiClient.get("/incidents/list", { params: { page: 1, limit: 100 } }),
      ]);
      setCards(cardsRes.data ?? {});
      setIncidentsData(extractRows(listRes.data));
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load incidents", { description: msg });
    } finally {
      setIsLoading(false);
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
