import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Power, RotateCcw, Home, Search, SlidersHorizontal, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { DataTable, type DataTableColumn } from "../DataTable";
import { StatusBadge } from "../StatusBadge";
import communityService, { type ClusterItem, type CommunityListItem, type GateItem } from "../../lib/community-service";
import { handleApiError } from "../../lib/api-client";
import unitService, {
  type CreateUnitPayload,
  type GateAccessMode,
  type UnitDetail,
  type UnitDisplayStatus,
  type UnitListItem,
  type UnitStatus,
  type UnitType,
} from "../../lib/unit-service";

// ─── Constants ────────────────────────────────────────────────
const UNIT_TYPES: UnitType[] = ["APARTMENT", "VILLA", "PENTHOUSE", "DUPLEX", "TOWNHOUSE"];
const UNIT_STATUSES: UnitStatus[] = ["AVAILABLE","HELD","UNRELEASED","NOT_DELIVERED","DELIVERED","OCCUPIED","LEASED","RENTED"];
const DISPLAY_STATUSES: UnitDisplayStatus[] = ["OFF_PLAN","UNDER_CONSTRUCTION","DELIVERED","OCCUPIED"];

const TYPE_ICONS: Record<string, string> = {
  APARTMENT:  "🏢",
  VILLA:      "🏡",
  PENTHOUSE:  "🌆",
  DUPLEX:     "🏘️",
  TOWNHOUSE:  "🏠",
};

const DISPLAY_STATUS_STYLE: Record<UnitDisplayStatus, { bg: string; color: string }> = {
  OFF_PLAN:           { bg: "#F3F4F6", color: "#4B5563" },
  UNDER_CONSTRUCTION: { bg: "#FFFBEB", color: "#92400E" },
  DELIVERED:          { bg: "#EFF6FF", color: "#1D4ED8" },
  OCCUPIED:           { bg: "#ECFDF5", color: "#065F46" },
};

// Accent cycling (matches design system)
const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length];

// ─── Shared UI primitives ─────────────────────────────────────

function PrimaryBtn({ label, icon, onClick, danger = false }: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  const base = danger ? "#DC2626" : "#2563EB";
  const hovered = danger ? "#B91C1C" : "#1D4ED8";
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", background: hov ? hovered : base, color: "#FFF", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", boxShadow: `0 1px 3px ${base}33`, flexShrink: 0 }}>
      {icon}{label}
    </button>
  );
}

function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "7px 14px", borderRadius: "7px", background: hov ? "#F5F5F5" : "#FFF", color: "#6B7280", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif" }}>
      {label}
    </button>
  );
}

function IconBtn({ icon, onClick, danger = false, title, disabled = false }: { icon: React.ReactNode; onClick: () => void; danger?: boolean; title?: string; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" title={title} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${hov && !disabled ? (danger ? "#FCA5A5" : "#D1D5DB") : "#EBEBEB"}`, background: hov && !disabled ? (danger ? "#FEF2F2" : "#F5F5F5") : "#FFF", color: disabled ? "#D1D5DB" : (danger ? "#DC2626" : "#6B7280"), cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms ease", flexShrink: 0 }}>
      {icon}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", fontFamily: "'Work Sans', sans-serif" }}>{label}</label>
      {hint && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "-2px" }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFFFFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

type UnitForm = {
  communityId: string; clusterId: string; unitNumber: string; block: string;
  type: UnitType; status: UnitStatus; isDelivered: boolean;
  bedrooms: string; sizeSqm: string; price: string;
  gateAccessMode: GateAccessMode; allowedGateIds: string[];
};
const defaultForm: UnitForm = { communityId: "", clusterId: "", unitNumber: "", block: "", type: "APARTMENT", status: "AVAILABLE", isDelivered: false, bedrooms: "", sizeSqm: "", price: "", gateAccessMode: "ALL_GATES", allowedGateIds: [] };

// ─── Stat card for page header ────────────────────────────────
function UnitStat({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", background: "#FFFFFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flex: 1, minWidth: 0, borderTop: `3px solid ${accent}` }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: accent }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "22px", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{value}</p>
        <p style={{ marginTop: "3px", fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'Work Sans', sans-serif" }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function UnitsManagement() {
  const [units, setUnits]               = useState<UnitListItem[]>([]);
  const [loading, setLoading]           = useState(false);
  const [communities, setCommunities]   = useState<CommunityListItem[]>([]);
  const [clusters, setClusters]         = useState<ClusterItem[]>([]);
  const [search, setSearch]             = useState("");
  const [communityFilter, setCF]        = useState("all");
  const [clusterFilter, setKF]          = useState("all");
  const [statusFilter, setSF]           = useState("all");
  const [displayStatusFilter, setDSF]   = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [filtersOpen, setFiltersOpen]   = useState(false);

  const [formOpen, setFormOpen]           = useState(false);
  const [editingUnit, setEditingUnit]     = useState<UnitListItem | null>(null);
  const [form, setForm]                   = useState<UnitForm>(defaultForm);
  const [formClusters, setFormClusters]   = useState<ClusterItem[]>([]);
  const [formGates, setFormGates]         = useState<GateItem[]>([]);

  const [confirmOpen, setConfirmOpen]             = useState(false);
  const [unitToDeactivate, setUnitToDeact]        = useState<UnitListItem | null>(null);
  const [detailOpen, setDetailOpen]               = useState(false);
  const [detail, setDetail]                       = useState<UnitDetail | null>(null);
  const [detailMode, setDetailMode]               = useState<GateAccessMode>("ALL_GATES");
  const [detailGateIds, setDetailGateIds]         = useState<string[]>([]);
  const [detailGates, setDetailGates]             = useState<GateItem[]>([]);

  // ── Loaders ─────────────────────────────────────────────────
  const loadCommunities = useCallback(async () => {
    try { setCommunities(await communityService.listCommunities()); }
    catch (e) { toast.error("Failed to load communities", { description: handleApiError(e) }); }
  }, []);

  const loadClusters = useCallback(async () => {
    if (communityFilter === "all") { setClusters([]); setKF("all"); return; }
    try {
      const rows = await communityService.listClusters(communityFilter);
      setClusters(rows);
      if (clusterFilter !== "all" && !rows.some((r) => r.id === clusterFilter)) setKF("all");
    } catch { setClusters([]); setKF("all"); }
  }, [clusterFilter, communityFilter]);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await unitService.listUnits({ page: 1, limit: 100, search: search.trim() || undefined, communityId: communityFilter !== "all" ? communityFilter : undefined, clusterId: clusterFilter !== "all" ? clusterFilter : undefined, status: statusFilter !== "all" ? statusFilter as UnitStatus : undefined, displayStatus: displayStatusFilter !== "all" ? displayStatusFilter as UnitDisplayStatus : undefined, includeInactive: showInactive });
      setUnits(res.data);
    } catch (e) { toast.error("Failed to load units", { description: handleApiError(e) }); setUnits([]); }
    finally { setLoading(false); }
  }, [clusterFilter, communityFilter, displayStatusFilter, search, showInactive, statusFilter]);

  useEffect(() => { void loadCommunities(); }, [loadCommunities]);
  useEffect(() => { void loadClusters(); }, [loadClusters]);
  useEffect(() => { void loadUnits(); }, [loadUnits]);

  const loadFormDeps = useCallback(async (communityId: string) => {
    if (!communityId) { setFormClusters([]); setFormGates([]); return; }
    const [cl, ga] = await Promise.all([communityService.listClusters(communityId).catch(() => []), communityService.listGates(communityId).catch(() => [])]);
    setFormClusters(cl); setFormGates(ga);
  }, []);

  // ── CRUD ────────────────────────────────────────────────────
  const openCreate = async () => {
    const cid = communities[0]?.id ?? "";
    setEditingUnit(null); setForm({ ...defaultForm, communityId: cid });
    await loadFormDeps(cid); setFormOpen(true);
  };

  const openEdit = async (unit: UnitListItem) => {
    setEditingUnit(unit);
    setForm({ ...defaultForm, communityId: unit.communityId ?? "", clusterId: unit.clusterId ?? "", unitNumber: unit.unitNumber, block: unit.block ?? "", type: unit.type, status: unit.status, isDelivered: unit.isDelivered, bedrooms: unit.bedrooms != null ? String(unit.bedrooms) : "", sizeSqm: unit.sizeSqm != null ? String(unit.sizeSqm) : "", price: unit.price != null ? String(unit.price) : "" });
    await loadFormDeps(unit.communityId ?? "");
    try { const ga = await unitService.getUnitGateAccess(unit.id); setForm((p) => ({ ...p, gateAccessMode: ga.mode, allowedGateIds: ga.gates.map((g) => g.id) })); } catch { /* ignore */ }
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.communityId || !form.unitNumber.trim()) { toast.error("Community and unit number required"); return; }
    if (form.gateAccessMode === "SELECTED_GATES" && !form.allowedGateIds.length) { toast.error("Select at least one gate"); return; }
    const payload: CreateUnitPayload = { communityId: form.communityId, clusterId: form.clusterId || undefined, unitNumber: form.unitNumber.trim(), block: form.block.trim() || undefined, type: form.type, status: form.status, isDelivered: form.isDelivered, bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined, sizeSqm: form.sizeSqm ? Number(form.sizeSqm) : undefined, price: form.price ? Number(form.price) : undefined, gateAccessMode: form.gateAccessMode, allowedGateIds: form.gateAccessMode === "SELECTED_GATES" ? form.allowedGateIds : [] };
    try {
      if (editingUnit) { await unitService.updateUnit(editingUnit.id, payload); toast.success("Unit updated"); }
      else { await unitService.createUnit(payload); toast.success("Unit created"); }
      setFormOpen(false); await loadUnits();
    } catch (e) { toast.error("Failed to save unit", { description: handleApiError(e) }); }
  };

  const confirmDeactivate = async () => {
    if (!unitToDeactivate) return;
    try { await unitService.deactivateUnit(unitToDeactivate.id, "Deactivated by admin"); toast.success("Unit deactivated"); setConfirmOpen(false); setUnitToDeact(null); await loadUnits(); }
    catch (e) { toast.error("Failed to deactivate", { description: handleApiError(e) }); }
  };

  const reactivate = async (unit: UnitListItem) => {
    try { await unitService.reactivateUnit(unit.id); toast.success("Unit reactivated"); await loadUnits(); }
    catch (e) { toast.error("Failed to reactivate", { description: handleApiError(e) }); }
  };

  const openDetail = async (unit: UnitListItem) => {
    try {
      const res = await unitService.getUnit(unit.id);
      setDetail(res); setDetailMode(res.gateAccess.mode); setDetailGateIds(res.gateAccess.gates.map((g) => g.id));
      const gates = res.communityId ? await communityService.listGates(res.communityId) : [];
      setDetailGates(gates); setDetailOpen(true);
    } catch (e) { toast.error("Failed to load detail", { description: handleApiError(e) }); }
  };

  const saveDetailGateAccess = async () => {
    if (!detail) return;
    if (detailMode === "SELECTED_GATES" && !detailGateIds.length) { toast.error("Select at least one gate"); return; }
    try {
      const updated = await unitService.updateUnitGateAccess(detail.id, { mode: detailMode, allowedGateIds: detailMode === "SELECTED_GATES" ? detailGateIds : [] });
      setDetail((p) => p ? { ...p, gateAccess: updated } : p); toast.success("Gate access updated"); await loadUnits();
    } catch (e) { toast.error("Failed to update gate access", { description: handleApiError(e) }); }
  };

  // ── Derived stats ────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    units.length,
    active:   units.filter((u) => u.isActive).length,
    occupied: units.filter((u) => u.status === "OCCUPIED").length,
    inactive: units.filter((u) => !u.isActive).length,
  }), [units]);

  // Active filters count for badge
  const activeFilters = [communityFilter !== "all", clusterFilter !== "all", statusFilter !== "all", displayStatusFilter !== "all", showInactive].filter(Boolean).length;

  // ── Table columns ────────────────────────────────────────────
  const columns: DataTableColumn<UnitListItem>[] = [
    {
      key: "unit", header: "Unit",
      render: (u) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px", lineHeight: 1 }}>{TYPE_ICONS[u.type] ?? "🏠"}</span>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", letterSpacing: "-0.01em", fontFamily: "'DM Mono', monospace" }}>{u.unitNumber}</p>
            {u.block && <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "1px" }}>Block {u.block}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "location", header: "Location",
      render: (u) => (
        <div>
          <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151" }}>{u.communityName}</p>
          {u.clusterName && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px" }}>{u.clusterName}</p>}
        </div>
      ),
    },
    {
      key: "type", header: "Type",
      render: (u) => (
        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "3px 8px", borderRadius: "5px", fontFamily: "'Work Sans', sans-serif" }}>
          {u.type.charAt(0) + u.type.slice(1).toLowerCase()}
        </span>
      ),
    },
    {
      key: "displayStatus", header: "Display",
      render: (u) => {
        const s = DISPLAY_STATUS_STYLE[u.displayStatus];
        return (
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", background: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            {u.displayStatus.replace("_", " ")}
          </span>
        );
      },
    },
    {
      key: "specs", header: "Specs",
      render: (u) => (
        <div style={{ display: "flex", gap: "8px", fontSize: "11.5px", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>
          {u.bedrooms != null && <span>{u.bedrooms}BR</span>}
          {u.sizeSqm != null && <span>{u.sizeSqm}m²</span>}
          {u.bedrooms == null && u.sizeSqm == null && <span style={{ color: "#D1D5DB" }}>—</span>}
        </div>
      ),
    },
    {
      key: "price", header: "Price",
      render: (u) => u.price != null
        ? <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#059669", fontFamily: "'DM Mono', monospace" }}>EGP {u.price.toLocaleString()}</span>
        : <span style={{ color: "#D1D5DB", fontFamily: "'DM Mono', monospace" }}>—</span>,
    },
    {
      key: "status", header: "Status",
      render: (u) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <StatusBadge value={u.status} />
          {!u.isActive && <StatusBadge value="INACTIVE" />}
        </div>
      ),
    },
    {
      key: "actions", header: "Actions",
      render: (u) => (
        <div style={{ display: "flex", gap: "4px" }}>
          <IconBtn icon={<Eye style={{ width: "11px", height: "11px" }} />} onClick={() => void openDetail(u)} title="View detail" />
          <IconBtn icon={<Pencil style={{ width: "11px", height: "11px" }} />} onClick={() => void openEdit(u)} title="Edit unit" />
          {u.isActive
            ? <IconBtn icon={<Power style={{ width: "11px", height: "11px" }} />} onClick={() => { setUnitToDeact(u); setConfirmOpen(true); }} danger title="Deactivate" />
            : <IconBtn icon={<RotateCcw style={{ width: "11px", height: "11px" }} />} onClick={() => void reactivate(u)} title="Reactivate" />
          }
        </div>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── Page header ────────────────────────────────────── */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>Units</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Manage inventory, clusters, gate access, and occupancy.</p>
        </div>
        <PrimaryBtn label="Add Unit" icon={<Plus style={{ width: "13px", height: "13px" }} />} onClick={() => void openCreate()} />
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
        <UnitStat label="Total Units" value={stats.total} accent={ACCENTS[1]} icon={<Home style={{ width: "16px", height: "16px" }} />} />
        <UnitStat label="Active" value={stats.active} accent={ACCENTS[0]} icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        } />
        <UnitStat label="Occupied" value={stats.occupied} accent="#059669" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        } />
        <UnitStat label="Inactive" value={stats.inactive} accent={ACCENTS[2]} icon={<Power style={{ width: "16px", height: "16px" }} />} />
      </div>

      {/* ── Search + filter bar ────────────────────────────── */}
      <div style={{ background: "#FFFFFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "16px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderBottom: filtersOpen ? "1px solid #F3F4F6" : "none" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
            <input placeholder="Search units by number, block…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }} />
          </div>

          {/* Filter toggle */}
          <button type="button" onClick={() => setFiltersOpen((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "7px", border: `1px solid ${activeFilters > 0 ? "#2563EB40" : "#E5E7EB"}`, background: activeFilters > 0 ? "#EFF6FF" : "#FAFAFA", color: activeFilters > 0 ? "#2563EB" : "#6B7280", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", transition: "all 120ms ease", flexShrink: 0 }}>
            <SlidersHorizontal style={{ width: "13px", height: "13px" }} />
            Filters
            {activeFilters > 0 && (
              <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#2563EB", color: "#FFF", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>{activeFilters}</span>
            )}
          </button>
        </div>

        {/* Expandable filters */}
        {filtersOpen && (
          <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Community</label>
              <select value={communityFilter} onChange={(e) => setCF(e.target.value)} style={selectStyle}>
                <option value="all">All communities</option>
                {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Cluster</label>
              <select value={clusterFilter} onChange={(e) => setKF(e.target.value)} disabled={communityFilter === "all"} style={{ ...selectStyle, opacity: communityFilter === "all" ? 0.5 : 1 }}>
                <option value="all">All clusters</option>
                {clusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Status</label>
              <select value={statusFilter} onChange={(e) => setSF(e.target.value)} style={selectStyle}>
                <option value="all">All statuses</option>
                {UNIT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Display</label>
              <select value={displayStatusFilter} onChange={(e) => setDSF(e.target.value)} style={selectStyle}>
                <option value="all">All display statuses</option>
                {DISPLAY_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#374151", cursor: "pointer", gridColumn: "span 4" }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: "#2563EB" }} />
              Show inactive units
              {showInactive && stats.inactive > 0 && (
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#FEF2F2", color: "#BE185D", padding: "1px 6px", borderRadius: "4px" }}>
                  {stats.inactive} inactive
                </span>
              )}
            </label>
          </div>
        )}
      </div>

      {/* ── Data table ─────────────────────────────────────── */}
      <DataTable
        columns={columns}
        rows={units}
        rowKey={(u) => u.id}
        loading={loading}
        emptyTitle="No units found"
        emptyDescription="Try adjusting your filters or add a new unit."
        rowClassName={(u) => !u.isActive ? "opacity-60" : ""}
      />

      {/* ══ DIALOGS ══════════════════════════════════════════ */}

      {/* ── Create / Edit unit ─────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent style={{ maxWidth: "640px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>{editingUnit ? "Edit Unit" : "Add Unit"}</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Configure unit info, cluster assignment, and gate access.</DialogDescription>
            </DialogHeader>
          </div>

          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "65vh", overflowY: "auto" }}>
            {/* Location */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Community">
                <select value={form.communityId} style={selectStyle} onChange={(e) => { const cid = e.target.value; setForm((p) => ({ ...p, communityId: cid, clusterId: "", allowedGateIds: [] })); void loadFormDeps(cid); }}>
                  <option value="">Select community</option>
                  {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Cluster">
                <select value={form.clusterId} style={selectStyle} onChange={(e) => setForm((p) => ({ ...p, clusterId: e.target.value }))}>
                  <option value="">No cluster</option>
                  {formClusters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>

            {/* Identity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Unit Number"><input value={form.unitNumber} onChange={(e) => setForm((p) => ({ ...p, unitNumber: e.target.value }))} placeholder="e.g. A-101" style={inputStyle} /></Field>
              <Field label="Block"><input value={form.block} onChange={(e) => setForm((p) => ({ ...p, block: e.target.value }))} placeholder="Optional" style={inputStyle} /></Field>
            </div>

            {/* Classification */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Type">
                <select value={form.type} style={selectStyle} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as UnitType }))}>
                  {UNIT_TYPES.map((t) => <option key={t} value={t}>{TYPE_ICONS[t]} {t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} style={selectStyle} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as UnitStatus }))}>
                  {UNIT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
            </div>

            {/* Specs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <Field label="Bedrooms"><input type="number" min={0} value={form.bedrooms} onChange={(e) => setForm((p) => ({ ...p, bedrooms: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Size (m²)"><input type="number" min={0} value={form.sizeSqm} onChange={(e) => setForm((p) => ({ ...p, sizeSqm: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Price (EGP)"><input type="number" min={0} value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} style={inputStyle} /></Field>
            </div>

            {/* Delivered toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={form.isDelivered} onChange={(e) => setForm((p) => ({ ...p, isDelivered: e.target.checked }))} style={{ accentColor: "#059669" }} />
              Mark as delivered
            </label>

            {/* Gate access */}
            <div style={{ borderRadius: "8px", border: "1px solid #EBEBEB", overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "#F9FAFB", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
                <DoorOpen style={{ width: "13px", height: "13px", color: "#6B7280" }} />
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827" }}>Gate Access</span>
              </div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "16px" }}>
                  {(["ALL_GATES", "SELECTED_GATES"] as GateAccessMode[]).map((mode) => (
                    <label key={mode} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                      <input type="radio" name="gateMode" checked={form.gateAccessMode === mode} onChange={() => setForm((p) => ({ ...p, gateAccessMode: mode, allowedGateIds: [] }))} style={{ accentColor: "#2563EB" }} />
                      {mode === "ALL_GATES" ? "All Gates" : "Selected Gates Only"}
                    </label>
                  ))}
                </div>
                {form.gateAccessMode === "SELECTED_GATES" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {!form.communityId && <p style={{ fontSize: "12px", color: "#9CA3AF" }}>Select a community first</p>}
                    {form.communityId && formGates.length === 0 && <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No gates in this community.</p>}
                    {formGates.map((g) => (
                      <label key={g.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", border: `1px solid ${form.allowedGateIds.includes(g.id) ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: "7px", background: form.allowedGateIds.includes(g.id) ? "#EFF6FF" : "#FAFAFA", cursor: "pointer", transition: "all 120ms ease", fontSize: "12.5px", color: "#374151" }}>
                        <input type="checkbox" checked={form.allowedGateIds.includes(g.id)} style={{ accentColor: "#2563EB" }} onChange={(e) => { const c = e.target.checked; setForm((p) => ({ ...p, allowedGateIds: c ? [...p.allowedGateIds, g.id] : p.allowedGateIds.filter((id) => id !== g.id) })); }} />
                        <span style={{ fontWeight: 600 }}>{g.name}</span>
                        <span style={{ fontSize: "10.5px", color: "#9CA3AF" }}>{g.allowedRoles.join(", ")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setFormOpen(false)} />
            <PrimaryBtn label={editingUnit ? "Save Changes" : "Create Unit"} onClick={() => void saveForm()} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate confirm ──────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent style={{ maxWidth: "380px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              <Power style={{ width: "18px", height: "18px", color: "#DC2626" }} />
            </div>
            <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>Deactivate Unit</DialogTitle>
            <DialogDescription style={{ fontSize: "12.5px", color: "#6B7280", marginTop: "6px" }}>
              <strong style={{ color: "#111827" }}>{unitToDeactivate?.unitNumber}</strong> will be marked inactive. Residents will lose access. This cannot be permanently deleted.
            </DialogDescription>
          </div>
          <div style={{ padding: "14px 24px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setConfirmOpen(false)} />
            <PrimaryBtn label="Deactivate" onClick={() => void confirmDeactivate()} danger />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Unit detail ─────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent style={{ maxWidth: "500px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "24px" }}>{TYPE_ICONS[detail?.type ?? ""] ?? "🏠"}</span>
              <div>
                <DialogTitle style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: "16px", color: "#111827" }}>{detail?.unitNumber ?? "Unit"}</DialogTitle>
                <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "2px" }}>{detail?.communityName} {detail?.clusterName ? `· ${detail.clusterName}` : ""}</p>
              </div>
            </div>
          </div>

          {detail ? (
            <>
              {/* Specs strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #F3F4F6" }}>
                {[
                  { label: "Bedrooms", value: detail.bedrooms != null ? `${detail.bedrooms} BR` : "—" },
                  { label: "Size",     value: detail.sizeSqm != null ? `${detail.sizeSqm} m²` : "—" },
                  { label: "Price",    value: detail.price != null ? `EGP ${detail.price.toLocaleString()}` : "—" },
                ].map((s, i) => (
                  <div key={s.label} style={{ padding: "12px 16px", borderRight: i < 2 ? "1px solid #F3F4F6" : "none" }}>
                    <p style={{ fontSize: "10.5px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{s.label}</p>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginTop: "3px", fontFamily: "'DM Mono', monospace" }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Gate access config */}
              <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <DoorOpen style={{ width: "13px", height: "13px", color: "#6B7280" }} />
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827" }}>Gate Access</span>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  {(["ALL_GATES", "SELECTED_GATES"] as GateAccessMode[]).map((mode) => (
                    <label key={mode} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                      <input type="radio" checked={detailMode === mode} onChange={() => setDetailMode(mode)} style={{ accentColor: "#2563EB" }} />
                      {mode === "ALL_GATES" ? "All Gates" : "Selected Gates"}
                    </label>
                  ))}
                </div>
                {detailMode === "SELECTED_GATES" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {detailGates.map((g) => (
                      <label key={g.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", border: `1px solid ${detailGateIds.includes(g.id) ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: "7px", background: detailGateIds.includes(g.id) ? "#EFF6FF" : "#FAFAFA", cursor: "pointer", fontSize: "12.5px", color: "#374151", transition: "all 120ms ease" }}>
                        <input type="checkbox" checked={detailGateIds.includes(g.id)} style={{ accentColor: "#2563EB" }} onChange={(e) => { const c = e.target.checked; setDetailGateIds((p) => c ? [...p, g.id] : p.filter((id) => id !== g.id)); }} />
                        <span style={{ fontWeight: 600 }}>{g.name}</span>
                        <span style={{ fontSize: "10.5px", color: "#9CA3AF" }}>{g.allowedRoles.join(", ")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <GhostBtn label="Close" onClick={() => setDetailOpen(false)} />
                <PrimaryBtn label="Save Gate Access" onClick={() => void saveDetailGateAccess()} />
              </div>
            </>
          ) : (
            <div style={{ padding: "32px 24px", textAlign: "center" }}>
              <div style={{ height: "12px", width: "60%", borderRadius: "4px", margin: "0 auto 8px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}