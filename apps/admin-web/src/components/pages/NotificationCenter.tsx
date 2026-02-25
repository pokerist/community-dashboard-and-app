import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Eye, Plus, RefreshCw, RotateCcw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import {
  errorMessage,
  extractMeta,
  extractRows,
  formatDateTime,
  getStatusColorClass,
  humanizeEnum,
} from "../../lib/live-data";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Textarea } from "../ui/textarea";

const CHANNELS = ["IN_APP", "EMAIL", "SMS", "PUSH"] as const;
const AUDIENCES = ["ALL", "SPECIFIC_RESIDENCES", "SPECIFIC_BLOCKS", "SPECIFIC_UNITS"] as const;
const TYPES = [
  "ANNOUNCEMENT",
  "PAYMENT_REMINDER",
  "MAINTENANCE_ALERT",
  "EVENT_NOTIFICATION",
  "EMERGENCY_ALERT",
  "OTP",
] as const;

type NotificationRow = {
  id: string;
  title: string;
  type: string;
  status: string;
  channels: string[];
  targetAudience: string;
  audienceMeta?: any;
  messageEn: string;
  messageAr?: string | null;
  sentAt?: string | null;
  createdAt?: string | null;
  logs: Array<{
    id: string;
    channel: string;
    recipient: string;
    status: string;
    providerResponse?: any;
    updatedAt?: string | null;
    createdAt?: string | null;
  }>;
};

type Option = { id: string; label: string };
type ProvidersStatus = {
  email?: { configured?: boolean; mockMode?: boolean };
  sms?: { configured?: boolean; mockMode?: boolean };
  push?: { configured?: boolean; mockMode?: boolean };
};

type ComposeForm = {
  type: string;
  title: string;
  messageEn: string;
  messageAr: string;
  targetAudience: (typeof AUDIENCES)[number];
  channels: string[];
  scheduledAtLocal: string;
  selectedUserIds: string[];
  selectedUnitIds: string[];
  selectedBlocks: string[];
};

const defaultComposeForm: ComposeForm = {
  type: "ANNOUNCEMENT",
  title: "",
  messageEn: "",
  messageAr: "",
  targetAudience: "ALL",
  channels: ["IN_APP"],
  scheduledAtLocal: "",
  selectedUserIds: [],
  selectedUnitIds: [],
  selectedBlocks: [],
};

function parseFailure(providerResponse: unknown): string {
  if (!providerResponse) return "";
  if (typeof providerResponse === "string") return providerResponse;
  if (typeof providerResponse === "object") {
    const obj = providerResponse as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    try {
      return JSON.stringify(obj);
    } catch {
      return "Provider response available";
    }
  }
  return String(providerResponse);
}

function audienceSummary(row: NotificationRow): string {
  const meta = row.audienceMeta ?? {};
  if (row.targetAudience === "ALL") return "All users";
  if (row.targetAudience === "SPECIFIC_RESIDENCES") return `${Array.isArray(meta.userIds) ? meta.userIds.length : 0} users`;
  if (row.targetAudience === "SPECIFIC_UNITS") return `${Array.isArray(meta.unitIds) ? meta.unitIds.length : 0} units`;
  const blocksRaw = meta.blocks ?? meta.block;
  const blocks = Array.isArray(blocksRaw) ? blocksRaw : blocksRaw ? [blocksRaw] : [];
  return `${blocks.length} blocks`;
}

export function NotificationCenter() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [residentOptions, setResidentOptions] = useState<Option[]>([]);
  const [unitOptions, setUnitOptions] = useState<Array<Option & { block?: string }>>([]);
  const [meta, setMeta] = useState<{ total?: number }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [detailsRow, setDetailsRow] = useState<NotificationRow | null>(null);
  const [compose, setCompose] = useState<ComposeForm>(defaultComposeForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providersStatus, setProvidersStatus] = useState<ProvidersStatus>({});

  const loadPage = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [notificationsRes, usersRes, unitsRes, providersRes] = await Promise.all([
        apiClient.get("/notifications/admin/all", { params: { page: 1, limit: 200 } }),
        apiClient.get("/admin/users", { params: { userType: "resident", take: 500, skip: 0 } }),
        apiClient.get("/units", { params: { page: 1, limit: 100 } }),
        apiClient.get("/notifications/admin/providers/status"),
      ]);

      const notifications = extractRows(notificationsRes.data).map((n: any) => ({
        id: String(n.id),
        title: String(n.title ?? "Untitled"),
        type: String(n.type ?? "ANNOUNCEMENT"),
        status: String(n.status ?? "PENDING"),
        channels: Array.isArray(n.channels) ? n.channels.map((c: any) => String(c)) : [],
        targetAudience: String(n.targetAudience ?? "ALL"),
        audienceMeta: n.audienceMeta,
        messageEn: String(n.messageEn ?? ""),
        messageAr: n.messageAr ?? null,
        sentAt: n.sentAt ?? null,
        createdAt: n.createdAt ?? null,
        logs: Array.isArray(n.logs)
          ? n.logs.map((log: any) => ({
              id: String(log.id),
              channel: String(log.channel ?? "UNKNOWN"),
              recipient: String(log.recipient ?? ""),
              status: String(log.status ?? "UNKNOWN"),
              providerResponse: log.providerResponse,
              updatedAt: log.updatedAt ?? null,
              createdAt: log.createdAt ?? null,
            }))
          : [],
      })) as NotificationRow[];

      const residents = extractRows(usersRes.data)
        .map((u: any) => ({
          id: String(u.id),
          label: String(u.nameEN || u.nameAR || u.email || u.phone || u.id),
        }))
        .filter((u: Option) => !!u.id);

      const units = extractRows(unitsRes.data)
        .map((u: any) => ({
          id: String(u.id),
          label: [u.projectName, u.block ? `Block ${u.block}` : null, u.unitNumber ? `Unit ${u.unitNumber}` : null]
            .filter(Boolean)
            .join(" - ") || String(u.id),
          block: u.block ? String(u.block) : undefined,
        }))
        .filter((u: Option) => !!u.id);

      setRows(notifications);
      setResidentOptions(residents);
      setUnitOptions(units);
      setMeta(extractMeta(notificationsRes.data));
      setProvidersStatus((providersRes.data?.providers ?? {}) as ProvidersStatus);
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load notifications", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const blockOptions = useMemo(
    () =>
      Array.from(new Set(unitOptions.map((u) => u.block).filter(Boolean) as string[])).map((b) => ({
        id: b,
        label: `Block ${b}`,
      })),
    [unitOptions],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (channelFilter !== "all" && !row.channels.includes(channelFilter)) return false;
      if (audienceFilter !== "all" && row.targetAudience !== audienceFilter) return false;
      const compareDate = row.sentAt || row.createdAt;
      if (dateFrom && compareDate) {
        if (new Date(compareDate) < new Date(`${dateFrom}T00:00:00`)) return false;
      }
      if (dateTo && compareDate) {
        if (new Date(compareDate) > new Date(`${dateTo}T23:59:59`)) return false;
      }
      if (!q) return true;
      return [row.title, row.type, row.status, row.targetAudience, row.messageEn]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter, channelFilter, audienceFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    let failed = 0;
    let delivered = 0;
    let totalLogs = 0;
    filteredRows.forEach((row) => {
      row.logs.forEach((log) => {
        totalLogs += 1;
        const s = String(log.status).toUpperCase();
        if (s === "FAILED") failed += 1;
        if (s === "DELIVERED" || s === "READ") delivered += 1;
      });
    });
    return { failed, delivered, totalLogs };
  }, [filteredRows]);

  const buildAudienceMeta = () => {
    if (compose.targetAudience === "ALL") return undefined;
    if (compose.targetAudience === "SPECIFIC_RESIDENCES") return { userIds: compose.selectedUserIds };
    if (compose.targetAudience === "SPECIFIC_UNITS") return { unitIds: compose.selectedUnitIds };
    return { blocks: compose.selectedBlocks };
  };

  const handleSend = async () => {
    if (!compose.title.trim() || !compose.messageEn.trim()) {
      toast.error("Title and message are required");
      return;
    }
    if (compose.channels.length === 0) {
      toast.error("Select at least one channel");
      return;
    }
    if (compose.targetAudience === "SPECIFIC_RESIDENCES" && compose.selectedUserIds.length === 0) {
      toast.error("Select at least one user");
      return;
    }
    if (compose.targetAudience === "SPECIFIC_UNITS" && compose.selectedUnitIds.length === 0) {
      toast.error("Select at least one unit");
      return;
    }
    if (compose.targetAudience === "SPECIFIC_BLOCKS" && compose.selectedBlocks.length === 0) {
      toast.error("Select at least one block");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        type: compose.type,
        title: compose.title.trim(),
        messageEn: compose.messageEn.trim(),
        messageAr: compose.messageAr.trim() || undefined,
        channels: compose.channels,
        targetAudience: compose.targetAudience,
        audienceMeta: buildAudienceMeta(),
      };
      if (compose.scheduledAtLocal) {
        payload.scheduledAt = new Date(compose.scheduledAtLocal).toISOString();
      }
      await apiClient.post("/notifications", payload);
      toast.success("Notification submitted to backend");
      setCompose(defaultComposeForm);
      setIsComposeOpen(false);
      await loadPage();
    } catch (error) {
      toast.error("Failed to create notification", { description: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (row: NotificationRow) => {
    setResendingId(row.id);
    try {
      const res = await apiClient.post(`/notifications/admin/resend/${row.id}`);
      toast.success("Resend completed", {
        description: `Attempted ${res.data?.attempted ?? 0} • Sent ${res.data?.sent ?? 0} • Failed ${res.data?.failed ?? 0}`,
      });
      await loadPage();
    } catch (error) {
      toast.error("Resend failed", { description: errorMessage(error) });
    } finally {
      setResendingId(null);
    }
  };

  const failedLogsCount = (row: NotificationRow) =>
    row.logs.filter((l) => String(l.status).toUpperCase() === "FAILED").length;

  const providerBadgeMeta = useMemo(() => {
    const entries = [
      { key: "email", label: "Email", value: providersStatus.email },
      { key: "sms", label: "SMS", value: providersStatus.sms },
      { key: "push", label: "Push", value: providersStatus.push },
    ];
    return entries.map((entry) => {
      const configured = !!entry.value?.configured;
      const mockMode = !!entry.value?.mockMode;
      let tone = "bg-[#E2E8F0] text-[#475569]";
      let status = "Unknown";
      if (configured && !mockMode) {
        tone = "bg-[#DCFCE7] text-[#166534]";
        status = "Live";
      } else if (mockMode) {
        tone = "bg-[#FEF3C7] text-[#92400E]";
        status = "Mock";
      } else if (!configured) {
        tone = "bg-[#FEE2E2] text-[#991B1B]";
        status = "Not Configured";
      }
      return { ...entry, configured, mockMode, tone, status };
    });
  }, [providersStatus]);

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))), [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Notifications</h1>
          <p className="text-[#64748B] mt-1">Live notification management with delivery logs and resend actions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadPage()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Notification</DialogTitle>
                <DialogDescription>
                  Uses <code>/notifications</code>. SMS/PUSH delivery depends on backend provider setup.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={compose.type} onValueChange={(value) => setCompose((p) => ({ ...p, type: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((type) => <SelectItem key={type} value={type}>{humanizeEnum(type)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select
                    value={compose.targetAudience}
                    onValueChange={(value) =>
                      setCompose((p) => ({
                        ...p,
                        targetAudience: value as ComposeForm["targetAudience"],
                        selectedUserIds: [],
                        selectedUnitIds: [],
                        selectedBlocks: [],
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{humanizeEnum(a)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={compose.title} onChange={(e) => setCompose((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Message (English)</Label>
                  <Textarea rows={5} value={compose.messageEn} onChange={(e) => setCompose((p) => ({ ...p, messageEn: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Message (Arabic - Optional)</Label>
                  <Textarea rows={5} value={compose.messageAr} onChange={(e) => setCompose((p) => ({ ...p, messageAr: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channels</Label>
                  <div className="flex flex-wrap gap-2 rounded-lg border p-3">
                    {CHANNELS.map((channel) => {
                      const active = compose.channels.includes(channel);
                      return (
                        <Button
                          key={channel}
                          type="button"
                          variant={active ? "default" : "outline"}
                          className={active ? "bg-[#00B386] hover:bg-[#00B386]/90 text-white" : ""}
                          onClick={() =>
                            setCompose((p) => ({
                              ...p,
                              channels: active
                                ? p.channels.filter((c) => c !== channel)
                                : [...p.channels, channel],
                            }))
                          }
                        >
                          {humanizeEnum(channel)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Schedule At (Optional)</Label>
                  <Input type="datetime-local" value={compose.scheduledAtLocal} onChange={(e) => setCompose((p) => ({ ...p, scheduledAtLocal: e.target.value }))} />
                </div>
              </div>

              {compose.targetAudience === "SPECIFIC_RESIDENCES" ? (
                <div className="space-y-2">
                  <Label>Select Residents</Label>
                  <select
                    multiple
                    value={compose.selectedUserIds}
                    onChange={(e) => setCompose((p) => ({ ...p, selectedUserIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
                    className="w-full min-h-[180px] rounded-md border border-[#E5E7EB] bg-white p-2 text-sm"
                  >
                    {residentOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
              ) : null}

              {compose.targetAudience === "SPECIFIC_UNITS" ? (
                <div className="space-y-2">
                  <Label>Select Units</Label>
                  <select
                    multiple
                    value={compose.selectedUnitIds}
                    onChange={(e) => setCompose((p) => ({ ...p, selectedUnitIds: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
                    className="w-full min-h-[180px] rounded-md border border-[#E5E7EB] bg-white p-2 text-sm"
                  >
                    {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </div>
              ) : null}

              {compose.targetAudience === "SPECIFIC_BLOCKS" ? (
                <div className="space-y-2">
                  <Label>Select Blocks</Label>
                  <select
                    multiple
                    value={compose.selectedBlocks}
                    onChange={(e) => setCompose((p) => ({ ...p, selectedBlocks: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
                    className="w-full min-h-[180px] rounded-md border border-[#E5E7EB] bg-white p-2 text-sm"
                  >
                    {blockOptions.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsComposeOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button onClick={handleSend} disabled={isSubmitting} className="bg-[#00B386] hover:bg-[#00B386]/90 text-white">
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError ? <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]">{loadError}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-xs text-[#64748B]">Loaded Notifications</div><div className="text-2xl font-semibold mt-2">{filteredRows.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-[#64748B]">Total Logs</div><div className="text-2xl font-semibold mt-2">{stats.totalLogs}</div></Card>
        <Card className="p-4"><div className="text-xs text-[#64748B]">Delivered/Read Logs</div><div className="text-2xl font-semibold mt-2">{stats.delivered}</div></Card>
        <Card className="p-4"><div className="text-xs text-[#64748B]">Failed Logs</div><div className="text-2xl font-semibold mt-2 text-[#DC2626]">{stats.failed}</div></Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="xl:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input className="pl-9" placeholder="Search notifications..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map((s) => <SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger><SelectValue placeholder="Channel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              {CHANNELS.map((c) => <SelectItem key={c} value={c}>{humanizeEnum(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={audienceFilter} onValueChange={setAudienceFilter}>
            <SelectTrigger><SelectValue placeholder="Audience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Audiences</SelectItem>
              {AUDIENCES.map((a) => <SelectItem key={a} value={a}>{humanizeEnum(a)}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="text-xs text-[#64748B]">
            Backend total: {meta.total ?? rows.length}. Delivery logs below include IN_APP / EMAIL / SMS / PUSH channel results.
          </div>
          <div className="flex flex-wrap gap-2">
            {providerBadgeMeta.map((p) => (
              <Badge key={p.key} className={p.tone}>
                {p.label}: {p.status}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Failed Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const firstFailed = row.logs.find((l) => l.status === "FAILED");
              const failedCount = failedLogsCount(row);
              return (
                <TableRow key={row.id} className="hover:bg-[#F9FAFB]">
                  <TableCell className="min-w-[220px]">
                    <div className="font-medium text-[#1E293B]">{row.title}</div>
                    <div className="text-xs text-[#64748B] mt-1">{row.logs.length} logs</div>
                  </TableCell>
                  <TableCell>{humanizeEnum(row.type)}</TableCell>
                  <TableCell>
                    <div className="text-sm">{humanizeEnum(row.targetAudience)}</div>
                    <div className="text-xs text-[#64748B]">{audienceSummary(row)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.channels.map((c) => <Badge key={`${row.id}-${c}`} variant="secondary">{humanizeEnum(c)}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell><Badge className={getStatusColorClass(row.status)}>{humanizeEnum(row.status)}</Badge></TableCell>
                  <TableCell className="max-w-[240px]">
                    <div className="text-xs text-[#B91C1C] line-clamp-2">{parseFailure(firstFailed?.providerResponse) || "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-[#64748B]">{formatDateTime(row.sentAt || row.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDetailsRow(row)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={failedCount === 0 || resendingId === row.id}
                        onClick={() => void handleResend(row)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        {resendingId === row.id ? "Resending..." : "Resend Failed"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-[#64748B]">
                  <div className="flex items-center justify-center gap-2">
                    <Bell className="w-4 h-4" />
                    No notifications found.
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detailsRow} onOpenChange={(open) => !open && setDetailsRow(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
            <DialogDescription>Per-channel delivery logs and provider responses.</DialogDescription>
          </DialogHeader>
          {detailsRow ? (
            <div className="space-y-4">
              <Card className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-[#64748B]">Title</div>
                  <div className="text-sm font-medium mt-1">{detailsRow.title}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Audience</div>
                  <div className="text-sm font-medium mt-1">{humanizeEnum(detailsRow.targetAudience)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B]">Status</div>
                  <div className="mt-1"><Badge className={getStatusColorClass(detailsRow.status)}>{humanizeEnum(detailsRow.status)}</Badge></div>
                </div>
              </Card>
              <Card className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#64748B] mb-1">English Message</div>
                  <div className="rounded border p-3 text-sm whitespace-pre-wrap">{detailsRow.messageEn || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-[#64748B] mb-1">Arabic Message</div>
                  <div className="rounded border p-3 text-sm whitespace-pre-wrap">{detailsRow.messageAr || "—"}</div>
                </div>
              </Card>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB]">
                      <TableHead>Channel</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Provider Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailsRow.logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{humanizeEnum(log.channel)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.recipient}</TableCell>
                        <TableCell><Badge className={getStatusColorClass(log.status)}>{humanizeEnum(log.status)}</Badge></TableCell>
                        <TableCell className="text-xs text-[#64748B]">{formatDateTime(log.updatedAt || log.createdAt)}</TableCell>
                        <TableCell className="max-w-[360px] text-xs break-words whitespace-pre-wrap">{parseFailure(log.providerResponse) || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {detailsRow.logs.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#64748B]">No delivery logs yet.</TableCell></TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
