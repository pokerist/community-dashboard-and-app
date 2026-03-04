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
  payload?: Record<string, unknown> | null;
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
type ProviderState = {
  provider?: string;
  configured?: boolean;
  enabled?: boolean;
  mockMode?: boolean;
  reason?: string;
};

type PushProviderState = ProviderState & {
  effectiveProvider?: string;
  fcm?: ProviderState & { projectId?: string | null };
  expo?: ProviderState;
};

type ProvidersStatus = {
  email?: ProviderState;
  sms?: ProviderState;
  smsOtp?: ProviderState;
  push?: PushProviderState;
  runtime?: {
    diagnostics?: {
      activeDeviceTokens?: number;
      recentPushFailures?: Array<{
        id: string;
        reasonCode?: string;
        message?: string;
        createdAt?: string;
      }>;
    };
  };
};

type ComposeForm = {
  type: string;
  title: string;
  messageEn: string;
  messageAr: string;
  appRoute: string;
  openInAppLabel: string;
  entityType: string;
  entityId: string;
  ctaLabel: string;
  externalUrl: string;
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
  appRoute: "",
  openInAppLabel: "",
  entityType: "",
  entityId: "",
  ctaLabel: "",
  externalUrl: "",
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

function isCommunityUpdateType(type?: string | null): boolean {
  const normalized = String(type ?? "").toUpperCase();
  return (
    normalized === "ANNOUNCEMENT" ||
    normalized === "EVENT_NOTIFICATION" ||
    normalized === "MAINTENANCE_ALERT" ||
    normalized === "EMERGENCY_ALERT"
  );
}

function mapNotificationRouteToSection(routeRaw?: string | null): string | null {
  const route = String(routeRaw ?? "").trim().toLowerCase();
  if (!route) return null;
  if (route.startsWith("#")) {
    const section = route.replace(/^#/, "").trim();
    return section || null;
  }
  if (route.includes("gate-live")) return "gate-live";
  if (route.includes("requests")) return "requests";
  if (route.includes("services")) return "services";
  if (route.includes("complaints")) return "complaints";
  if (route.includes("tickets")) return "tickets";
  if (route.includes("access") || route.includes("qr")) return "access";
  if (route.includes("billing") || route.includes("payment") || route.includes("invoice")) return "billing";
  if (route.includes("security")) return "security";
  if (route.includes("notifications")) return "notifications";
  return null;
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
  const [viewMode, setViewMode] = useState<"all" | "send" | "scheduled" | "failed">("send");
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
        payload: n.payload && typeof n.payload === "object" ? n.payload : null,
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

  const composeValidationHints = useMemo(() => {
    const hints: Array<{ level: "warn" | "error"; text: string }> = [];
    const route = compose.appRoute.trim();
    const entityType = compose.entityType.trim();
    const entityId = compose.entityId.trim();
    const externalUrl = compose.externalUrl.trim();

    if (entityId && !entityType) {
      hints.push({ level: "error", text: "Entity ID is set but Entity Type is missing." });
    }
    if (entityType && !entityId) {
      hints.push({ level: "warn", text: "Entity Type is set without Entity ID. Mobile will open the screen but may not open a specific record." });
    }
    if (route && !route.startsWith("/")) {
      hints.push({ level: "warn", text: 'Open In App Route should usually start with "/" (example: /payments).' });
    }
    if (externalUrl && !/^https?:\/\//i.test(externalUrl)) {
      hints.push({ level: "warn", text: "CTA External Link should include http:// or https:// for predictable behavior." });
    }
    if (isCommunityUpdateType(compose.type) && !compose.channels.includes("IN_APP")) {
      hints.push({ level: "warn", text: "Community updates are typically sent via IN_APP so they appear in the Community Updates feed." });
    }
    if ((route || entityType || entityId) && !compose.channels.includes("IN_APP")) {
      hints.push({ level: "warn", text: "Deep-link metadata is most useful when IN_APP channel is enabled." });
    }
    return hints;
  }, [compose]);

  const composePreview = useMemo(() => {
    const title = compose.title.trim() || "Community Update";
    const body =
      compose.messageEn.trim() ||
      "Preview of the notification message that will appear on the resident mobile app.";
    const community = isCommunityUpdateType(compose.type);
    return {
      title,
      body,
      typeLabel: humanizeEnum(compose.type || "ANNOUNCEMENT"),
      audienceLabel: humanizeEnum(compose.targetAudience || "ALL"),
      channelsLabel: compose.channels.map((c) => humanizeEnum(c)).join(" • ") || "None",
      routeLabel: compose.appRoute.trim() || "—",
      entityLabel:
        compose.entityType.trim() || compose.entityId.trim()
          ? `${compose.entityType.trim() || "?"}${compose.entityId.trim() ? ` • ${compose.entityId.trim().slice(0, 8)}…` : ""}`
          : "—",
      externalUrl: compose.externalUrl.trim(),
      externalLabel: compose.ctaLabel.trim() || "Open Link",
      openInAppLabel: compose.openInAppLabel.trim() || "Open in App",
      isCommunity: community,
      timestamp: compose.scheduledAtLocal
        ? formatDateTime(new Date(compose.scheduledAtLocal).toISOString())
        : "Sent immediately",
    };
  }, [compose]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (viewMode === "send" && row.status === "SCHEDULED") return false;
      if (viewMode === "scheduled" && row.status !== "SCHEDULED") return false;
      if (viewMode === "failed" && !row.logs.some((l) => String(l.status).toUpperCase() === "FAILED")) return false;
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
  }, [rows, search, statusFilter, channelFilter, audienceFilter, dateFrom, dateTo, viewMode]);

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

  const applyAnnouncementPreset = (
    preset: "community" | "maintenance" | "event" | "emergency",
  ) => {
    setCompose((p) => {
      const base = {
        ...p,
        targetAudience: "ALL" as ComposeForm["targetAudience"],
        channels: Array.from(new Set(["IN_APP", "PUSH", ...p.channels])),
        appRoute: p.appRoute || "/community-updates",
        openInAppLabel: p.openInAppLabel || "View Update",
      };

      if (preset === "maintenance") {
        return {
          ...base,
          type: "MAINTENANCE_ALERT",
          title: p.title || "Maintenance Notice",
          ctaLabel: p.ctaLabel || "Learn More",
          messageEn:
            p.messageEn ||
            "Scheduled maintenance is in progress. Some services may be temporarily affected. We will share updates once work is completed.",
        };
      }
      if (preset === "event") {
        return {
          ...base,
          type: "EVENT_NOTIFICATION",
          title: p.title || "Community Event Update",
          ctaLabel: p.ctaLabel || "View Event",
          messageEn:
            p.messageEn ||
            "A community event update has been published. Please review the details and timing in the announcement.",
        };
      }
      if (preset === "emergency") {
        return {
          ...base,
          type: "EMERGENCY_ALERT",
          channels: Array.from(new Set(["IN_APP", "PUSH", "SMS", ...p.channels])),
          title: p.title || "Important Community Alert",
          ctaLabel: p.ctaLabel || "Open Details",
          messageEn:
            p.messageEn ||
            "An urgent community alert has been issued. Please review the instructions immediately and follow management guidance.",
        };
      }
      return {
        ...base,
        type: "ANNOUNCEMENT",
        title: p.title || "Community Update",
        ctaLabel: p.ctaLabel || "Read More",
        messageEn:
          p.messageEn ||
          "A new community update is available. Please review the latest announcement for details.",
      };
    });
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
      const payloadMeta: Record<string, unknown> = {};
      if (compose.appRoute.trim()) payloadMeta.route = compose.appRoute.trim();
      if (compose.openInAppLabel.trim()) {
        payloadMeta.openInAppLabel = compose.openInAppLabel.trim();
      }
      if (compose.entityType.trim()) payloadMeta.entityType = compose.entityType.trim().toUpperCase();
      if (compose.entityId.trim()) payloadMeta.entityId = compose.entityId.trim();
      if (compose.ctaLabel.trim()) {
        payloadMeta.ctaLabel = compose.ctaLabel.trim();
        payloadMeta.ctaText = compose.ctaLabel.trim();
      }
      if (compose.externalUrl.trim()) {
        payloadMeta.externalUrl = compose.externalUrl.trim();
        payloadMeta.ctaUrl = compose.externalUrl.trim();
      }
      if (
        compose.type === "ANNOUNCEMENT" ||
        compose.type === "EVENT_NOTIFICATION" ||
        compose.type === "MAINTENANCE_ALERT" ||
        compose.type === "EMERGENCY_ALERT"
      ) {
        payloadMeta.eventKey = "community_update";
      }
      if (Object.keys(payloadMeta).length > 0) {
        payload.payload = payloadMeta;
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

  const handleOpenTarget = (row: NotificationRow) => {
    const payload = row.payload ?? {};
    const webRoute = String((payload as any).webRoute ?? "").trim();
    const route = String((payload as any).route ?? "").trim();
    const section =
      mapNotificationRouteToSection(webRoute) ||
      mapNotificationRouteToSection(route);
    if (!section) {
      toast.error("No target route found for this notification");
      return;
    }

    const entityId = String((payload as any).entityId ?? "").trim();
    const entityType = String((payload as any).entityType ?? "").trim();
    const serviceCategory = String((payload as any).serviceCategory ?? "").trim();
    if (entityId) {
      try {
        window.sessionStorage.setItem(
          "admin.focusEntity",
          JSON.stringify({
            section,
            entityId,
            entityType: entityType || null,
            serviceCategory: serviceCategory || null,
          }),
        );
      } catch {
        // ignore storage errors
      }
    }
    window.location.hash = `#${section}`;
  };

  const providerBadgeMeta = useMemo(() => {
    const entries = [
      { key: "email", label: "Email", value: providersStatus.email },
      { key: "smsOtp", label: "SMS OTP", value: providersStatus.smsOtp },
      { key: "sms", label: "SMS Transport", value: providersStatus.sms },
      { key: "push", label: "Push", value: providersStatus.push },
    ];
    return entries.map((entry) => {
      const configured = !!entry.value?.configured;
      const enabled = entry.value?.enabled;
      const mockMode = !!entry.value?.mockMode;
      let tone = "bg-[#E2E8F0] text-[#475569]";
      let status = "Unknown";
      if (enabled === false) {
        tone = "bg-[#F1F5F9] text-[#475569]";
        status = "Disabled";
      } else if (configured && !mockMode) {
        tone = "bg-[#DCFCE7] text-[#166534]";
        status = "Live";
      } else if (mockMode) {
        tone = "bg-[#FEF3C7] text-[#92400E]";
        status = "Mock";
      } else if (!configured) {
        tone = "bg-[#FEE2E2] text-[#991B1B]";
        status = "Not Configured";
      }
      return { ...entry, configured, enabled, mockMode, tone, status };
    });
  }, [providersStatus]);

  const pushDiagnostics = useMemo(() => {
    const runtime = providersStatus.runtime ?? {};
    const diagnostics = runtime.diagnostics ?? {};
    const activeTokens = Number(diagnostics.activeDeviceTokens ?? 0);
    const latestFailure = Array.isArray(diagnostics.recentPushFailures)
      ? diagnostics.recentPushFailures[0]
      : undefined;
    const latestFailureText = latestFailure
      ? `${latestFailure.reasonCode ?? "PUSH_SEND_FAILED"}${latestFailure.message ? ` (${latestFailure.message})` : ""}`
      : "No recent push failures";

    return {
      effectiveProvider: String(providersStatus.push?.effectiveProvider ?? "none"),
      activeTokens,
      latestFailureText,
    };
  }, [providersStatus]);

  const smsOtpDiagnostics = useMemo(() => {
    const enabled = providersStatus.smsOtp?.enabled === true;
    const configured = providersStatus.smsOtp?.configured === true;
    const reason = String(providersStatus.smsOtp?.reason ?? "UNKNOWN");
    return { enabled, configured, reason };
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
                  Uses <code>/notifications</code>. Admin notifications are always enforced as <strong>IN_APP + PUSH</strong> by backend policy.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyAnnouncementPreset("community")}
                  className="border-[#CBD5E1] bg-white"
                >
                  Community Update Preset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyAnnouncementPreset("maintenance")}
                  className="border-[#CBD5E1] bg-white"
                >
                  Maintenance Preset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyAnnouncementPreset("event")}
                  className="border-[#CBD5E1] bg-white"
                >
                  Event Preset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyAnnouncementPreset("emergency")}
                  className="border-[#FECACA] bg-white text-[#991B1B] hover:bg-[#FEF2F2]"
                >
                  Emergency Preset
                </Button>
                <div className="text-xs text-[#64748B] self-center">
                  Presets configure type, audience, and channels for common community broadcasts.
                </div>
              </div>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Open In App Route (Optional)</Label>
                  <Input
                    placeholder="/community-updates"
                    value={compose.appRoute}
                    onChange={(e) => setCompose((p) => ({ ...p, appRoute: e.target.value }))}
                  />
                  <p className="text-xs text-[#64748B]">
                    Example: <code>/community-updates</code>, <code>/payments</code>, <code>/services</code>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Open In App Button Label (Optional)</Label>
                  <Input
                    placeholder="View Details"
                    value={compose.openInAppLabel}
                    onChange={(e) => setCompose((p) => ({ ...p, openInAppLabel: e.target.value }))}
                  />
                  <p className="text-xs text-[#64748B]">
                    Used by mobile for the internal navigation button text (defaults to "Open in App").
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entity Type (Optional)</Label>
                  <Input
                    placeholder="SERVICE_REQUEST | INVOICE | VIOLATION"
                    value={compose.entityType}
                    onChange={(e) => setCompose((p) => ({ ...p, entityType: e.target.value }))}
                  />
                  <p className="text-xs text-[#64748B]">
                    Used by mobile deep-link fallback and detail opening logic.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Entity ID (Optional)</Label>
                  <Input
                    placeholder="UUID of the related record"
                    value={compose.entityId}
                    onChange={(e) => setCompose((p) => ({ ...p, entityId: e.target.value }))}
                  />
                  <p className="text-xs text-[#64748B]">
                    Example: service request ID to open the ticket directly on mobile.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>CTA External Link (Optional)</Label>
                <Input
                  placeholder="https://example.com/update-details"
                  value={compose.externalUrl}
                  onChange={(e) => setCompose((p) => ({ ...p, externalUrl: e.target.value }))}
                />
                <p className="text-xs text-[#64748B]">
                  Mobile community updates screen will show an "Open Link" action when provided.
                </p>
              </div>
              <div className="space-y-2">
                <Label>CTA Button Label (Optional)</Label>
                <Input
                  placeholder="Read More"
                  value={compose.ctaLabel}
                  onChange={(e) => setCompose((p) => ({ ...p, ctaLabel: e.target.value }))}
                />
                <p className="text-xs text-[#64748B]">
                  Used by mobile for the external link button text (defaults to "Open Link").
                </p>
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

              {composeValidationHints.length > 0 ? (
                <Card className="p-3 space-y-2 border border-[#FDE68A] bg-[#FFFBEB]">
                  <p className="text-sm font-medium text-[#92400E]">Compose Validation Hints</p>
                  <div className="space-y-1">
                    {composeValidationHints.map((hint, idx) => (
                      <p
                        key={`${hint.level}-${idx}`}
                        className={`text-xs ${hint.level === "error" ? "text-[#991B1B]" : "text-[#92400E]"}`}
                      >
                        {hint.level === "error" ? "Error:" : "Hint:"} {hint.text}
                      </p>
                    ))}
                  </div>
                </Card>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1E293B]">Notification Preview</p>
                    <Badge className="bg-[#0B5FFF]/10 text-[#0B5FFF]">
                      {composePreview.typeLabel}
                    </Badge>
                  </div>
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#0F172A] break-words">{composePreview.title}</p>
                        <p className="text-xs text-[#64748B] mt-1">{composePreview.timestamp}</p>
                      </div>
                      <Bell className="w-4 h-4 text-[#64748B] mt-0.5" />
                    </div>
                    <p className="text-sm text-[#334155] mt-3 whitespace-pre-wrap break-words line-clamp-4">
                      {composePreview.body}
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      <div className="rounded-lg bg-[#F8FAFC] p-2">
                        <p className="text-[#64748B]">Audience</p>
                        <p className="text-[#1E293B] mt-1">{composePreview.audienceLabel}</p>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] p-2">
                        <p className="text-[#64748B]">Channels</p>
                        <p className="text-[#1E293B] mt-1 break-words">{composePreview.channelsLabel}</p>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] p-2 col-span-2">
                        <p className="text-[#64748B]">Deep Link</p>
                        <p className="text-[#1E293B] mt-1 break-words">
                          Route: {composePreview.routeLabel}
                        </p>
                        <p className="text-[#64748B] mt-1 break-words">
                          Entity: {composePreview.entityLabel}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#1E293B]">Mobile Rendering Preview</p>
                    <Badge
                      className={
                        composePreview.isCommunity
                          ? "bg-[#10B981]/10 text-[#10B981]"
                          : "bg-[#64748B]/10 text-[#64748B]"
                      }
                    >
                      {composePreview.isCommunity ? "Community Update" : "Personal Notification"}
                    </Badge>
                  </div>
                  <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 space-y-3">
                    {composePreview.isCommunity ? (
                      <>
                        <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4 space-y-2 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[#0F172A] break-words">{composePreview.title}</p>
                            <Badge className="bg-[#0B5FFF]/10 text-[#0B5FFF]">Update</Badge>
                          </div>
                          <p className="text-sm text-[#475569] whitespace-pre-wrap break-words line-clamp-4">
                            {composePreview.body}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {compose.appRoute.trim() ? (
                            <Button type="button" size="sm" variant="outline" className="border-[#CBD5E1]" disabled>
                              {composePreview.openInAppLabel}
                            </Button>
                          ) : null}
                          {compose.externalUrl.trim() ? (
                            <Button type="button" size="sm" className="bg-[#00B386] hover:bg-[#00B386]/90 text-white" disabled>
                              {composePreview.externalLabel}
                            </Button>
                          ) : null}
                          {!compose.appRoute.trim() && !compose.externalUrl.trim() ? (
                            <p className="text-xs text-[#64748B]">No CTA actions configured.</p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl bg-white border border-[#E2E8F0] p-4">
                        <p className="text-sm font-semibold text-[#0F172A] break-words">{composePreview.title}</p>
                        <p className="text-sm text-[#475569] mt-2 whitespace-pre-wrap break-words line-clamp-5">
                          {composePreview.body}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {compose.appRoute.trim() ? (
                            <Badge className="bg-[#0B5FFF]/10 text-[#0B5FFF]">Open in app</Badge>
                          ) : null}
                          {compose.externalUrl.trim() ? (
                            <Badge className="bg-[#10B981]/10 text-[#10B981]">External link</Badge>
                          ) : null}
                          {!compose.appRoute.trim() && !compose.externalUrl.trim() ? (
                            <Badge className="bg-[#64748B]/10 text-[#64748B]">Info only</Badge>
                          ) : null}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-[#64748B]">
                      Preview reflects current form values and mobile payload usage (route/entity/CTA), not backend delivery logs.
                    </p>
                  </div>
                </Card>
              </div>

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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={viewMode === "send" ? "default" : "outline"} onClick={() => setViewMode("send")}>Send</Button>
          <Button size="sm" variant={viewMode === "scheduled" ? "default" : "outline"} onClick={() => setViewMode("scheduled")}>Scheduled</Button>
          <Button size="sm" variant={viewMode === "failed" ? "default" : "outline"} onClick={() => setViewMode("failed")}>Failed</Button>
          <Button size="sm" variant={viewMode === "all" ? "default" : "outline"} onClick={() => setViewMode("all")}>All</Button>
        </div>
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
        <div className="text-xs text-[#475569] rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          Push diagnostics: effective provider <strong>{pushDiagnostics.effectiveProvider}</strong>, active device tokens <strong>{pushDiagnostics.activeTokens}</strong>, latest failure <strong>{pushDiagnostics.latestFailureText}</strong>.
        </div>
        <div className="text-xs text-[#475569] rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          Firebase OTP diagnostics: enabled <strong>{smsOtpDiagnostics.enabled ? "yes" : "no"}</strong>, configured <strong>{smsOtpDiagnostics.configured ? "yes" : "no"}</strong>, reason <strong>{smsOtpDiagnostics.reason}</strong>.
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
                        onClick={() => handleOpenTarget(row)}
                        disabled={
                          !mapNotificationRouteToSection(String((row.payload as any)?.webRoute ?? "")) &&
                          !mapNotificationRouteToSection(String((row.payload as any)?.route ?? ""))
                        }
                      >
                        Open Target
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
              <Card className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-[#64748B]">Target Route</div>
                    <div className="text-xs font-mono mt-1 break-all text-[#1E293B]">
                      {String((detailsRow.payload as any)?.webRoute ?? "").trim() ||
                        String((detailsRow.payload as any)?.route ?? "").trim() ||
                        "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#64748B]">Entity</div>
                    <div className="text-xs font-mono mt-1 break-all text-[#1E293B]">
                      {String((detailsRow.payload as any)?.entityType ?? "").trim() || "—"}
                      {String((detailsRow.payload as any)?.entityId ?? "").trim()
                        ? ` • ${String((detailsRow.payload as any)?.entityId ?? "").trim()}`
                        : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenTarget(detailsRow)}
                    disabled={
                      !mapNotificationRouteToSection(String((detailsRow.payload as any)?.webRoute ?? "")) &&
                      !mapNotificationRouteToSection(String((detailsRow.payload as any)?.route ?? ""))
                    }
                  >
                    Open Target
                  </Button>
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
                        <TableCell className="max-w-[360px] text-xs break-words whitespace-pre-wrap">
                          {parseFailure(log.providerResponse) ? (
                            <details>
                              <summary className="cursor-pointer text-[#334155]">View Details</summary>
                              <div className="mt-2">{parseFailure(log.providerResponse)}</div>
                            </details>
                          ) : "—"}
                        </TableCell>
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
