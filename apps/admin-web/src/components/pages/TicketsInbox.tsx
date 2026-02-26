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
import { Eye, RefreshCw, Search, Send } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage, extractRows, formatDateTime, getPriorityColorClass, getStatusColorClass, humanizeEnum } from "../../lib/live-data";
import { adminPriorityLabel, adminTicketStatusLabel } from "../../lib/status-labels";

type TicketTab = "all" | "services" | "requests" | "complaints";

const SERVICE_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;
const COMPLAINT_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const STATUS_FILTERS = ["all", "NEW", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"] as const;

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
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [residentFilter, setResidentFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
      title: c?.category ? `${humanizeEnum(c.category)} Complaint` : "Complaint",
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
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return rows.filter((r) => {
      if (tab === "services" && r.kind !== "SERVICE") return false;
      if (tab === "requests" && r.kind !== "REQUEST") return false;
      if (tab === "complaints" && r.kind !== "COMPLAINT") return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (unitFilter !== "all" && String(r.unitId || "") !== unitFilter) return false;
      if (residentFilter !== "all" && String(r.residentId || "") !== residentFilter) return false;
      const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      if (fromTs != null && ts < fromTs) return false;
      if (toTs != null && ts > toTs) return false;
      if (q) {
        const blob = [r.id, r.title, r.kind, r.status, r.priority, r.residentName, r.residentSub, r.unitLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, tab, statusFilter, unitFilter, residentFilter, fromDate, toDate]);

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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-4 shadow-card rounded-xl"><p className="text-xs text-[#64748B]">All Tickets</p><p className="text-xl font-semibold text-[#1E293B] mt-1">{counts.all}</p></Card>
        <Card className="p-4 shadow-card rounded-xl"><p className="text-xs text-[#64748B]">Services</p><p className="text-xl font-semibold text-[#1E293B] mt-1">{counts.services}</p></Card>
        <Card className="p-4 shadow-card rounded-xl"><p className="text-xs text-[#64748B]">Requests</p><p className="text-xl font-semibold text-[#1E293B] mt-1">{counts.requests}</p></Card>
        <Card className="p-4 shadow-card rounded-xl"><p className="text-xs text-[#64748B]">Complaints</p><p className="text-xl font-semibold text-[#1E293B] mt-1">{counts.complaints}</p></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TicketTab)} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>
      </Tabs>

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
                <TableCell><Badge className={kindBadgeClass(r.kind)}>{humanizeEnum(r.kind)}</Badge></TableCell>
                <TableCell><div className="space-y-1"><p className="text-sm font-medium text-[#1E293B]">{r.title}</p><p className="text-xs text-[#64748B]">{r.kind === "COMPLAINT" ? (r.raw?.complaintNumber || r.id.slice(0,8)) : r.id.slice(0,8)}</p></div></TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setActive(null); } }}>
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
                      <h4 className="text-[#1E293B] mt-1">{active.kind === "COMPLAINT" ? `${humanizeEnum(active.detail?.category || "Complaint")} Complaint` : (active.detail?.service?.name || "Ticket")}</h4>
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
                    <Label className="mb-2 block">Update Status</Label>
                    <Select value={active.statusDraft} onValueChange={(v) => setActive((p: any) => p ? { ...p, statusDraft: v } : p)}>
                      <SelectTrigger><SelectValue placeholder="Choose status" /></SelectTrigger>
                      <SelectContent>{(active.kind === "COMPLAINT" ? COMPLAINT_STATUSES : SERVICE_STATUSES).map((s) => <SelectItem key={s} value={s}>{adminTicketStatusLabel(active.kind, s)}</SelectItem>)}</SelectContent>
                    </Select>
                    {active.kind === "COMPLAINT" ? (
                      <div className="mt-3 space-y-2">
                        <Label htmlFor="unifiedResolutionNotes">Resolution Notes</Label>
                        <Textarea id="unifiedResolutionNotes" rows={3} value={active.resolutionNotesDraft || ""} onChange={(e) => setActive((p: any) => p ? { ...p, resolutionNotesDraft: e.target.value } : p)} placeholder="Required for resolved/closed complaints" />
                      </div>
                    ) : null}
                    <Button className="w-full mt-3 bg-[#00B386] hover:bg-[#00B386]/90 text-white" onClick={() => void applyStatus()} disabled={statusSubmitting || !active.statusDraft || active.statusDraft === String(active.detail?.status || "").toUpperCase()}>
                      {statusSubmitting ? "Updating..." : "Apply Status"}
                    </Button>
                  </div>
                  <div className="pt-4 border-t border-[#E5E7EB] space-y-2">
                    <p className="text-sm text-[#64748B]">Quick Actions</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "IN_PROGRESS" } : p)}>In Progress</Button>
                      <Button variant="outline" size="sm" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "RESOLVED" } : p)}>Resolved</Button>
                      <Button variant="outline" size="sm" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "CLOSED" } : p)}>Close</Button>
                      {active.kind !== "COMPLAINT" ? <Button variant="outline" size="sm" onClick={() => setActive((p: any) => p ? { ...p, statusDraft: "CANCELLED" } : p)}>Cancel</Button> : <div />}
                    </div>
                  </div>
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
