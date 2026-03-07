import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Building, DoorOpen, LayoutGrid, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import communityService, {
  type ClusterItem,
  type CommunityDetail,
  type CommunityListItem,
  type EntryRole,
  type GateItem,
  type GateRole,
} from "../../lib/community-service";
import { handleApiError } from "../../lib/api-client";

// ─── Constants ────────────────────────────────────────────────

const ENTRY_ROLE_OPTIONS: Array<{ value: EntryRole; label: string }> = [
  { value: "RESIDENT_OWNER",  label: "Owner"       },
  { value: "RESIDENT_FAMILY", label: "Family"      },
  { value: "RESIDENT_TENANT", label: "Tenant"      },
  { value: "VISITOR",         label: "Visitor"     },
  { value: "WORKER",          label: "Worker"      },
  { value: "STAFF",           label: "Staff"       },
];

const GATE_ROLE_OPTIONS: GateRole[] = ["RESIDENT","VISITOR","WORKER","DELIVERY","STAFF","RIDESHARE"];

// Teal → Blue → Pink cycling (matches DataTable / design system)
const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length];

const GATE_ROLE_COLORS: Record<GateRole, { bg: string; color: string }> = {
  RESIDENT:  { bg: "#EFF6FF", color: "#1D4ED8" },
  VISITOR:   { bg: "#ECFDF5", color: "#065F46" },
  WORKER:    { bg: "#FFFBEB", color: "#92400E" },
  DELIVERY:  { bg: "#FFF7ED", color: "#9A3412" },
  STAFF:     { bg: "#F5F3FF", color: "#5B21B6" },
  RIDESHARE: { bg: "#F0FDFA", color: "#0D9488" },
};

function entryRoleLabel(role: EntryRole) {
  return ENTRY_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

// ─── Form types ───────────────────────────────────────────────

type CommunityFormState = { name: string; code: string; displayOrder: string; isActive: boolean; allowedEntryRoles: EntryRole[] };
type ClusterFormState   = { name: string; code: string; displayOrder: string };
type GateFormState      = { name: string; code: string; etaMinutes: string; allowedRoles: GateRole[] };

const defaultCommunityForm: CommunityFormState = { name: "", code: "", displayOrder: "0", isActive: true, allowedEntryRoles: ["RESIDENT_OWNER","VISITOR","STAFF"] };
const defaultClusterForm: ClusterFormState     = { name: "", code: "", displayOrder: "0" };
const defaultGateForm: GateFormState           = { name: "", code: "", etaMinutes: "", allowedRoles: ["VISITOR"] };

// ─── Shared small components ──────────────────────────────────

function Chip({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ fontSize: "10.5px", fontWeight: 600, padding: "2px 8px", borderRadius: "5px", background: bg, color, display: "inline-block", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function IconBtn({
  icon, onClick, danger = false, disabled = false, title,
}: { icon: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; title?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "28px", height: "28px", borderRadius: "6px",
        border: `1px solid ${hov && !disabled ? (danger ? "#FCA5A5" : "#EBEBEB") : "#EBEBEB"}`,
        background: hov && !disabled ? (danger ? "#FEF2F2" : "#F5F5F5") : "#FFFFFF",
        color: disabled ? "#D1D5DB" : (danger ? "#DC2626" : "#6B7280"),
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 120ms ease", flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

function PrimaryBtn({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "7px 14px", borderRadius: "7px",
        background: hov ? "#1D4ED8" : "#2563EB",
        color: "#FFFFFF", border: "none", cursor: "pointer",
        fontSize: "12.5px", fontWeight: 600,
        transition: "background 120ms ease",
        fontFamily: "'Work Sans', sans-serif",
        boxShadow: "0 1px 3px rgba(37,99,235,0.25)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "7px 14px", borderRadius: "7px",
        background: hov ? "#F5F5F5" : "#FFFFFF",
        color: "#6B7280", border: "1px solid #E5E7EB", cursor: "pointer",
        fontSize: "12.5px", fontWeight: 500,
        transition: "background 120ms ease",
        fontFamily: "'Work Sans', sans-serif",
      }}
    >
      {label}
    </button>
  );
}

// ─── Form field primitives ────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", fontFamily: "'Work Sans', sans-serif" }}>{label}</label>
      {hint && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "-2px" }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px",
  border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827",
  background: "#FFFFFF", outline: "none", fontFamily: "'Work Sans', sans-serif",
  boxSizing: "border-box",
};

// ─── Pagination ───────────────────────────────────────────────

const PAGE_SIZE = 8;

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end", padding: "12px 16px", borderTop: "1px solid #F3F4F6" }}>
      <span style={{ fontSize: "11.5px", color: "#9CA3AF", marginRight: "8px", fontFamily: "'Work Sans', sans-serif" }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      {Array.from({ length: pages }).map((_, i) => {
        const p = i + 1;
        const active = p === page;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            style={{
              width: "28px", height: "28px", borderRadius: "6px", border: "none",
              background: active ? "#111827" : "transparent",
              color: active ? "#FFFFFF" : "#6B7280",
              fontSize: "12px", fontWeight: active ? 700 : 400, cursor: "pointer",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function CommunitiesManagement() {
  const [communities, setCommunities]             = useState<CommunityListItem[]>([]);
  const [selectedCommunityId, setSelectedId]       = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail]        = useState<CommunityDetail | null>(null);
  const [isLoadingList, setIsLoadingList]           = useState(false);
  const [isLoadingDetail, setIsLoadingDetail]      = useState(false);
  const [search, setSearch]                        = useState("");
  const [page, setPage]                            = useState(1);
  const [activeTab, setActiveTab]                  = useState<"clusters" | "gates">("clusters");

  const [communityDialogOpen, setCommunityDialogOpen] = useState(false);
  const [editingCommunity, setEditingCommunity]       = useState<CommunityListItem | null>(null);
  const [communityForm, setCommunityForm]             = useState<CommunityFormState>(defaultCommunityForm);

  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  const [editingCluster, setEditingCluster]       = useState<ClusterItem | null>(null);
  const [clusterForm, setClusterForm]             = useState<ClusterFormState>(defaultClusterForm);

  const [gateDialogOpen, setGateDialogOpen] = useState(false);
  const [editingGate, setEditingGate]       = useState<GateItem | null>(null);
  const [gateForm, setGateForm]             = useState<GateFormState>(defaultGateForm);

  // ── Data loading ────────────────────────────────────────────
  const loadCommunities = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const rows = await communityService.listCommunities();
      setCommunities(rows);
      if (!selectedCommunityId && rows.length > 0) setSelectedId(rows[0].id);
    } catch (e) {
      toast.error("Failed to load communities", { description: handleApiError(e) });
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedCommunityId]);

  const loadDetail = useCallback(async (id: string) => {
    setIsLoadingDetail(true);
    try {
      setSelectedDetail(await communityService.getCommunityDetail(id));
    } catch (e) {
      toast.error("Failed to load detail", { description: handleApiError(e) });
      setSelectedDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => { void loadCommunities(); }, [loadCommunities]);
  useEffect(() => {
    if (!selectedCommunityId) { setSelectedDetail(null); return; }
    void loadDetail(selectedCommunityId);
  }, [loadDetail, selectedCommunityId]);

  // ── Filtered + paginated list ────────────────────────────────
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return communities;
    return communities.filter((c) =>
      c.name.toLowerCase().includes(t) || (c.code ?? "").toLowerCase().includes(t)
    );
  }, [communities, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedCommunity = communities.find((c) => c.id === selectedCommunityId) ?? null;

  // ── Community CRUD ───────────────────────────────────────────
  const openCreateCommunity = () => { setEditingCommunity(null); setCommunityForm(defaultCommunityForm); setCommunityDialogOpen(true); };
  const openEditCommunity = (c: CommunityListItem) => {
    setEditingCommunity(c);
    setCommunityForm({ name: c.name, code: c.code ?? "", displayOrder: String(c.displayOrder ?? 0), isActive: c.isActive !== false, allowedEntryRoles: c.allowedEntryRoles?.length ? c.allowedEntryRoles : defaultCommunityForm.allowedEntryRoles });
    setCommunityDialogOpen(true);
  };
  const toggleEntryRole = (r: EntryRole) => setCommunityForm((p) => ({ ...p, allowedEntryRoles: p.allowedEntryRoles.includes(r) ? p.allowedEntryRoles.filter((x) => x !== r) : [...p.allowedEntryRoles, r] }));
  const saveCommunity = async () => {
    if (!communityForm.name.trim()) { toast.error("Name is required"); return; }
    if (!communityForm.allowedEntryRoles.length) { toast.error("Select at least one entry role"); return; }
    const payload = { name: communityForm.name.trim(), code: communityForm.code.trim() || undefined, displayOrder: Number(communityForm.displayOrder) || 0, isActive: communityForm.isActive, allowedEntryRoles: communityForm.allowedEntryRoles };
    try {
      if (editingCommunity) { await communityService.updateCommunity(editingCommunity.id, payload); toast.success("Community updated"); }
      else { const created = await communityService.createCommunity(payload); setSelectedId(created.id); toast.success("Community created"); }
      setCommunityDialogOpen(false);
      await loadCommunities();
    } catch (e) { toast.error("Failed to save", { description: handleApiError(e) }); }
  };
  const removeCommunity = async (c: CommunityListItem) => {
    try {
      await communityService.deleteCommunity(c.id);
      toast.success("Community deleted");
      if (selectedCommunityId === c.id) setSelectedId(null);
      await loadCommunities();
    } catch (e) { toast.error("Cannot delete", { description: handleApiError(e) }); }
  };

  // ── Cluster CRUD ─────────────────────────────────────────────
  const openCreateCluster = () => { setEditingCluster(null); setClusterForm(defaultClusterForm); setClusterDialogOpen(true); };
  const openEditCluster = (cl: ClusterItem) => { setEditingCluster(cl); setClusterForm({ name: cl.name, code: cl.code ?? "", displayOrder: String(cl.displayOrder ?? 0) }); setClusterDialogOpen(true); };
  const saveCluster = async () => {
    if (!selectedCommunityId || !clusterForm.name.trim()) { toast.error("Name is required"); return; }
    const payload = { name: clusterForm.name.trim(), code: clusterForm.code.trim() || undefined, displayOrder: Number(clusterForm.displayOrder) || 0 };
    try {
      if (editingCluster) { await communityService.updateCluster(editingCluster.id, payload); toast.success("Cluster updated"); }
      else { await communityService.createCluster(selectedCommunityId, payload); toast.success("Cluster created"); }
      setClusterDialogOpen(false);
      await loadDetail(selectedCommunityId);
      await loadCommunities();
    } catch (e) { toast.error("Failed to save cluster", { description: handleApiError(e) }); }
  };
  const removeCluster = async (cl: ClusterItem) => {
    if (!selectedCommunityId) return;
    if (cl.unitCount > 0) { toast.error("Cannot delete cluster with units"); return; }
    try { await communityService.deleteCluster(cl.id); toast.success("Cluster deactivated"); await loadDetail(selectedCommunityId); await loadCommunities(); }
    catch (e) { toast.error("Failed to delete", { description: handleApiError(e) }); }
  };
  const reorderCluster = async (id: string, dir: "up" | "down") => {
    if (!selectedCommunityId || !selectedDetail) return;
    const items = [...selectedDetail.clusters];
    const idx = items.findIndex((c) => c.id === id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    try { await communityService.reorderClusters(selectedCommunityId, items.map((c) => c.id)); await loadDetail(selectedCommunityId); toast.success("Order updated"); }
    catch (e) { toast.error("Reorder failed", { description: handleApiError(e) }); }
  };

  // ── Gate CRUD ────────────────────────────────────────────────
  const openCreateGate = () => { setEditingGate(null); setGateForm(defaultGateForm); setGateDialogOpen(true); };
  const openEditGate = (g: GateItem) => { setEditingGate(g); setGateForm({ name: g.name, code: g.code ?? "", etaMinutes: g.etaMinutes ? String(g.etaMinutes) : "", allowedRoles: g.allowedRoles.length ? g.allowedRoles : ["VISITOR"] }); setGateDialogOpen(true); };
  const toggleGateRole = (r: GateRole) => setGateForm((p) => ({ ...p, allowedRoles: p.allowedRoles.includes(r) ? p.allowedRoles.filter((x) => x !== r) : [...p.allowedRoles, r] }));
  const saveGate = async () => {
    if (!selectedCommunityId || !gateForm.name.trim()) { toast.error("Name is required"); return; }
    if (!gateForm.allowedRoles.length) { toast.error("Select at least one role"); return; }
    const payload = { name: gateForm.name.trim(), code: gateForm.code.trim() || undefined, etaMinutes: gateForm.etaMinutes.trim() ? Number(gateForm.etaMinutes) : undefined, allowedRoles: gateForm.allowedRoles };
    try {
      if (editingGate) { await communityService.updateGate(editingGate.id, payload); await communityService.updateGateRoles(editingGate.id, gateForm.allowedRoles); toast.success("Gate updated"); }
      else { await communityService.createGate(selectedCommunityId, payload); toast.success("Gate created"); }
      setGateDialogOpen(false);
      await loadDetail(selectedCommunityId);
      await loadCommunities();
    } catch (e) { toast.error("Failed to save gate", { description: handleApiError(e) }); }
  };
  const removeGate = async (g: GateItem) => {
    if (!selectedCommunityId) return;
    try { await communityService.deleteGate(g.id); toast.success("Gate deactivated"); await loadDetail(selectedCommunityId); await loadCommunities(); }
    catch (e) { toast.error("Failed to delete", { description: handleApiError(e) }); }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "0", fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`
        .cm-row:hover { background: #FAFAFA !important; }
        .cm-row-active { background: #F5F9FF !important; }
        .cm-row-active:hover { background: #EFF6FF !important; }
        .tab-btn { transition: all 120ms ease; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────── */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>
            Communities
          </h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>
            Manage projects, entry roles, clusters, and gates from one workspace.
          </p>
        </div>
        <PrimaryBtn label="Add Community" icon={<Plus style={{ width: "13px", height: "13px" }} />} onClick={openCreateCommunity} />
      </div>

      {/* ── Two-column layout: list left / workspace right ───── */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "16px", alignItems: "start" }}>

        {/* ══ LEFT: Community list ══════════════════════════════ */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>

          {/* Search bar */}
          <div style={{ padding: "12px", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
              <input
                placeholder="Search by name or code…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }}
              />
            </div>
          </div>

          {/* Count */}
          <div style={{ padding: "8px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10.5px", color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Communities
            </span>
            <span style={{ fontSize: "10.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>
              {filtered.length}
            </span>
          </div>

          {/* Rows */}
          <div>
            {isLoadingList ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ padding: "12px 14px", borderBottom: "1px solid #F5F5F5", display: "flex", flexDirection: "column", gap: "7px" }}>
                  <div style={{ height: "12px", width: "55%", borderRadius: "4px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
                  <div style={{ height: "10px", width: "35%", borderRadius: "4px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
                  <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
                </div>
              ))
            ) : paginated.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No communities found.</p>
              </div>
            ) : paginated.map((c, ci) => {
              const isActive = c.id === selectedCommunityId;
              const accent = accentFor(ci);
              return (
                <div
                  key={c.id}
                  className={isActive ? "cm-row cm-row-active" : "cm-row"}
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    padding: "11px 14px",
                    borderBottom: ci < paginated.length - 1 ? "1px solid #F5F5F5" : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
                    transition: "all 120ms ease",
                  }}
                >
                  {/* Icon */}
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: isActive ? `${accent}18` : "#F5F5F5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building style={{ width: "14px", height: "14px", color: isActive ? accent : "#9CA3AF" }} />
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </p>
                      {c.isActive === false && (
                        <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#9CA3AF", background: "#F3F4F6", padding: "1px 5px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: "3px", display: "flex", alignItems: "center", gap: "8px" }}>
                      {c.code && (
                        <span style={{ fontSize: "10.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{c.code}</span>
                      )}
                      <span style={{ fontSize: "10.5px", color: "#9CA3AF" }}>
                        {c._count?.clusters ?? 0} clusters · {c._count?.gates ?? 0} gates
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <IconBtn icon={<Pencil style={{ width: "11px", height: "11px" }} />} onClick={() => openEditCommunity(c)} />
                    <IconBtn icon={<Trash2 style={{ width: "11px", height: "11px" }} />} onClick={() => void removeCommunity(c)} danger />
                  </div>

                  {isActive && <ChevronRight style={{ width: "13px", height: "13px", color: accent, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>

        {/* ══ RIGHT: Workspace ══════════════════════════════════ */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFFFFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>

          {/* Workspace header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", letterSpacing: "-0.01em", lineHeight: 1 }}>
                {selectedCommunity ? selectedCommunity.name : "Workspace"}
              </h2>
              <p style={{ marginTop: "3px", fontSize: "11.5px", color: "#9CA3AF" }}>
                {selectedCommunity ? "Clusters and gates configuration" : "Select a community from the list"}
              </p>
            </div>

            {/* Entry roles chips */}
            {selectedCommunity && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "flex-end", maxWidth: "320px" }}>
                {(selectedCommunity.allowedEntryRoles ?? []).map((r, ri) => (
                  <Chip key={r} label={entryRoleLabel(r)} bg={`${accentFor(ri)}15`} color={accentFor(ri)} />
                ))}
              </div>
            )}
          </div>

          {!selectedCommunityId ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Building style={{ width: "20px", height: "20px", color: "#D1D5DB" }} />
              </div>
              <p style={{ fontSize: "13.5px", fontWeight: 600, color: "#6B7280" }}>No community selected</p>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "#9CA3AF" }}>Pick one from the list to manage its clusters and gates.</p>
            </div>
          ) : isLoadingDetail ? (
            <div style={{ padding: "32px 20px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: "52px", borderRadius: "8px", marginBottom: "8px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
              ))}
            </div>
          ) : selectedDetail ? (
            <div>
              {/* Tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: "0", borderBottom: "1px solid #F3F4F6", padding: "0 20px" }}>
                {([
                  { key: "clusters", label: "Clusters", icon: <LayoutGrid style={{ width: "12px", height: "12px" }} />, count: selectedDetail.clusters.length },
                  { key: "gates",    label: "Gates",    icon: <DoorOpen  style={{ width: "12px", height: "12px" }} />, count: selectedDetail.gates.length },
                ] as const).map((tab) => {
                  const isTab = activeTab === tab.key;
                  const accent = tab.key === "clusters" ? "#2563EB" : "#0D9488";
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className="tab-btn"
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "11px 14px",
                        fontSize: "12.5px", fontWeight: isTab ? 700 : 500,
                        color: isTab ? accent : "#6B7280",
                        background: "transparent", border: "none", cursor: "pointer",
                        borderBottom: isTab ? `2px solid ${accent}` : "2px solid transparent",
                        marginBottom: "-1px",
                        fontFamily: "'Work Sans', sans-serif",
                      }}
                    >
                      <span style={{ color: isTab ? accent : "#9CA3AF" }}>{tab.icon}</span>
                      {tab.label}
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "5px", background: isTab ? `${accent}15` : "#F3F4F6", color: isTab ? accent : "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}

                <div style={{ flex: 1 }} />

                {/* Add button */}
                {activeTab === "clusters" && (
                  <PrimaryBtn label="Add Cluster" icon={<Plus style={{ width: "12px", height: "12px" }} />} onClick={openCreateCluster} />
                )}
                {activeTab === "gates" && (
                  <PrimaryBtn label="Add Gate" icon={<Plus style={{ width: "12px", height: "12px" }} />} onClick={openCreateGate} />
                )}
              </div>

              {/* Tab content */}
              <div style={{ padding: "16px 20px" }}>

                {/* ── Clusters tab ─────────────────────────────── */}
                {activeTab === "clusters" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedDetail.clusters.length === 0 ? (
                      <div style={{ padding: "32px", textAlign: "center" }}>
                        <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No clusters yet. Add one above.</p>
                      </div>
                    ) : selectedDetail.clusters.map((cl, i) => (
                      <div key={cl.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA" }}>
                        {/* Order index */}
                        <span style={{ width: "20px", height: "20px", borderRadius: "5px", background: `${accentFor(i)}18`, color: accentFor(i), fontSize: "10.5px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                          {i + 1}
                        </span>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>{cl.name}</p>
                          <div style={{ marginTop: "3px", display: "flex", gap: "10px" }}>
                            {cl.code && <span style={{ fontSize: "11px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{cl.code}</span>}
                            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{cl.unitCount} unit{cl.unitCount !== 1 ? "s" : ""}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "4px" }}>
                          <IconBtn icon={<ArrowUp style={{ width: "11px", height: "11px" }} />} onClick={() => void reorderCluster(cl.id, "up")} disabled={i === 0} />
                          <IconBtn icon={<ArrowDown style={{ width: "11px", height: "11px" }} />} onClick={() => void reorderCluster(cl.id, "down")} disabled={i === selectedDetail.clusters.length - 1} />
                          <IconBtn icon={<Pencil style={{ width: "11px", height: "11px" }} />} onClick={() => openEditCluster(cl)} />
                          <IconBtn icon={<Trash2 style={{ width: "11px", height: "11px" }} />} onClick={() => void removeCluster(cl)} danger disabled={cl.unitCount > 0} title={cl.unitCount > 0 ? "Cannot delete while units are assigned" : "Delete cluster"} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Gates tab ────────────────────────────────── */}
                {activeTab === "gates" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedDetail.gates.length === 0 ? (
                      <div style={{ padding: "32px", textAlign: "center" }}>
                        <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No gates yet. Add one above.</p>
                      </div>
                    ) : selectedDetail.gates.map((g, gi) => (
                      <div key={g.id} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px", borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA" }}>
                        {/* Gate icon */}
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${accentFor(gi)}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                          <DoorOpen style={{ width: "14px", height: "14px", color: accentFor(gi) }} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>{g.name}</p>
                            {g.code && <span style={{ fontSize: "10.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{g.code}</span>}
                            {g.etaMinutes != null && (
                              <span style={{ fontSize: "10.5px", color: "#9CA3AF" }}>ETA {g.etaMinutes} min</span>
                            )}
                          </div>
                          <div style={{ marginTop: "7px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {g.allowedRoles.map((r) => (
                              <Chip key={r} label={r} bg={GATE_ROLE_COLORS[r].bg} color={GATE_ROLE_COLORS[r].color} />
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          <IconBtn icon={<Pencil style={{ width: "11px", height: "11px" }} />} onClick={() => openEditGate(g)} />
                          <IconBtn icon={<Trash2 style={{ width: "11px", height: "11px" }} />} onClick={() => void removeGate(g)} danger />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ══ DIALOGS ═══════════════════════════════════════════ */}

      {/* Community dialog */}
      <Dialog open={communityDialogOpen} onOpenChange={setCommunityDialogOpen}>
        <DialogContent style={{ maxWidth: "560px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>
                {editingCommunity ? "Edit Community" : "Add Community"}
              </DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>
                Configure base information and allowed entry roles.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Name"><input value={communityForm.name} onChange={(e) => setCommunityForm((p) => ({ ...p, name: e.target.value }))} placeholder="Al Karma Gates" style={inputStyle} /></Field>
              <Field label="Code"><input value={communityForm.code} onChange={(e) => setCommunityForm((p) => ({ ...p, code: e.target.value }))} placeholder="AKG" style={inputStyle} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Display Order"><input type="number" value={communityForm.displayOrder} onChange={(e) => setCommunityForm((p) => ({ ...p, displayOrder: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Status">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 10px", border: "1px solid #E5E7EB", borderRadius: "7px", cursor: "pointer", fontSize: "13px", color: "#374151" }}>
                  <input type="checkbox" checked={communityForm.isActive} onChange={(e) => setCommunityForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Active community
                </label>
              </Field>
            </div>
            <Field label="Allowed Entry Roles" hint="Select which resident types can be assigned to this community.">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "2px" }}>
                {ENTRY_ROLE_OPTIONS.map((opt, oi) => {
                  const checked = communityForm.allowedEntryRoles.includes(opt.value);
                  const acc = accentFor(oi);
                  return (
                    <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 10px", border: `1px solid ${checked ? acc + "40" : "#E5E7EB"}`, borderRadius: "7px", cursor: "pointer", background: checked ? `${acc}08` : "#FFFFFF", transition: "all 120ms ease", fontSize: "12.5px", fontWeight: checked ? 600 : 400, color: checked ? "#111827" : "#6B7280" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleEntryRole(opt.value)} style={{ accentColor: acc }} />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setCommunityDialogOpen(false)} />
            <PrimaryBtn label="Save Community" onClick={() => void saveCommunity()} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Cluster dialog */}
      <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
        <DialogContent style={{ maxWidth: "400px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>{editingCluster ? "Edit Cluster" : "Add Cluster"}</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Clusters organize units within a community.</DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <Field label="Name"><input value={clusterForm.name} onChange={(e) => setClusterForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Code"><input value={clusterForm.code} onChange={(e) => setClusterForm((p) => ({ ...p, code: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Display Order"><input type="number" value={clusterForm.displayOrder} onChange={(e) => setClusterForm((p) => ({ ...p, displayOrder: e.target.value }))} style={inputStyle} /></Field>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setClusterDialogOpen(false)} />
            <PrimaryBtn label="Save Cluster" onClick={() => void saveCluster()} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Gate dialog */}
      <Dialog open={gateDialogOpen} onOpenChange={setGateDialogOpen}>
        <DialogContent style={{ maxWidth: "500px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>{editingGate ? "Edit Gate" : "Add Gate"}</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Define gate roles and expected ETA.</DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Name"><input value={gateForm.name} onChange={(e) => setGateForm((p) => ({ ...p, name: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Code"><input value={gateForm.code} onChange={(e) => setGateForm((p) => ({ ...p, code: e.target.value }))} style={inputStyle} /></Field>
            </div>
            <Field label="ETA (minutes)" hint="Expected queue wait time at this gate.">
              <input type="number" min={1} max={60} value={gateForm.etaMinutes} onChange={(e) => setGateForm((p) => ({ ...p, etaMinutes: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Allowed Roles">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginTop: "2px" }}>
                {GATE_ROLE_OPTIONS.map((role, ri) => {
                  const checked = gateForm.allowedRoles.includes(role);
                  const { bg, color } = GATE_ROLE_COLORS[role];
                  return (
                    <label key={role} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 10px", border: `1px solid ${checked ? color + "40" : "#E5E7EB"}`, borderRadius: "7px", cursor: "pointer", background: checked ? `${bg}` : "#FFFFFF", transition: "all 120ms ease", fontSize: "12px", fontWeight: checked ? 600 : 400, color: checked ? color : "#6B7280" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleGateRole(role)} style={{ accentColor: color }} />
                      {role}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setGateDialogOpen(false)} />
            <PrimaryBtn label="Save Gate" onClick={() => void saveGate()} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}