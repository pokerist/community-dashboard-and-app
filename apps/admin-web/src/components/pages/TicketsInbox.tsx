import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Clock, Eye, MessageSquare, RefreshCw, Search, Send, UserX, X } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage, extractRows, formatDateTime, getPriorityColorClass, getStatusColorClass, humanizeEnum } from "../../lib/live-data";
import { adminPriorityLabel, adminTicketStatusLabel } from "../../lib/status-labels";

type TicketTab = "all" | "services" | "requests" | "complaints";
type TicketPreset = "all" | "pending" | "overdue" | "closed";
type PendingFocusEntity = {
  section?: string;
  entityType?: string | null;
  entityId?: string | null;
  serviceCategory?: string | null;
};

const SERVICE_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;
const COMPLAINT_STATUSES = ["NEW", "IN_PROGRESS", "PENDING_RESIDENT", "RESOLVED", "CLOSED"] as const;
const STATUS_FILTERS = ["all", "NEW", "IN_PROGRESS", "PENDING_RESIDENT", "RESOLVED", "CLOSED", "CANCELLED"] as const;

function isRequestCategory(v?: string | null) {
  const x = String(v ?? "").toUpperCase();
  return x === "REQUESTS" || x === "ADMIN";
}

function kindBadgeClass(kind: string) {
  if (kind === "COMPLAINT") return "bg-[#EF4444]/10 text-[#EF4444]";
  if (kind === "REQUEST") return "bg-[#8B5CF6]/10 text-[#8B5CF6]";
  return "bg-[#0B5FFF]/10 text-[#0B5FFF]";
}

export function TicketsInbox() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TicketTab>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ticketPreset, setTicketPreset] = useState<TicketPreset>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [residentFilter, setResidentFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [serviceRows, setServiceRows] = useState<any[]>([]);
  const [complaintRows, setComplaintRows] = useState<any[]>([]);
  const [units, setUnits] = useState<Array<{ id: string; label: string }>>([]);
  const [residents, setResidents] = useState<Array<{ id: string; label: string }>>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [replyInternal, setReplyInternal] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [returnToResidentOpen, setReturnToResidentOpen] = useState(false);
  const [returnToResidentMsg, setReturnToResidentMsg] = useState("");
  const [returnToResidentSubmitting, setReturnToResidentSubmitting] = useState(false);

  const resetInboxFilters = useCallback(() => {
    setTab("all");
    setTicketPreset("all");
    setSearch("");
    setStatusFilter("all");
    setUnitFilter("all");
    setResidentFilter("all");
    setFromDate("");
    setToDate("");
    setUrgentOnly(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("admin.ticketsInbox.filters");
      } catch {
        // ignore storage failures
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("admin.ticketsInbox.filters");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        search?: string;
        statusFilter?: string;
        tab?: TicketTab;
        preset?: TicketPreset;
      };
      setSearch(String(parsed.search ?? ""));
      setStatusFilter(String(parsed.statusFilter ?? "all"));
      setTab(
        parsed.tab === "services" ||
          parsed.tab === "requests" ||
          parsed.tab === "complaints"
          ? parsed.tab
          : "all",
      );
      setTicketPreset(
        parsed.preset === "pending" ||
          parsed.preset === "overdue" ||
          parsed.preset === "closed"
          ? parsed.preset
          : "all",
      );
    } catch {
      // ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "admin.ticketsInbox.filters",
        JSON.stringify({
          search,
          statusFilter,
          tab,
          preset: ticketPreset,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [search, statusFilter, tab, ticketPreset]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [srRes, cRes, userRes, unitRes] = await Promise.all([
        apiClient.get("/service-requests"),
        apiClient.get("/complaints", { params: { page: 1, limit: 100 } }),
        apiClient.get("/admin/users", { params: { userType: "resident", take: 500, skip: 0 } }),
        apiClient.get("/units", { params: { page: 1, limit: 100 } }),
      ]);
      setServiceRows(Array.isArray(srRes.data) ? srRes.data : []);
      setComplaintRows(extractRows(cRes.data));
      setResidents(
        extractRows<any>(userRes.data).map((u) => ({
          id: String(u.id),
          label: u.nameEN ?? u.nameAR ?? u.email ?? u.phone ?? String(u.id),
        })),
      );
      setUnits(
        extractRows<any>(unitRes.data).map((u) => ({
          id: String(u.id),
          label:
            [u.projectName, u.block ? `Block ${u.block}` : null, u.unitNumber ? `Unit ${u.unitNumber}` : null]
              .filter(Boolean)
              .join(" - ") || String(u.id),
        })),
      );
    } catch (e) {
      toast.error("Failed to load tickets", { description: errorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rows = useMemo(() => {
    const mappedServices = serviceRows.map((r: any) => {
      const kind = isRequestCategory(r?.service?.category) ? "REQUEST" : "SERVICE";
      return {
        key: `${kind}:${r.id}`,
        id: r.id,
        kind,
        title: r?.service?.name || (kind === "REQUEST" ? "Request Ticket" : "Service Ticket"),
        status: String(r.status || "NEW").toUpperCase(),
        priority: r.priority || "MEDIUM",
        updatedAt: r.updatedAt || r.requestedAt,
        createdAt: r.requestedAt || r.updatedAt,
        isUrgent: Boolean(r?.service?.isUrgent) || String(r?.priority || "").toUpperCase() === "CRITICAL",
        residentId: r?.createdBy?.id || "",
        residentName: r?.createdBy?.nameEN || r?.createdBy?.email || "—",
        residentSub: r?.createdBy?.email || r?.createdBy?.phone || "—",
        unitId: r?.unit?.id || "",
        unitLabel: `${r?.unit?.block ? `${r.unit.block} • ` : ""}${r?.unit?.unitNumber || "—"}`,
        raw: r,
      };
    });
    const mappedComplaints = complaintRows.map((c: any) => ({
      key: `COMPLAINT:${c.id}`,
      id: c.id,
      kind: "COMPLAINT",
      title:
        String(c?.title || "").trim() ||
        (c?.category ? `${humanizeEnum(c.category)} Complaint` : "Complaint"),
      team: String(c?.team || "").trim() || null,
      status: String(c.status || "NEW").toUpperCase(),
      priority: c.priority || "MEDIUM",
      updatedAt: c.updatedAt || c.createdAt,
      createdAt: c.createdAt,
      residentId: c.reporterId || c?.reporter?.id || "",
      residentName: c?.reporter?.nameEN || c?.reporter?.email || "—",
      residentSub: c?.reporter?.email || c?.reporter?.phone || "—",
      unitId: c.unitId || c?.unit?.id || "",
      unitLabel: `${c?.unit?.block ? `${c.unit.block} • ` : ""}${c?.unit?.unitNumber || "—"}`,
      raw: c,
    }));
    return [...mappedServices, ...mappedComplaints].sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });
  }, [complaintRows, serviceRows]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      services: rows.filter((r) => r.kind === "SERVICE").length,
      requests: rows.filter((r) => r.kind === "REQUEST").length,
      complaints: rows.filter((r) => r.kind === "COMPLAINT").length,
      urgent: rows.filter((r) => (r.kind === "SERVICE" || r.kind === "REQUEST") && r.isUrgent).length,
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    const now = Date.now();
    const overdueThresholdMs = 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (tab === "services" && r.kind !== "SERVICE") return false;
      if (tab === "requests" && r.kind !== "REQUEST") return false;
      if (tab === "complaints" && r.kind !== "COMPLAINT") return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (ticketPreset === "pending" && !(r.status === "NEW" || r.status === "IN_PROGRESS" || r.status === "PENDING_RESIDENT")) {
        return false;
      }
      if (
        ticketPreset === "closed" &&
        !(r.status === "RESOLVED" || r.status === "CLOSED" || r.status === "CANCELLED")
      ) {
        return false;
      }
      if (ticketPreset === "overdue") {
        if (!(r.status === "NEW" || r.status === "IN_PROGRESS" || r.status === "PENDING_RESIDENT")) return false;
        const createdTs = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
        if (!Number.isFinite(createdTs) || now - createdTs < overdueThresholdMs) {
          return false;
        }
      }
      if (unitFilter !== "all" && String(r.unitId || "") !== unitFilter) return false;
      if (residentFilter !== "all" && String(r.residentId || "") !== residentFilter) return false;
      if (urgentOnly) {
        if (r.kind !== "SERVICE" && r.kind !== "REQUEST") return false;
        if (!r.isUrgent) return false;
      }
      const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      if (q) {
        const blob = [r.id, r.title, r.team, r.kind, r.status, r.priority, r.residentName, r.residentSub, r.unitLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, tab, statusFilter, ticketPreset, unitFilter, residentFilter, fromDate, toDate, urgentOnly]);

  const loadTicketDetail = useCallback(async (row: any) => {
    const base = {
      kind: row.kind,
      id: row.id,
      detail: row.raw,
      comments: [],
      statusDraft: row.status,
      resolutionNotesDraft: row.kind === "COMPLAINT" ? String(row.raw?.resolutionNotes || "") : "",
      loading: true,
    };
    setActive(base);
    setDialogOpen(true);
    setReplyText("");
    setReplyInternal(false);
    setReturnToResidentOpen(false);
    setReturnToResidentMsg("");
    try {
      if (row.kind === "COMPLAINT") {
        const [detailRes, commentsRes] = await Promise.all([
          apiClient.get(`/complaints/${row.id}`),
          apiClient.get(`/complaints/${row.id}/comments`),
        ]);
        setActive({
          ...base,
          detail: detailRes.data,
          comments: Array.isArray(commentsRes.data) ? commentsRes.data : [],
          statusDraft: String(detailRes.data?.status || "NEW").toUpperCase(),
          resolutionNotesDraft: String(detailRes.data?.resolutionNotes || ""),
          loading: false,
        });
      } else {
        const [detailRes, commentsRes] = await Promise.all([
          apiClient.get(`/service-requests/${row.id}`),
          apiClient.get(`/service-requests/${row.id}/comments`),
        ]);
        setActive({
          ...base,
          detail: detailRes.data,
          comments: Array.isArray(commentsRes.data) ? commentsRes.data : [],
          statusDraft: String(detailRes.data?.status || "NEW").toUpperCase(),
          loading: false,
        });
      }
    } catch (e) {
      toast.error("Failed to load ticket details", { description: errorMessage(e) });
      setActive((prev: any) => (prev ? { ...prev, loading: false } : prev));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || rows.length === 0) return;

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
    if (!targetId || targetSection !== "tickets") return;

    const targetRow = rows.find((row) => {
      if (String(row.id) !== targetId) return false;
      if (targetEntityType === "COMPLAINT") return row.kind === "COMPLAINT";
      if (targetEntityType === "SERVICE_REQUEST") return row.kind === "SERVICE" || row.kind === "REQUEST";
      return true;
    });

    if (!targetRow) return;

    if (targetRow.kind === "COMPLAINT") setTab("complaints");
    else if (targetRow.kind === "REQUEST") setTab("requests");
    else if (targetRow.kind === "SERVICE") setTab("services");

    window.sessionStorage.removeItem("admin.focusEntity");
    void loadTicketDetail(targetRow);
  }, [loadTicketDetail, rows]);

  const refreshActive = useCallback(async () => {
    if (!active) return;
    const existingRow = rows.find((r) => r.id === active.id && r.kind === active.kind);
    await loadTicketDetail(
      existingRow || {
        id: active.id,
        kind: active.kind,
        status: active.statusDraft || active.detail?.status || "NEW",
        raw: active.detail,
      },
    );
  }, [active, loadTicketDetail, rows]);

  const submitReply = useCallback(async () => {
    if (!active) return;
    const body = replyText.trim();
    if (!body) {
      toast.error("Reply message is required");
      return;
    }
    setReplySubmitting(true);
    try {
      if (active.kind === "COMPLAINT") {
        await apiClient.post(`/complaints/${active.id}/comments`, { body, isInternal: replyInternal });
      } else {
        await apiClient.post(`/service-requests/${active.id}/comments`, { body, isInternal: replyInternal });
      }
      toast.success(replyInternal ? "Internal note posted" : "Reply posted");
      setReplyText("");
      setReplyInternal(false);
      await Promise.all([loadAll(), refreshActive()]);
    } catch (e) {
      toast.error("Failed to post reply", { description: errorMessage(e) });
    } finally {
      setReplySubmitting(false);
    }
  }, [active, loadAll, refreshActive, replyInternal, replyText]);

  const applyStatus = useCallback(async () => {
    if (!active?.statusDraft) return;
    setStatusSubmitting(true);
    try {
      if (active.kind === "COMPLAINT") {
        const s = String(active.statusDraft).toUpperCase();
        if ((s === "RESOLVED" || s === "CLOSED") && !String(active.resolutionNotesDraft || "").trim()) {
          toast.error("Resolution notes required", {
            description: "Add notes before resolving or closing a complaint.",
          });
          setStatusSubmitting(false);
          return;
        }
        await apiClient.patch(`/complaints/${active.id}/status`, {
          status: s,
          resolutionNotes: String(active.resolutionNotesDraft || "").trim() || undefined,
        });
      } else {
        await apiClient.patch(`/service-requests/${active.id}`, { status: active.statusDraft });
      }
      toast.success("Ticket status updated");
      await Promise.all([loadAll(), refreshActive()]);
    } catch (e) {
      toast.error("Failed to update ticket", { description: errorMessage(e) });
    } finally {
      setStatusSubmitting(false);
    }
  }, [active, loadAll, refreshActive]);

  const submitReturnToResident = useCallback(async () => {
    if (!active || active.kind !== "COMPLAINT") return;
    const msg = returnToResidentMsg.trim();
    if (!msg) {
      toast.error("Please enter a message for the resident");
      return;
    }
    setReturnToResidentSubmitting(true);
    try {
      await apiClient.patch(`/complaints/${active.id}/return-to-resident`, { message: msg });
      toast.success("Complaint returned to resident", {
        description: "The resident has been notified and a comment was added.",
      });
      setReturnToResidentOpen(false);
      setReturnToResidentMsg("");
      await Promise.all([loadAll(), refreshActive()]);
    } catch (e) {
      toast.error("Failed to return complaint to resident", { description: errorMessage(e) });
    } finally {
      setReturnToResidentSubmitting(false);
    }
  }, [active, loadAll, refreshActive, returnToResidentMsg]);

  const activityRows = useMemo(() => {
    if (!active?.detail) return [];
    const createdAt = active.kind === "COMPLAINT" ? active.detail.createdAt : active.detail.requestedAt || active.detail.createdAt;
    const items: any[] = [
      { id: "created", type: "status", title: `${humanizeEnum(active.kind)} submitted`, at: createdAt },
      {
        id: "current-status",
        type: "status",
        title: `Current status: ${adminTicketStatusLabel(active.kind, active.detail.status)}`,
        at: active.detail.updatedAt || createdAt,
      },
    ];
    for (const c of active.comments || []) {
      items.push({
        id: `c-${c.id}`,
        type: "comment",
        title: c?.createdBy?.nameEN || c?.createdBy?.email || "User",
        body: c.body,
        at: c.createdAt,
        isInternal: !!c.isInternal,
      });
    }
    return items.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  }, [active]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Tickets Inbox</h1>
          <p className="text-[#64748B] mt-1">
            Unified view for resident service tickets, requests, and complaints.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadAll()} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
        <Button variant="outline" onClick={resetInboxFilters}>
          Reset Filters
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <Card className="p-4 rounded-xl border border-[#E2E8F0] hover:shadow-md transition-shadow">
          <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-[#1E293B] mt-1">{counts.all}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">All tickets</p>
        </Card>
        <Card className="p-4 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF]/50 hover:shadow-md transition-shadow">
          <p className="text-xs font-medium text-[#3B82F6] uppercase tracking-wide">Services</p>
          <p className="text-2xl font-bold text-[#1E40AF] mt-1">{counts.services}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">Service requests</p>
        </Card>
        <Card className="p-4 rounded-xl border border-[#EDE9FE] bg-[#F5F3FF]/50 hover:shadow-md transition-shadow">
          <p className="text-xs font-medium text-[#7C3AED] uppercase tracking-wide">Requests</p>
          <p className="text-2xl font-bold text-[#5B21B6] mt-1">{counts.requests}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">Admin requests</p>
        </Card>
        <Card className="p-4 rounded-xl border border-[#FEE2E2] bg-[#FFF5F5]/50 hover:shadow-md transition-shadow">
          <p className="text-xs font-medium text-[#EF4444] uppercase tracking-wide">Complaints</p>
          <p className="text-2xl font-bold text-[#B91C1C] mt-1">{counts.complaints}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">Resident complaints</p>
        </Card>
        <Card className="p-4 rounded-xl border border-[#FED7AA] bg-[#FFF7ED]/50 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#EA580C]" />
            <p className="text-xs font-medium text-[#EA580C] uppercase tracking-wide">Urgent</p>
          </div>
          <p className="text-2xl font-bold text-[#9A3412] mt-1">{counts.urgent}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">Needs attention</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TicketTab)} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={ticketPreset === "all" ? "default" : "outline"}
          className={ticketPreset === "all" ? "bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" : ""}
          onClick={() => setTicketPreset("all")}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={ticketPreset === "pending" ? "default" : "outline"}
          className={ticketPreset === "pending" ? "bg-[#F59E0B] hover:bg-[#D97706] text-white" : ""}
          onClick={() => {
            setTicketPreset("pending");
            setStatusFilter("all");
          }}
        >
          Pending
        </Button>
        <Button
          size="sm"
          variant={ticketPreset === "overdue" ? "default" : "outline"}
          className={ticketPreset === "overdue" ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white" : ""}
          onClick={() => {
            setTicketPreset("overdue");
            setStatusFilter("all");
          }}
        >
          Overdue
        </Button>
        <Button
          size="sm"
          variant={ticketPreset === "closed" ? "default" : "outline"}
          className={ticketPreset === "closed" ? "bg-[#10B981] hover:bg-[#059669] text-white" : ""}
          onClick={() => {
            setTicketPreset("closed");
            setStatusFilter("all");
          }}
        >
          Closed
        </Button>
      </div>

      <Card className="shadow-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets..." className="pl-10 rounded-lg" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : adminTicketStatusLabel("SERVICE", s)}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All units</SelectItem>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={residentFilter} onValueChange={setResidentFilter}>
            <SelectTrigger><SelectValue placeholder="Resident" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All residents</SelectItem>{residents.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg" />
          <div className="xl:col-span-6 flex items-center justify-end gap-2 pt-1">
            <Label htmlFor="ticketsUrgentOnly" className="text-xs text-[#475569]">
              Urgent only
            </Label>
            <Switch id="ticketsUrgentOnly" checked={urgentOnly} onCheckedChange={setUrgentOnly} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Type</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Resident</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((r) => (
              <TableRow key={r.key} className="hover:bg-[#F9FAFB]">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge className={kindBadgeClass(r.kind)}>{humanizeEnum(r.kind)}</Badge>
                    {r.isUrgent ? (
                      <Badge className="bg-[#FEE2E2] text-[#B91C1C]">Urgent</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#1E293B]">{r.title}</p>
                    <p className="text-xs text-[#64748B]">
                      {r.kind === "COMPLAINT"
                        ? (r.raw?.complaintNumber || r.id.slice(0, 8))
                        : r.id.slice(0, 8)}
                      {r.kind === "COMPLAINT" && r.team ? ` • ${r.team}` : ""}
                    </p>
                  </div>
                </TableCell>
                <TableCell><div className="space-y-1"><p className="text-sm text-[#1E293B]">{r.residentName}</p><p className="text-xs text-[#64748B]">{r.residentSub}</p></div></TableCell>
                <TableCell className="text-[#64748B]">{r.unitLabel}</TableCell>
                <TableCell><Badge className={getPriorityColorClass(r.priority || "MEDIUM")}>{adminPriorityLabel(r.priority || "MEDIUM")}</Badge></TableCell>
                <TableCell><Badge className={getStatusColorClass(r.status)}>{adminTicketStatusLabel(r.kind, r.status)}</Badge></TableCell>
                <TableCell className="text-[#64748B]">{formatDateTime(r.updatedAt || r.createdAt)}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => void loadTicketDetail(r)}><Eye className="w-4 h-4 mr-1" />Open</Button></TableCell>
              </TableRow>
            ))}
            {!loading && filteredRows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-[#64748B]">No tickets match the current filters.</TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setActive(null); setReturnToResidentOpen(false); setReturnToResidentMsg(""); } }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket Details</DialogTitle>
            <DialogDescription>Review ticket details, reply to residents, and update workflow status.</DialogDescription>
          </DialogHeader>
          {!active || active.loading ? (
            <div className="py-10 text-center text-sm text-[#64748B]">{active?.loading ? "Loading ticket..." : "Select a ticket."}</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="p-4 lg:col-span-2 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-[#64748B] uppercase tracking-wide">{humanizeEnum(active.kind)}</p>
                      <h4 className="text-[#1E293B] mt-1">
                        {active.kind === "COMPLAINT"
                          ? active.detail?.title || `${humanizeEnum(active.detail?.category || "Complaint")} Complaint`
                          : (active.detail?.service?.name || "Ticket")}
                      </h4>
                      <p className="text-xs text-[#64748B] mt-1">ID: {active.kind === "COMPLAINT" ? (active.detail?.complaintNumber || active.id) : active.id}</p>
                    </div>
                    <Badge className={getStatusColorClass(active.detail?.status)}>{adminTicketStatusLabel(active.kind, active.detail?.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><p className="text-[#64748B]">Resident</p><p className="text-[#1E293B]">{active.kind === "COMPLAINT" ? (active.detail?.reporter?.nameEN || active.detail?.reporter?.email || "—") : (active.detail?.createdBy?.nameEN || active.detail?.createdBy?.email || "—")}</p></div>
                    <div><p className="text-[#64748B]">Unit</p><p className="text-[#1E293B]">{active.detail?.unit?.block ? `${active.detail.unit.block} • ` : ""}{active.detail?.unit?.unitNumber || "—"}</p></div>
                    <div><p className="text-[#64748B]">Priority</p><p className="text-[#1E293B]">{adminPriorityLabel(active.detail?.priority || "MEDIUM")}</p></div>
                    <div><p className="text-[#64748B]">Last Updated</p><p className="text-[#1E293B]">{formatDateTime(active.detail?.updatedAt || active.detail?.requestedAt || active.detail?.createdAt)}</p></div>
                  </div>
                  <div className="border-t border-[#E5E7EB] pt-4">
                    <p className="text-[#64748B] text-sm mb-2">Resident Summary</p>
                    <p className="text-sm text-[#1E293B] whitespace-pre-wrap break-words">{active.detail?.description || "—"}</p>
                  </div>
                  {active.kind !== "COMPLAINT" && Array.isArray(active.detail?.fieldValues) && active.detail.fieldValues.length > 0 ? (
                    <div className="border-t border-[#E5E7EB] pt-4">
                      <p className="text-[#64748B] text-sm mb-2">Submitted Details</p>
                      <div className="space-y-2">
                        {active.detail.fieldValues.map((fv: any, idx: number) => (
                          <div key={fv.id || idx} className="grid grid-cols-[180px_1fr] gap-3 text-sm">
                            <span className="text-[#64748B]">{fv?.field?.label || "Field"}</span>
                            <span className="text-[#1E293B] break-words">{fv.valueText ?? (fv.valueNumber != null ? String(fv.valueNumber) : null) ?? (fv.valueBool != null ? (fv.valueBool ? "Yes" : "No") : null) ?? (fv.valueDate ? formatDateTime(fv.valueDate) : null) ?? (fv.fileAttachmentId ? "File attached" : "—")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
                <Card className="p-4 space-y-4">
                  <div>
                    <Label className="mb-2 block text-[#1E293B] font-medium">Update Status</Label>
                    <Select value={active.statusDraft} onValueChange={(v) => setActive((p: any) => p ? { ...p, statusDraft: v } : p)}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Choose status" /></SelectTrigger>
                      <SelectContent>{(active.kind === "COMPLAINT" ? COMPLAINT_STATUSES : SERVICE_STATUSES).map((s) => <SelectItem key={s} value={s}>{adminTicketStatusLabel(active.kind, s)}</SelectItem>)}</SelectContent>
                    </Select>
                    {active.kind === "COMPLAINT" && (active.statusDraft === "RESOLVED" || active.statusDraft === "CLOSED") ? (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor="unifiedResolutionNotes" className="text-sm text-[#475569]">Resolution Notes <span className="text-red-500">*</span></Label>
                        <Textarea id="unifiedResolutionNotes" rows={3} value={active.resolutionNotesDraft || ""} onChange={(e) => setActive((p: any) => p ? { ...p, resolutionNotesDraft: e.target.value } : p)} placeholder="Describe how this complaint was resolved..." className="rounded-lg text-sm" />
                      </div>
                    ) : null}
                    <Button className="w-full mt-3 bg-[#00B386] hover:bg-[#00A07A] text-white rounded-lg font-medium" onClick={() => void applyStatus()} disabled={statusSubmitting || !active.statusDraft || active.statusDraft === String(active.detail?.status || "").toUpperCase()}>
                      {statusSubmitting ? "Updating..." : "Apply Status Change"}
                    </Button>
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-4 border-t border-[#E5E7EB] space-y-2">
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "IN_PROGRESS" } : p)}>
                        <Clock className="w-3 h-3 mr-1" /> In Progress
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "RESOLVED" } : p)}>
                        Resolved
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "CLOSED" } : p)}>
                        Close Ticket
                      </Button>
                      {active.kind !== "COMPLAINT"
                        ? <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "CANCELLED" } : p)}><X className="w-3 h-3 mr-1" />Cancel</Button>
                        : null}
                    </div>
                  </div>

                  {/* Return to Resident — only for IN_PROGRESS complaints */}
                  {active.kind === "COMPLAINT" && String(active.detail?.status || "").toUpperCase() === "IN_PROGRESS" ? (
                    <div className="pt-4 border-t border-[#E5E7EB]">
                      {!returnToResidentOpen ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg text-[#7C3AED] border-[#7C3AED]/30 hover:bg-[#7C3AED]/5 text-xs font-medium"
                          onClick={() => setReturnToResidentOpen(true)}
                        >
                          <ArrowLeft className="w-3 h-3 mr-1.5" />
                          Return to Resident
                        </Button>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-[#7C3AED]/20 bg-[#F5F3FF] p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-[#7C3AED] flex items-center gap-1.5">
                              <UserX className="w-3.5 h-3.5" />
                              Return to Resident
                            </p>
                            <button
                              className="text-[#64748B] hover:text-[#1E293B]"
                              onClick={() => { setReturnToResidentOpen(false); setReturnToResidentMsg(""); }}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-[#64748B]">
                            This will set status to "Awaiting Resident Response" and send the resident a notification with your message.
                          </p>
                          <Textarea
                            rows={3}
                            value={returnToResidentMsg}
                            onChange={(e) => setReturnToResidentMsg(e.target.value)}
                            placeholder="E.g. We need you to confirm the issue still persists and provide photos..."
                            className="rounded-lg text-sm bg-white"
                          />
                          <Button
                            size="sm"
                            className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-xs font-medium"
                            onClick={() => void submitReturnToResident()}
                            disabled={returnToResidentSubmitting || !returnToResidentMsg.trim()}
                          >
                            <Send className="w-3 h-3 mr-1.5" />
                            {returnToResidentSubmitting ? "Sending..." : "Send & Update Status"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Awaiting Resident banner */}
                  {active.kind === "COMPLAINT" && String(active.detail?.status || "").toUpperCase() === "PENDING_RESIDENT" ? (
                    <div className="pt-4 border-t border-[#E5E7EB]">
                      <div className="rounded-xl border border-[#7C3AED]/30 bg-[#F5F3FF] p-3 flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-[#7C3AED] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-[#7C3AED]">Awaiting Resident Response</p>
                          <p className="text-xs text-[#64748B] mt-1">This complaint was returned to the resident. Once they respond, set status back to "In Progress" to continue handling.</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Card>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[#1E293B]">Conversation</h4>
                      <p className="text-sm text-[#64748B]">Public replies are visible to the resident. Internal notes are staff-only.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void refreshActive()}>Refresh</Button>
                  </div>
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {active.comments?.length ? active.comments.map((c: any) => (
                      <div key={c.id} className={`rounded-xl border p-3 ${c.isInternal ? "border-[#F59E0B]/20 bg-[#FFFBEB]" : "border-[#E5E7EB] bg-white"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#1E293B]">{c?.createdBy?.nameEN || c?.createdBy?.email || "User"}</p>
                            <Badge className={c.isInternal ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#10B981]/10 text-[#10B981]"}>{c.isInternal ? "Internal" : "Public"}</Badge>
                          </div>
                          <span className="text-xs text-[#64748B]">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-sm text-[#334155] whitespace-pre-wrap mt-2">{c.body}</p>
                      </div>
                    )) : <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">No comments yet on this ticket.</div>}
                  </div>
                  <div className="space-y-3 border-t border-[#E5E7EB] pt-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="unifiedTicketReply">Reply / Note</Label>
                      <div className="flex items-center gap-2"><Switch id="unifiedTicketInternal" checked={replyInternal} onCheckedChange={setReplyInternal} /><span className="text-sm text-[#64748B]">Internal note</span></div>
                    </div>
                    <Textarea id="unifiedTicketReply" rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={replyInternal ? "Visible to staff only..." : "Reply to resident..."} />
                    <div className="flex justify-end">
                      <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void submitReply()} disabled={replySubmitting || !replyText.trim()}>
                        <Send className="w-4 h-4 mr-2" />{replySubmitting ? "Sending..." : "Post Reply"}
                      </Button>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 space-y-4">
                  <div>
                    <h4 className="text-[#1E293B]">Activity Timeline</h4>
                    <p className="text-sm text-[#64748B]">Combined timeline from ticket creation, current status, and conversation activity.</p>
                  </div>
                  <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                    {activityRows.map((item) => (
                      <div key={item.id} className="rounded-xl border border-[#E5E7EB] bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={item.type === "status" ? "bg-[#0B5FFF]/10 text-[#0B5FFF]" : item.isInternal ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "bg-[#10B981]/10 text-[#10B981]"}>
                                {item.type === "status" ? "Status" : item.isInternal ? "Internal Note" : "Reply"}
                              </Badge>
                              <p className="text-sm font-medium text-[#1E293B]">{item.title}</p>
                            </div>
                            {item.body ? <p className="text-sm text-[#475569] mt-2 whitespace-pre-wrap">{item.body}</p> : null}
                          </div>
                          <span className="text-xs text-[#64748B]">{formatDateTime(item.at)}</span>
                        </div>
                      </div>
                    ))}
                    {activityRows.length === 0 ? <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">No activity recorded yet.</div> : null}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
