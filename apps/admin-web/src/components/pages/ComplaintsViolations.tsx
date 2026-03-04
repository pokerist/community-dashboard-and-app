import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
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
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Search, AlertTriangle, Ban, Plus, Eye, Send, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import apiClient from "../../lib/api-client";
import {
  errorMessage,
  extractRows,
  formatCurrencyEGP,
  formatDate,
  formatDateTime,
  getPriorityColorClass,
  getStatusColorClass,
  humanizeEnum,
} from "../../lib/live-data";
import {
  adminComplaintStatusLabel,
  adminPriorityLabel,
  adminViolationStatusLabel,
} from "../../lib/status-labels";

interface ComplaintListRow {
  id: string;
  complaintNumber?: string | null;
  reporterId?: string | null;
  unitId?: string | null;
  title?: string | null;
  team?: string | null;
  category?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  reporter?: { id?: string; nameEN?: string | null; email?: string | null; phone?: string | null } | null;
  unit?: { id?: string; unitNumber?: string | null; block?: string | null; projectName?: string | null } | null;
  assignedTo?: { id?: string; nameEN?: string | null; email?: string | null } | null;
}

interface ComplaintCommentRow {
  id: string;
  body: string;
  isInternal?: boolean;
  createdAt?: string | null;
  createdById?: string | null;
  createdBy?: { id?: string; nameEN?: string | null; email?: string | null } | null;
}

type PendingFocusEntity = {
  section?: string;
  entityType?: string | null;
  entityId?: string | null;
};

type ComplaintsTab = "complaints" | "violations";
type ComplaintPreset = "all" | "pending" | "overdue" | "closed";

const COMPLAINT_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export function ComplaintsViolations() {
  const [isCreateComplaintOpen, setIsCreateComplaintOpen] = useState(false);
  const [isCreateViolationOpen, setIsCreateViolationOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<ComplaintsTab>("complaints");
  const [complaintsData, setComplaintsData] = useState<any[]>([]);
  const [violationsData, setViolationsData] = useState<any[]>([]);
  const [residentOptions, setResidentOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [unitOptions, setUnitOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [isSubmittingViolation, setIsSubmittingViolation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [complaintStatusFilter, setComplaintStatusFilter] = useState<string>("all");
  const [complaintPreset, setComplaintPreset] = useState<ComplaintPreset>("all");
  const [isComplaintDialogOpen, setIsComplaintDialogOpen] = useState(false);
  const [activeComplaintId, setActiveComplaintId] = useState<string | null>(null);
  const [activeComplaint, setActiveComplaint] = useState<ComplaintListRow | null>(null);
  const [complaintComments, setComplaintComments] = useState<ComplaintCommentRow[]>([]);
  const [complaintDialogLoading, setComplaintDialogLoading] = useState(false);
  const [complaintReplyText, setComplaintReplyText] = useState("");
  const [complaintReplyInternal, setComplaintReplyInternal] = useState(false);
  const [complaintReplySubmitting, setComplaintReplySubmitting] = useState(false);
  const [complaintStatusDraft, setComplaintStatusDraft] = useState<string>("");
  const [complaintStatusUpdating, setComplaintStatusUpdating] = useState(false);
  const [complaintResolutionNotesDraft, setComplaintResolutionNotesDraft] = useState("");
  const [complaintTeamDraft, setComplaintTeamDraft] = useState("");
  const [complaintFormData, setComplaintFormData] = useState({
    reporterId: "",
    unitId: "",
    title: "",
    team: "",
    priority: "",
    description: "",
  });
  const [violationFormData, setViolationFormData] = useState({
    unitId: "",
    residentId: "",
    type: "",
    fineAmount: "",
    dueDate: "",
    description: "",
  });

  const resetComplaintsFilters = useCallback((tab: ComplaintsTab = "complaints") => {
    setActiveTab(tab);
    setSearchTerm("");
    setComplaintStatusFilter("all");
    setComplaintPreset("all");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("admin.complaintsViolations.filters");
      } catch {
        // ignore storage failures
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("admin.complaintsViolations.filters");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        tab?: ComplaintsTab;
        search?: string;
        complaintStatusFilter?: string;
        complaintPreset?: ComplaintPreset;
      };
      setActiveTab(parsed.tab === "violations" ? "violations" : "complaints");
      setSearchTerm(String(parsed.search ?? ""));
      setComplaintStatusFilter(String(parsed.complaintStatusFilter ?? "all"));
      setComplaintPreset(
        parsed.complaintPreset === "pending" ||
          parsed.complaintPreset === "overdue" ||
          parsed.complaintPreset === "closed"
          ? parsed.complaintPreset
          : "all",
      );
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "admin.complaintsViolations.filters",
        JSON.stringify({
          tab: activeTab,
          search: searchTerm,
          complaintStatusFilter,
          complaintPreset,
        }),
      );
    } catch {
      // ignore storage failures
    }
  }, [activeTab, complaintPreset, complaintStatusFilter, searchTerm]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [complaintsRes, violationsRes, residentsRes, unitsRes] = await Promise.all([
        apiClient.get("/complaints", { params: { page: 1, limit: 100 } }),
        apiClient.get("/violations", { params: { page: 1, limit: 100 } }),
        apiClient.get("/admin/users", { params: { userType: "resident", take: 500, skip: 0 } }),
        apiClient.get("/units", { params: { page: 1, limit: 100 } }),
      ]);
      setComplaintsData(extractRows(complaintsRes.data));
      setViolationsData(extractRows(violationsRes.data));

      const residents = extractRows(residentsRes.data).map((user: any) => ({
        id: String(user.id),
        label: user.nameEN ?? user.nameAR ?? user.email ?? user.phone ?? String(user.id),
      }));
      const units = extractRows(unitsRes.data).map((unit: any) => ({
        id: String(unit.id),
        label:
          [unit.projectName, unit.block ? `Block ${unit.block}` : null, unit.unitNumber ? `Unit ${unit.unitNumber}` : null]
            .filter(Boolean)
            .join(" - ") || String(unit.id),
      }));

      setResidentOptions(residents);
      setUnitOptions(units);
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load complaints/violations", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateComplaint = async () => {
    if (
      !complaintFormData.reporterId ||
      !complaintFormData.title ||
      !complaintFormData.team ||
      !complaintFormData.description
    ) {
      toast.error("Reporter, title, team, and description are required");
      return;
    }

    setIsSubmittingComplaint(true);
    try {
      await apiClient.post("/complaints/admin/create", {
        reporterId: complaintFormData.reporterId,
        unitId: complaintFormData.unitId || undefined,
        title: complaintFormData.title,
        team: complaintFormData.team,
        category: complaintFormData.team,
        priority: complaintFormData.priority || undefined,
        description: complaintFormData.description,
      });

      toast.success("Complaint created");
      setIsCreateComplaintOpen(false);
      setComplaintFormData({
        reporterId: "",
        unitId: "",
        title: "",
        team: "",
        priority: "",
        description: "",
      });
      await loadData();
    } catch (error) {
      toast.error("Failed to create complaint", { description: errorMessage(error) });
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const handleCreateViolation = async () => {
    if (!violationFormData.unitId || !violationFormData.type || !violationFormData.description) {
      toast.error("Unit, type, and description are required");
      return;
    }
    if (!violationFormData.dueDate) {
      toast.error("Due date is required");
      return;
    }

    setIsSubmittingViolation(true);
    try {
      await apiClient.post("/violations", {
        unitId: violationFormData.unitId,
        residentId: violationFormData.residentId || undefined,
        type: violationFormData.type,
        description: violationFormData.description,
        fineAmount: Number(violationFormData.fineAmount || 0),
        dueDate: new Date(violationFormData.dueDate).toISOString(),
      });

      toast.success("Violation created");
      setIsCreateViolationOpen(false);
      setViolationFormData({
        unitId: "",
        residentId: "",
        type: "",
        fineAmount: "",
        dueDate: "",
        description: "",
      });
      await loadData();
    } catch (error) {
      toast.error("Failed to create violation", { description: errorMessage(error) });
    } finally {
      setIsSubmittingViolation(false);
    }
  };

  const loadComplaintDetail = useCallback(async (complaintId: string) => {
    setComplaintDialogLoading(true);
    try {
      const [detailRes, commentsRes] = await Promise.all([
        apiClient.get(`/complaints/${complaintId}`),
        apiClient.get(`/complaints/${complaintId}/comments`),
      ]);
      const detail = detailRes.data as ComplaintListRow;
      const comments = Array.isArray(commentsRes.data)
        ? (commentsRes.data as ComplaintCommentRow[])
        : [];
      setActiveComplaint(detail);
      setComplaintComments(comments);
      setComplaintStatusDraft(String(detail.status ?? "NEW").toUpperCase());
      setComplaintResolutionNotesDraft(detail.resolutionNotes ?? "");
      setComplaintTeamDraft(String(detail.team ?? "").trim());
    } catch (error) {
      toast.error("Failed to load complaint details", { description: errorMessage(error) });
      setActiveComplaint(null);
      setComplaintComments([]);
    } finally {
      setComplaintDialogLoading(false);
    }
  }, []);

  const openComplaintDialog = useCallback(async (complaint: ComplaintListRow) => {
    setActiveComplaintId(complaint.id);
    setIsComplaintDialogOpen(true);
    setComplaintReplyText("");
    setComplaintReplyInternal(false);
    await loadComplaintDetail(complaint.id);
  }, [loadComplaintDetail]);

  useEffect(() => {
    if (typeof window === "undefined" || complaintsData.length === 0) return;

    let parsed: PendingFocusEntity | null = null;
    try {
      const raw = window.sessionStorage.getItem("admin.focusEntity");
      if (!raw) return;
      parsed = JSON.parse(raw) as PendingFocusEntity;
    } catch {
      return;
    }

    const targetSection = String(parsed?.section ?? "").trim().toLowerCase();
    const targetId = String(parsed?.entityId ?? "").trim();
    const targetEntityType = String(parsed?.entityType ?? "").trim().toUpperCase();
    if (!targetId || targetSection !== "complaints") return;
    if (targetEntityType && targetEntityType !== "COMPLAINT") return;

    const complaint = complaintsData.find((row: any) => String(row?.id) === targetId);
    if (!complaint) return;

    window.sessionStorage.removeItem("admin.focusEntity");
    void openComplaintDialog(complaint as ComplaintListRow);
  }, [complaintsData, openComplaintDialog]);

  const closeComplaintDialog = useCallback(() => {
    setIsComplaintDialogOpen(false);
    setActiveComplaintId(null);
    setActiveComplaint(null);
    setComplaintComments([]);
    setComplaintReplyText("");
    setComplaintReplyInternal(false);
    setComplaintStatusDraft("");
    setComplaintResolutionNotesDraft("");
    setComplaintTeamDraft("");
  }, []);

  const refreshActiveComplaint = useCallback(async () => {
    if (!activeComplaintId) return;
    await loadComplaintDetail(activeComplaintId);
  }, [activeComplaintId, loadComplaintDetail]);

  const submitComplaintReply = useCallback(async () => {
    if (!activeComplaintId) return;
    const body = complaintReplyText.trim();
    if (!body) return;

    setComplaintReplySubmitting(true);
    try {
      await apiClient.post(`/complaints/${activeComplaintId}/comments`, {
        body,
        isInternal: complaintReplyInternal,
      });
      toast.success(complaintReplyInternal ? "Internal note posted" : "Reply posted");
      setComplaintReplyText("");
      setComplaintReplyInternal(false);
      await refreshActiveComplaint();
    } catch (error) {
      toast.error("Failed to post comment", { description: errorMessage(error) });
    } finally {
      setComplaintReplySubmitting(false);
    }
  }, [activeComplaintId, complaintReplyInternal, complaintReplyText, refreshActiveComplaint]);

  const applyComplaintStatus = useCallback(async () => {
    if (!activeComplaintId || !complaintStatusDraft) return;
    const target = String(complaintStatusDraft).toUpperCase();
    const requiresNotes = target === "RESOLVED" || target === "CLOSED";
    if (requiresNotes && !complaintResolutionNotesDraft.trim()) {
      toast.error("Resolution notes required", { description: "Add resolution notes before resolving or closing." });
      return;
    }

    setComplaintStatusUpdating(true);
    try {
      await apiClient.patch(`/complaints/${activeComplaintId}`, {
        status: target,
        resolutionNotes: complaintResolutionNotesDraft.trim() || undefined,
        team: complaintTeamDraft.trim() || undefined,
      });
      toast.success("Complaint status updated");
      await Promise.all([loadData(), refreshActiveComplaint()]);
    } catch (error) {
      toast.error("Failed to update complaint", { description: errorMessage(error) });
    } finally {
      setComplaintStatusUpdating(false);
    }
  }, [
    activeComplaintId,
    complaintStatusDraft,
    complaintTeamDraft,
    complaintResolutionNotesDraft,
    loadData,
    refreshActiveComplaint,
  ]);

  const filteredComplaints = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const now = Date.now();
    const overdueThresholdMs = 24 * 60 * 60 * 1000;
    return complaintsData.filter((c: any) => {
      const status = String(c.status ?? "").toUpperCase();
      if (complaintStatusFilter !== "all" && status !== complaintStatusFilter) return false;
      if (complaintPreset === "pending" && !(status === "NEW" || status === "IN_PROGRESS")) {
        return false;
      }
      if (complaintPreset === "closed" && !(status === "RESOLVED" || status === "CLOSED")) {
        return false;
      }
      if (complaintPreset === "overdue") {
        if (!(status === "NEW" || status === "IN_PROGRESS")) return false;
        const createdTs = c.createdAt ? new Date(c.createdAt).getTime() : NaN;
        if (!Number.isFinite(createdTs) || now - createdTs < overdueThresholdMs) {
          return false;
        }
      }
      if (!q) return true;
      return [
        c.complaintNumber,
        c.id,
        c.title,
        c.team,
        c.category,
        c.description,
        c.status,
        c.priority,
        c.reporter?.nameEN,
        c.reporter?.email,
        c.unit?.unitNumber,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [complaintPreset, complaintsData, complaintStatusFilter, searchTerm]);

  const filteredViolations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return violationsData.filter((v: any) => {
      if (!q) return true;
      return [
        v.violationNumber,
        v.id,
        v.type,
        v.description,
        v.status,
        v.resident?.nameEN,
        v.unit?.unitNumber,
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    });
  }, [violationsData, searchTerm]);

  const openComplaints = complaintsData.filter((c) =>
    ["NEW", "OPEN", "IN_PROGRESS", "PENDING"].includes(String(c.status || "").toUpperCase()),
  );
  const pendingViolations = violationsData.filter((v) =>
    ["PENDING", "PENDING_PAYMENT"].includes(String(v.status || "").toUpperCase()),
  );
  const finesCollected = violationsData
    .filter((v) => String(v.status || "").toUpperCase() === "PAID")
    .reduce((sum, v) => sum + Number(v.fineAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[#1E293B]">Complaints & Violations</h1>
          <p className="text-[#64748B] mt-1">Live complaint and violation records from the backend</p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Total Complaints</p>
              <h3 className="text-[#1E293B]">{complaintsData.length}</h3>
              <p className="text-xs text-[#64748B] mt-1">Live count</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0B5FFF]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#0B5FFF]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Pending / Open</p>
              <h3 className="text-[#1E293B]">{openComplaints.length}</h3>
              <p className="text-xs text-[#F59E0B] mt-1">Requires attention</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Total Violations</p>
              <h3 className="text-[#1E293B]">{violationsData.length}</h3>
              <p className="text-xs text-[#64748B] mt-1">{pendingViolations.length} pending</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
              <Ban className="w-6 h-6 text-[#EF4444]" />
            </div>
          </div>
        </Card>
        <Card className="p-6 shadow-card rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#64748B] mb-2">Fines Collected</p>
              <h3 className="text-[#1E293B]">{formatCurrencyEGP(finesCollected)}</h3>
              <p className="text-xs text-[#10B981] mt-1">Paid violations only</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
              <Ban className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ComplaintsTab)} className="w-full">
          <TabsList className="w-full justify-start border-b border-[#E5E7EB] rounded-none h-12 bg-transparent px-4">
            <TabsTrigger value="complaints" className="rounded-lg">Complaints</TabsTrigger>
            <TabsTrigger value="violations" className="rounded-lg">Violations</TabsTrigger>
          </TabsList>

          <TabsContent value="complaints" className="m-0">
            <div className="p-4 border-b border-[#E5E7EB] flex flex-col gap-4 lg:flex-row">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={complaintPreset === "all" ? "default" : "outline"}
                  className={complaintPreset === "all" ? "bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" : ""}
                  onClick={() => setComplaintPreset("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={complaintPreset === "pending" ? "default" : "outline"}
                  className={complaintPreset === "pending" ? "bg-[#F59E0B] hover:bg-[#D97706] text-white" : ""}
                  onClick={() => {
                    setComplaintPreset("pending");
                    setComplaintStatusFilter("all");
                  }}
                >
                  Pending
                </Button>
                <Button
                  size="sm"
                  variant={complaintPreset === "overdue" ? "default" : "outline"}
                  className={complaintPreset === "overdue" ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white" : ""}
                  onClick={() => {
                    setComplaintPreset("overdue");
                    setComplaintStatusFilter("all");
                  }}
                >
                  Overdue
                </Button>
                <Button
                  size="sm"
                  variant={complaintPreset === "closed" ? "default" : "outline"}
                  className={complaintPreset === "closed" ? "bg-[#10B981] hover:bg-[#059669] text-white" : ""}
                  onClick={() => {
                    setComplaintPreset("closed");
                    setComplaintStatusFilter("all");
                  }}
                >
                  Closed
                </Button>
              </div>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  placeholder="Search complaints..."
                  className="pl-10 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={complaintStatusFilter} onValueChange={setComplaintStatusFilter}>
                <SelectTrigger className="w-full lg:w-[220px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {COMPLAINT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {adminComplaintStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => void loadData()} disabled={isLoading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => resetComplaintsFilters("complaints")}>
                Reset Filters
              </Button>
              <Dialog open={isCreateComplaintOpen} onOpenChange={setIsCreateComplaintOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white rounded-lg gap-2">
                    <Plus className="w-4 h-4" />
                    File Complaint
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>File New Complaint</DialogTitle>
                    <DialogDescription>
                      Admin create-on-behalf flow uses <code>/complaints/admin/create</code>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="complaintReporter">Reporter (Resident User)</Label>
                      <Select
                        value={complaintFormData.reporterId || "none"}
                        onValueChange={(value) =>
                          setComplaintFormData((p) => ({
                            ...p,
                            reporterId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="complaintReporter">
                          <SelectValue placeholder="Select resident" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select resident</SelectItem>
                          {residentOptions.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaintUnit">Unit (optional)</Label>
                      <Select
                        value={complaintFormData.unitId || "none"}
                        onValueChange={(value) =>
                          setComplaintFormData((p) => ({
                            ...p,
                            unitId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="complaintUnit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No unit</SelectItem>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Complaint Title</Label>
                      <Input
                        id="title"
                        placeholder="Short complaint title"
                        value={complaintFormData.title}
                        onChange={(e) => setComplaintFormData((p) => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="team">Team</Label>
                      <Input
                        id="team"
                        placeholder="Security / Maintenance / Community"
                        value={complaintFormData.team}
                        onChange={(e) => setComplaintFormData((p) => ({ ...p, team: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select
                        value={complaintFormData.priority}
                        onValueChange={(value) => setComplaintFormData((p) => ({ ...p, priority: value }))}
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
                        rows={4}
                        value={complaintFormData.description}
                        onChange={(e) => setComplaintFormData((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateComplaintOpen(false)} disabled={isSubmittingComplaint}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                      onClick={() => void handleCreateComplaint()}
                      disabled={isSubmittingComplaint}
                    >
                      {isSubmittingComplaint ? "Submitting..." : "Submit Complaint"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Complaint ID</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.map((complaint: any) => (
                  <TableRow key={complaint.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-medium text-[#1E293B]">
                      {complaint.complaintNumber ?? complaint.id}
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {complaint.reporter?.nameEN ?? complaint.reporter?.email ?? complaint.reporterId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                        {complaint.unit?.unitNumber ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{complaint.title ?? "—"}</TableCell>
                    <TableCell className="text-[#1E293B]">{complaint.team ?? "—"}</TableCell>
                    <TableCell className="text-[#64748B] max-w-xs truncate">
                      {complaint.description ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColorClass(complaint.priority)}>
                        {adminPriorityLabel(complaint.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColorClass(complaint.status)}>
                        {adminComplaintStatusLabel(complaint.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {complaint.assignedTo?.nameEN ?? complaint.assignedToId ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-[#64748B]">{formatDate(complaint.createdAt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => void openComplaintDialog(complaint)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredComplaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-[#64748B]">
                      No complaints found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="violations" className="m-0">
            <div className="p-4 border-b border-[#E5E7EB] flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <Input
                  placeholder="Search violations..."
                  className="pl-10 rounded-lg"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={() => resetComplaintsFilters("violations")}>
                Reset Filters
              </Button>
              <Dialog open={isCreateViolationOpen} onOpenChange={setIsCreateViolationOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white rounded-lg gap-2">
                    <Plus className="w-4 h-4" />
                    Issue Violation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Issue New Violation</DialogTitle>
                    <DialogDescription>
                      Creates a violation and auto-generates a fine invoice in the backend.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="vunit">Unit</Label>
                      <Select
                        value={violationFormData.unitId || "none"}
                        onValueChange={(value) =>
                          setViolationFormData((p) => ({
                            ...p,
                            unitId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="vunit">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select unit</SelectItem>
                          {unitOptions.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vresident">Resident (optional)</Label>
                      <Select
                        value={violationFormData.residentId || "none"}
                        onValueChange={(value) =>
                          setViolationFormData((p) => ({
                            ...p,
                            residentId: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="vresident">
                          <SelectValue placeholder="Select resident" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No specific resident</SelectItem>
                          {residentOptions.map((resident) => (
                            <SelectItem key={resident.id} value={resident.id}>
                              {resident.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vtype">Type</Label>
                      <Input
                        id="vtype"
                        value={violationFormData.type}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, type: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vfine">Fine Amount</Label>
                      <Input
                        id="vfine"
                        type="number"
                        value={violationFormData.fineAmount}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, fineAmount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vdueDate">Due Date</Label>
                      <Input
                        id="vdueDate"
                        type="date"
                        value={violationFormData.dueDate}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, dueDate: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vdesc">Description</Label>
                      <Textarea
                        id="vdesc"
                        rows={4}
                        value={violationFormData.description}
                        onChange={(e) => setViolationFormData((p) => ({ ...p, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateViolationOpen(false)} disabled={isSubmittingViolation}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white"
                      onClick={() => void handleCreateViolation()}
                      disabled={isSubmittingViolation}
                    >
                      {isSubmittingViolation ? "Creating..." : "Create Violation"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead>Violation ID</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Fine Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Paid Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredViolations.map((violation: any) => (
                  <TableRow key={violation.id} className="hover:bg-[#F9FAFB]">
                    <TableCell className="font-medium text-[#1E293B]">
                      {violation.violationNumber ?? violation.id}
                    </TableCell>
                    <TableCell className="text-[#64748B]">
                      {violation.resident?.nameEN ?? violation.resident?.email ?? violation.residentId ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-[#F3F4F6] text-[#1E293B]">
                        {violation.unit?.unitNumber ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{violation.type ?? "—"}</TableCell>
                    <TableCell className="text-[#64748B] max-w-xs truncate">
                      {violation.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-[#1E293B]">{formatCurrencyEGP(violation.fineAmount)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColorClass(violation.status)}>
                        {adminViolationStatusLabel(violation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#64748B]">{formatDate(violation.createdAt ?? violation.issuedAt)}</TableCell>
                    <TableCell className="text-[#64748B]">{formatDate(violation.paidDate)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && filteredViolations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-[#64748B]">
                      No violations found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog
        open={isComplaintDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeComplaintDialog();
          else setIsComplaintDialogOpen(true);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complaint Details</DialogTitle>
            <DialogDescription>
              Review complaint information, update workflow status, and reply to the resident.
            </DialogDescription>
          </DialogHeader>

          {complaintDialogLoading ? (
            <div className="py-10 flex items-center justify-center">
              <span className="text-sm text-[#64748B]">Loading complaint...</span>
            </div>
          ) : activeComplaint ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-4 lg:col-span-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-[#1E293B]">
                        {activeComplaint.title || activeComplaint.category || "Complaint"}
                      </h4>
                      <p className="text-xs text-[#64748B] mt-1">
                        Complaint ID: {activeComplaint.complaintNumber ?? activeComplaint.id}
                      </p>
                    </div>
                    <Badge className={getStatusColorClass(activeComplaint.status)}>
                      {adminComplaintStatusLabel(activeComplaint.status || "NEW")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
                    <div>
                      <p className="text-[#64748B]">Resident</p>
                      <p className="text-[#1E293B]">{activeComplaint.reporter?.nameEN || "—"}</p>
                      <p className="text-xs text-[#64748B]">
                        {activeComplaint.reporter?.email || activeComplaint.reporter?.phone || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Unit</p>
                      <p className="text-[#1E293B]">
                        {activeComplaint.unit?.block ? `${activeComplaint.unit.block} • ` : ""}
                        {activeComplaint.unit?.unitNumber ?? "—"}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        Priority: {adminPriorityLabel(activeComplaint.priority || "MEDIUM")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Submitted</p>
                      <p className="text-[#1E293B]">{formatDateTime(activeComplaint.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Last Updated</p>
                      <p className="text-[#1E293B]">{formatDateTime(activeComplaint.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Team</p>
                      <p className="text-[#1E293B]">{activeComplaint.team || "Unassigned Team"}</p>
                    </div>
                    <div>
                      <p className="text-[#64748B]">Assigned To</p>
                      <p className="text-[#1E293B]">
                        {activeComplaint.assignedTo?.nameEN ||
                          activeComplaint.assignedTo?.email ||
                          "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-2">
                    <p className="text-[#64748B] text-sm">Resident Complaint</p>
                    <p className="text-sm text-[#1E293B] whitespace-pre-wrap break-words">
                      {activeComplaint.description || "—"}
                    </p>
                  </div>

                  {activeComplaint.resolutionNotes ? (
                    <div className="mt-4 pt-4 border-t border-[#E5E7EB] space-y-2">
                      <p className="text-[#64748B] text-sm">Resolution Notes</p>
                      <p className="text-sm text-[#334155] whitespace-pre-wrap break-words">
                        {activeComplaint.resolutionNotes}
                      </p>
                    </div>
                  ) : null}
                </Card>

                <Card className="p-4 space-y-4">
                  <div>
                    <Label className="mb-2 block">Update Status</Label>
                    <Select value={complaintStatusDraft} onValueChange={setComplaintStatusDraft}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose status" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPLAINT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {adminComplaintStatusLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complaintTeamDraft">Team Assignment</Label>
                    <Input
                      id="complaintTeamDraft"
                      placeholder="Security / Maintenance / Community"
                      value={complaintTeamDraft}
                      onChange={(e) => setComplaintTeamDraft(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="complaintResolutionNotes">Resolution Notes</Label>
                    <Textarea
                      id="complaintResolutionNotes"
                      rows={4}
                      placeholder="Required when resolving or closing the complaint"
                      value={complaintResolutionNotesDraft}
                      onChange={(e) => setComplaintResolutionNotesDraft(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full bg-[#00B386] hover:bg-[#00B386]/90 text-white"
                    onClick={() => void applyComplaintStatus()}
                    disabled={
                      complaintStatusUpdating ||
                      !complaintStatusDraft
                    }
                  >
                    {complaintStatusUpdating ? "Updating..." : "Apply Status"}
                  </Button>

                  <div className="pt-4 border-t border-[#E5E7EB] space-y-2">
                    <p className="text-sm text-[#64748B]">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setComplaintStatusDraft("IN_PROGRESS")}>
                        In Progress
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setComplaintStatusDraft("RESOLVED")}>
                        Resolved
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setComplaintStatusDraft("CLOSED")}>
                        Close
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void refreshActiveComplaint()}>
                        Refresh
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[#1E293B]">Conversation</h4>
                    <p className="text-sm text-[#64748B]">
                      Public replies are visible to the resident. Internal notes remain staff-only.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void refreshActiveComplaint()}>
                    Refresh Thread
                  </Button>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {complaintComments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">
                      No comments yet on this complaint.
                    </div>
                  ) : (
                    complaintComments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`rounded-xl border p-3 ${
                          comment.isInternal ? "border-[#F59E0B]/20 bg-[#FFFBEB]" : "border-[#E5E7EB] bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#1E293B]">
                              {comment.createdBy?.nameEN || comment.createdBy?.email || "User"}
                            </p>
                            {comment.isInternal ? (
                              <Badge className="bg-[#F59E0B]/10 text-[#F59E0B]">Internal</Badge>
                            ) : (
                              <Badge className="bg-[#10B981]/10 text-[#10B981]">Public</Badge>
                            )}
                          </div>
                          <span className="text-xs text-[#64748B]">{formatDateTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-[#334155] whitespace-pre-wrap mt-2">{comment.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-3 border-t border-[#E5E7EB] pt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="complaintReplyText">Reply / Note</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="complaintReplyInternal"
                        checked={complaintReplyInternal}
                        onCheckedChange={setComplaintReplyInternal}
                      />
                      <span className="text-sm text-[#64748B]">Internal note</span>
                    </div>
                  </div>
                  <Textarea
                    id="complaintReplyText"
                    rows={4}
                    placeholder={complaintReplyInternal ? "Visible to staff only..." : "Reply to the resident..."}
                    value={complaintReplyText}
                    onChange={(e) => setComplaintReplyText(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                      onClick={() => void submitComplaintReply()}
                      disabled={complaintReplySubmitting || !complaintReplyText.trim()}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {complaintReplySubmitting ? "Sending..." : "Post Reply"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <div className="py-8 text-sm text-[#64748B]">Select a complaint to view details.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
