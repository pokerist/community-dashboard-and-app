import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  QrCode, Ban, CheckCheck, Clock3, ShieldCheck, RefreshCw,
  AlertCircle, CheckCircle2, XCircle, Search,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { DataTable, type DataTableColumn } from "../DataTable";
import { StatusBadge } from "../StatusBadge";
import apiClient from "../../lib/api-client";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type QrRow = Record<string, any>;

const QR_TYPES = ["VISITOR", "DELIVERY", "WORKER", "SERVICE_PROVIDER", "RIDESHARE", "SELF"];

const TYPE_META: Record<string, { bg: string; color: string }> = {
  VISITOR:          { bg: "#EFF6FF", color: "#2563EB" },
  DELIVERY:         { bg: "#FFF7ED", color: "#EA580C" },
  WORKER:           { bg: "#FFFBEB", color: "#D97706" },
  SERVICE_PROVIDER: { bg: "#F5F3FF", color: "#7C3AED" },
  RIDESHARE:        { bg: "#F0FDFA", color: "#0D9488" },
  SELF:             { bg: "#F0FDF4", color: "#16A34A" },
};

const TABS = [
  { key: "all",             label: "All" },
  { key: "active",          label: "Active" },
  { key: "pending",         label: "Pending" },
  { key: "pending-workers", label: "Pending Workers" },
  { key: "expired",         label: "Expired" },
  { key: "used",            label: "Used" },
];

const PAGE_SIZE = 15;

const DATE_RANGE_OPTIONS = [
  { key: "all",       label: "All Time" },
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "Last 7 Days" },
  { key: "30d",       label: "Last 30 Days" },
  { key: "90d",       label: "Last 3 Months" },
  { key: "custom",    label: "Custom Range" },
];

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

// ─── Primitives ───────────────────────────────────────────────

function TypeChip({ type }: { type: string }) {
  const meta = TYPE_META[type?.toUpperCase()] ?? { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: meta.bg, color: meta.color, fontFamily: "'Work Sans', sans-serif" }}>
      {humanizeEnum(type)}
    </span>
  );
}

function StatCard({ title, value, accent }: { title: string; value: number; accent: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", borderTop: `3px solid ${accent}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <QrCode style={{ width: "12px", height: "12px", color: accent }} />
        </div>
        <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</span>
      </div>
      <p style={{ fontSize: "26px", fontWeight: 900, color: "#111827", letterSpacing: "-0.04em", lineHeight: 1, margin: 0, fontFamily: "'DM Mono', monospace" }}>{value}</p>
    </div>
  );
}

function TabBtn({ label, active, count, onClick }: { label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "7px", border: "none", background: active ? "#FFF" : "transparent", color: active ? "#111827" : "#9CA3AF", cursor: "pointer", fontSize: "12px", fontWeight: active ? 700 : 500, transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "1px 5px", borderRadius: "10px", background: active ? "#D97706" : "#E5E7EB", color: active ? "#FFF" : "#6B7280", fontFamily: "'DM Mono', monospace" }}>{count}</span>
      )}
    </button>
  );
}

// ─── Pending worker card ──────────────────────────────────────

function PendingWorkerCard({ row, actionId, onApprove, onReject }: { row: QrRow; actionId: string | null; onApprove: () => void; onReject: () => void }) {
  const busy = actionId === row.id;
  const unitLabel = row.forUnit
    ? [row.forUnit.projectName, row.forUnit.block ? `Block ${row.forUnit.block}` : null, row.forUnit.unitNumber ? `Unit ${row.forUnit.unitNumber}` : null].filter(Boolean).join(" – ")
    : row.unit?.unitNumber ? `Unit ${row.unit.unitNumber}` : "—";
  return (
    <div style={{ padding: "11px 13px", borderRadius: "8px", border: "1px solid #FEF3C7", background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
          <AlertCircle style={{ width: "11px", height: "11px", color: "#D97706", flexShrink: 0 }} />
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.visitorName || "Worker permit request"}
          </p>
          <span style={{ fontSize: "10.5px", padding: "1px 6px", borderRadius: "5px", background: "#F3F4F6", color: "#6B7280", fontWeight: 600, flexShrink: 0 }}>
            {unitLabel}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9CA3AF" }}>
          <Clock3 style={{ width: "10px", height: "10px" }} />
          <span style={{ fontFamily: "'DM Mono', monospace" }}>
            {row.validFrom ? formatDateTime(row.validFrom) : "—"} → {row.validTo ? formatDateTime(row.validTo) : "—"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button type="button" disabled={busy} onClick={onReject}
          style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", cursor: busy ? "not-allowed" : "pointer", fontSize: "11.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", opacity: busy ? 0.5 : 1 }}>
          <XCircle style={{ width: "10px", height: "10px" }} />{busy ? "Working..." : "Reject"}
        </button>
        <button type="button" disabled={busy} onClick={onApprove}
          style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "none", background: busy ? "#9CA3AF" : "#111827", color: "#FFF", cursor: busy ? "not-allowed" : "pointer", fontSize: "11.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
          <CheckCircle2 style={{ width: "10px", height: "10px" }} />{busy ? "Working..." : "Approve"}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────

function buildUnitLabel(row: QrRow): string {
  const u = row.forUnit;
  if (u) {
    return [u.projectName, u.block ? `Blk ${u.block}` : null, u.unitNumber ? `#${u.unitNumber}` : null].filter(Boolean).join(" – ");
  }
  if (row.unit?.unitNumber) return `Unit ${row.unit.unitNumber}`;
  return "—";
}

function buildByLabel(row: QrRow): string {
  const g = row.generatedBy;
  if (g) {
    const name = g.nameEN?.trim() || g.nameAR?.trim();
    if (name) return name;
    if (g.email) return g.email;
    if (g.phone) return g.phone;
  }
  if (row.creator?.nameEN) return row.creator.nameEN;
  if (row.createdBy?.nameEN) return row.createdBy.nameEN;
  return "—";
}

function getDateRange(key: string): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };

  switch (key) {
    case "today":
      return { from: startOfDay(now).toISOString() };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const start = startOfDay(y);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: startOfDay(d).toISOString() };
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: startOfDay(d).toISOString() };
    }
    case "90d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { from: startOfDay(d).toISOString() };
    }
    default:
      return {};
  }
}

// ─── Main component ───────────────────────────────────────────

export function AccessControl() {
  const [accessRows,    setAccessRows]    = useState<QrRow[]>([]);
  const [isLoading,     setIsLoading]     = useState(false);
  const [actionRowId,   setActionRowId]   = useState<string | null>(null);
  const [loadError,     setLoadError]     = useState<string | null>(null);
  const [activeTab,     setActiveTab]     = useState("all");

  // Search & filters
  const [searchQuery,   setSearchQuery]   = useState("");
  const [filterType,    setFilterType]    = useState("all");
  const [dateRange,     setDateRange]     = useState("all");
  const [customFrom,    setCustomFrom]    = useState("");
  const [customTo,      setCustomTo]      = useState("");

  // Pagination
  const [currentPage,   setCurrentPage]   = useState(1);

  // ── Load ──────────────────────────────────────────────────────
  const loadAccessQrs = useCallback(async () => {
    setIsLoading(true); setLoadError(null);
    try {
      const res = await apiClient.get("/access-qrcodes", { params: { includeInactive: true } });
      setAccessRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) { const m = errorMessage(e); setLoadError(m); toast.error("Failed to load QR codes", { description: m }); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void loadAccessQrs(); }, [loadAccessQrs]);

  // ── Actions ───────────────────────────────────────────────────
  const handleRevoke = async (id: string) => {
    setActionRowId(id);
    try { await apiClient.patch(`/access-qrcodes/${id}/revoke`); toast.success("QR revoked"); await loadAccessQrs(); }
    catch (e) { toast.error("Failed to revoke", { description: errorMessage(e) }); }
    finally { setActionRowId(null); }
  };

  const handleApprove = async (id: string) => {
    setActionRowId(id);
    try { const r = await apiClient.patch(`/access-qrcodes/${id}/approve`); const qrId = r.data?.qrCode?.qrId ?? r.data?.qrCode?.id; toast.success("Worker permit approved", { description: qrId ? `QR ready: ${qrId}` : undefined }); await loadAccessQrs(); }
    catch (e) { toast.error("Failed to approve", { description: errorMessage(e) }); }
    finally { setActionRowId(null); }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Rejection reason (optional)", "") ?? "";
    setActionRowId(id);
    try { await apiClient.patch(`/access-qrcodes/${id}/reject`, { reason: reason.trim() || undefined }); toast.success("Worker permit rejected"); await loadAccessQrs(); }
    catch (e) { toast.error("Failed to reject", { description: errorMessage(e) }); }
    finally { setActionRowId(null); }
  };

  const handleMarkUsed = async (id: string) => {
    const gate = window.prompt("Gate name (optional)", "");
    if (gate === null) return;
    setActionRowId(id);
    try { await apiClient.patch(`/access-qrcodes/${id}/mark-used`, { gateName: gate.trim() || undefined }); toast.success("QR marked as used"); await loadAccessQrs(); }
    catch (e) { toast.error("Failed to mark used", { description: errorMessage(e) }); }
    finally { setActionRowId(null); }
  };

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    active:         accessRows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length,
    visitors:       accessRows.filter((r) => r.type?.toUpperCase()   === "VISITOR").length,
    workers:        accessRows.filter((r) => r.type?.toUpperCase()   === "WORKER").length,
    deliveries:     accessRows.filter((r) => r.type?.toUpperCase()   === "DELIVERY").length,
    pendingWorkers: accessRows.filter((r) => r.status?.toUpperCase() === "PENDING" && r.type?.toUpperCase() === "WORKER").length,
  }), [accessRows]);

  const pendingWorkerRows = useMemo(() => accessRows.filter((r) => r.status?.toUpperCase() === "PENDING" && r.type?.toUpperCase() === "WORKER"), [accessRows]);

  // ── Filtered rows ───────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = accessRows;

    // Tab filter
    rows = rows.filter((r) => {
      const s = r.status?.toUpperCase();
      const t = r.type?.toUpperCase();
      if (activeTab === "all")             return true;
      if (activeTab === "active")          return s === "ACTIVE";
      if (activeTab === "pending")         return s === "PENDING";
      if (activeTab === "pending-workers") return s === "PENDING" && t === "WORKER";
      if (activeTab === "expired")         return s === "EXPIRED";
      if (activeTab === "used")            return s === "USED";
      return true;
    });

    // Type filter
    if (filterType !== "all") {
      rows = rows.filter((r) => r.type?.toUpperCase() === filterType.toUpperCase());
    }

    // Date range filter
    const range = dateRange === "custom"
      ? {
          from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
          to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined,
        }
      : getDateRange(dateRange);

    if (range.from) {
      rows = rows.filter((r) => r.createdAt && new Date(r.createdAt) >= new Date(range.from!));
    }
    if (range.to) {
      rows = rows.filter((r) => r.createdAt && new Date(r.createdAt) <= new Date(range.to!));
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rows = rows.filter((r) => {
        const visitorName = (r.visitorName ?? "").toLowerCase();
        const unitLabel = buildUnitLabel(r).toLowerCase();
        const byLabel = buildByLabel(r).toLowerCase();
        const qrId = (r.qrId ?? r.code ?? r.qrCode ?? r.id ?? "").toLowerCase();
        const type = (r.type ?? "").toLowerCase();
        return visitorName.includes(q) || unitLabel.includes(q) || byLabel.includes(q) || qrId.includes(q) || type.includes(q);
      });
    }

    return rows;
  }, [accessRows, activeTab, filterType, dateRange, customFrom, customTo, searchQuery]);

  // ── Pagination ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, safePage]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [activeTab, filterType, dateRange, customFrom, customTo, searchQuery]);

  // ── Columns ───────────────────────────────────────────────────
  const columns: DataTableColumn<QrRow>[] = [
    { key: "qrId", header: "QR ID", render: (r) => (
      <span style={{ fontSize: "11.5px", fontFamily: "'DM Mono', monospace", color: "#374151", background: "#F3F4F6", padding: "2px 6px", borderRadius: "4px" }}>
        {(r.qrId ?? r.code ?? r.qrCode ?? r.id ?? "").slice(0, 8)}...
      </span>
    )},
    { key: "type", header: "Type", render: (r) => <TypeChip type={r.type} /> },
    { key: "for",  header: "For",  render: (r) => <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{r.visitorName ?? r.worker?.name ?? r.serviceProviderName ?? "—"}</span> },
    { key: "unit", header: "Unit", render: (r) => (
      <span style={{ fontSize: "12px", color: "#374151", fontWeight: 500 }}>{buildUnitLabel(r)}</span>
    )},
    { key: "by", header: "Generated By", render: (r) => {
      const g = r.generatedBy;
      if (!g) return <span style={{ fontSize: "12px", color: "#9CA3AF" }}>—</span>;
      const name = g.nameEN?.trim() || g.nameAR?.trim() || "Unknown";
      return (
        <div>
          <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.3 }}>{name}</p>
          {g.email && <p style={{ fontSize: "10.5px", color: "#9CA3AF", margin: 0, lineHeight: 1.3 }}>{g.email}</p>}
        </div>
      );
    }},
    { key: "valid", header: "Valid Period", render: (r) => (
      <div style={{ fontFamily: "'DM Mono', monospace" }}>
        <p style={{ fontSize: "11px", color: "#374151", margin: 0 }}>{r.validFrom ? formatDateTime(r.validFrom) : "—"}</p>
        <p style={{ fontSize: "10.5px", color: "#9CA3AF", margin: "1px 0 0" }}>→ {r.validTo ? formatDateTime(r.validTo) : "—"}</p>
      </div>
    )},
    { key: "status",  header: "Status",  render: (r) => <StatusBadge value={r.status} /> },
    { key: "actions", header: "",        render: (r) => {
      const s = r.status?.toUpperCase();
      const t = r.type?.toUpperCase();
      const busy = actionRowId === r.id;
      if (s === "ACTIVE") return (
        <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
          <ActionBtn label={busy ? "Working..." : "Mark Used"} icon={<CheckCheck style={{ width: "10px", height: "10px" }} />} onClick={() => void handleMarkUsed(r.id)} disabled={busy} />
          <ActionBtn label={busy ? "Working..." : "Revoke"}    icon={<Ban         style={{ width: "10px", height: "10px" }} />} variant="danger" onClick={() => void handleRevoke(r.id)} disabled={busy} />
        </div>
      );
      if (s === "PENDING" && t === "WORKER") return (
        <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end" }}>
          <ActionBtn label={busy ? "Working..." : "Reject"}  icon={<XCircle      style={{ width: "10px", height: "10px" }} />} variant="danger"   onClick={() => void handleReject(r.id)}  disabled={busy} />
          <ActionBtn label={busy ? "Working..." : "Approve"} icon={<CheckCircle2 style={{ width: "10px", height: "10px" }} />} variant="success"  onClick={() => void handleApprove(r.id)} disabled={busy} />
        </div>
      );
      return <span style={{ color: "#D1D5DB", fontSize: "11px" }}>—</span>;
    }},
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Access Control</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Manage QR codes for visitors, workers, deliveries, and more.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button type="button" onClick={() => void loadAccessQrs()} disabled={isLoading}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: isLoading ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
            <RefreshCw style={{ width: "13px", height: "13px", animation: isLoading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Error ──────────────────────────────────────────── */}
      {loadError && (
        <div style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", fontSize: "13px", marginBottom: "14px" }}>
          {loadError}
        </div>
      )}

      {/* ── Stat strip ─────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", overflowX: "auto" }}>
        <StatCard title="Active QRs"  value={stats.active}     accent="#2563EB" />
        <StatCard title="Visitors"    value={stats.visitors}   accent="#0D9488" />
        <StatCard title="Workers"     value={stats.workers}    accent="#D97706" />
        <StatCard title="Deliveries"  value={stats.deliveries} accent="#EA580C" />
      </div>

      {/* ── Pending workers callout ─────────────────────────── */}
      {pendingWorkerRows.length > 0 && (
        <div style={{ borderRadius: "10px", border: "1px solid #FDE68A", background: "#FFFBEB", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #FDE68A", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <ShieldCheck style={{ width: "13px", height: "13px", color: "#D97706" }} />
              <span style={{ fontSize: "13px", fontWeight: 800, color: "#92400E", letterSpacing: "-0.01em" }}>Pending Worker Permits</span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "10px", background: "#D97706", color: "#FFF", fontFamily: "'DM Mono', monospace" }}>{stats.pendingWorkers}</span>
            </div>
            <button type="button" onClick={() => setActiveTab("pending-workers")}
              style={{ fontSize: "11.5px", fontWeight: 600, color: "#D97706", background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif" }}>
              View all →
            </button>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {pendingWorkerRows.slice(0, 5).map((row) => (
              <PendingWorkerCard key={row.id} row={row} actionId={actionRowId}
                onApprove={() => void handleApprove(row.id)}
                onReject={() => void handleReject(row.id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Search & Filters bar ──────────────────────────── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", marginBottom: "0" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Search */}
          <div style={{ flex: "1 1 250px", minWidth: "200px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>Search</label>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "#9CA3AF", pointerEvents: "none" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, unit, QR ID..."
                style={{ ...inputStyle, paddingLeft: "32px" }}
              />
            </div>
          </div>

          {/* Type filter */}
          <div style={{ flex: "0 0 160px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
              <option value="all">All Types</option>
              {QR_TYPES.map((t) => <option key={t} value={t}>{humanizeEnum(t)}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div style={{ flex: "0 0 170px" }}>
            <label style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>Date Range</label>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={selectStyle}>
              {DATE_RANGE_OPTIONS.map((opt) => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </select>
          </div>

          {/* Custom date inputs */}
          {dateRange === "custom" && (
            <>
              <div style={{ flex: "0 0 150px" }}>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>From</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: "0 0 150px" }}>
                <label style={{ fontSize: "10px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "4px" }}>To</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={inputStyle} />
              </div>
            </>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "2px", padding: "6px 10px", borderBottom: "1px solid #F3F4F6", overflowX: "auto", background: "#FAFAFA" }}>
          {TABS.map((tab) => (
            <TabBtn key={tab.key} label={tab.label} active={activeTab === tab.key}
              count={tab.key === "pending-workers" ? stats.pendingWorkers : undefined}
              onClick={() => setActiveTab(tab.key)} />
          ))}
        </div>

        {/* Table */}
        <div style={{ padding: "0" }}>
          <DataTable columns={columns} rows={paginatedRows} rowKey={(r) => r.id} loading={isLoading} emptyTitle="No QR records" emptyDescription="No records match your search or filters." />
        </div>

        {/* Pagination */}
        {filteredRows.length > PAGE_SIZE && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ fontSize: "12px", color: "#6B7280" }}>
              Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} records
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #E5E7EB", background: safePage <= 1 ? "#F9FAFB" : "#FFF", color: safePage <= 1 ? "#D1D5DB" : "#374151", cursor: safePage <= 1 ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
                <ChevronLeft style={{ width: "12px", height: "12px" }} /> Prev
              </button>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151", fontFamily: "'DM Mono', monospace", padding: "0 6px" }}>
                {safePage} / {totalPages}
              </span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #E5E7EB", background: safePage >= totalPages ? "#F9FAFB" : "#FFF", color: safePage >= totalPages ? "#D1D5DB" : "#374151", cursor: safePage >= totalPages ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
                Next <ChevronRight style={{ width: "12px", height: "12px" }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ActionBtn helper ─────────────────────────────────────────

function ActionBtn({ label, icon, variant = "ghost", onClick, disabled }: { label: string; icon?: React.ReactNode; variant?: "ghost" | "danger" | "success"; onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  const styles: Record<string, React.CSSProperties> = {
    ghost:   { background: hov ? "#F3F4F6" : "#FFF",   color: "#374151",                       border: "1px solid #E5E7EB" },
    danger:  { background: hov ? "#B91C1C" : "#FEF2F2", color: hov ? "#FFF" : "#DC2626",       border: "1px solid #FECACA" },
    success: { background: hov ? "#047857" : "#ECFDF5", color: hov ? "#FFF" : "#059669",       border: "1px solid #A7F3D0" },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "6px", cursor: disabled ? "not-allowed" : "pointer", fontSize: "11.5px", fontWeight: 700, transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif", opacity: disabled ? 0.4 : 1, ...styles[variant] }}>
      {icon}{label}
    </button>
  );
}
