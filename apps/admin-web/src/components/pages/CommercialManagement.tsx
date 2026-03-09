import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, Plus, RefreshCw, Search, Users, Crown,
  Briefcase, ClipboardList, Store, Landmark, Eye, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { DataTable, type DataTableColumn } from "../DataTable";
import { StatusBadge } from "../StatusBadge";
import commercialService, {
  CommercialEntity,
  CommercialEntityMember,
  CommercialMemberRole,
} from "../../lib/commercial-service";
import unitService, { type UnitListItem } from "../../lib/unit-service";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";
import apiClient from "../../lib/api-client";

// ─── Constants ────────────────────────────────────────────────

const SIMPLIFIED_ROLES: CommercialMemberRole[] = ["OWNER", "TENANT", "STAFF"];

const ROLE_META: Record<string, { label: string; icon: React.ReactNode; accent: string; bg: string }> = {
  OWNER:  { label: "Owner",  icon: <Crown         style={{ width: "12px", height: "12px" }} />, accent: "#BE185D", bg: "#FFF1F2" },
  TENANT: { label: "Tenant", icon: <Briefcase     style={{ width: "12px", height: "12px" }} />, accent: "#7C3AED", bg: "#F5F3FF" },
  STAFF:  { label: "Staff",  icon: <ClipboardList style={{ width: "12px", height: "12px" }} />, accent: "#0D9488", bg: "#F0FDFA" },
};

type UnitTypeTab = "all" | "COMMERCIAL_UNIT" | "ADMINISTRATIVE";

type OptionRow     = { id: string; label: string };
type UnitOptionRow = { id: string; label: string; communityId: string | null };

// Enriched row: entity + unit info merged
type CommercialRow = {
  entity: CommercialEntity;
  unit: UnitListItem | null;
  ownerLabel: string;
  communityLabel: string;
  unitLabel: string;
};

type AddOwnerForm = {
  entityId: string;
  nameEN: string;
  nameAR: string;
  email: string;
  phone: string;
  nationalIdFile: File | null;
  unitSearch: string;
};

const INIT_ADD_OWNER: AddOwnerForm = { entityId: "", nameEN: "", nameAR: "", email: "", phone: "", nationalIdFile: null, unitSearch: "" };

// ─── Primitive UI components ──────────────────────────────────

function PrimaryBtn({ label, icon, onClick, loading: ld = false }: { label: string; icon?: React.ReactNode; onClick: () => void; loading?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={ld} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", background: hov ? "#1D4ED8" : "#2563EB", color: "#FFF", border: "none", cursor: ld ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", boxShadow: "0 1px 3px rgba(37,99,235,0.25)", opacity: ld ? 0.7 : 1, flexShrink: 0 }}>
      {icon}{ld ? "Saving..." : label}
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

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: "8px 16px", borderRadius: "8px", border: "none",
        background: active ? "#FFF" : hov ? "#E9EAEC" : "transparent",
        color: active ? "#111827" : "#6B7280",
        fontSize: "12.5px", fontWeight: active ? 700 : 500,
        cursor: "pointer", transition: "all 120ms ease",
        fontFamily: "'Work Sans', sans-serif",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
      }}>
      {label}
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

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

// ─── StatCard ─────────────────────────────────────────────────
function StatCard({ label, value, accent, icon, onClick, active }: { label: string; value: string | number; accent: string; icon: React.ReactNode; onClick?: () => void; active?: boolean }) {
  const [hov, setHov] = useState(false);
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: "14px 16px", background: active ? `${accent}08` : hov && clickable ? "#FAFAFA" : "#FFF", borderRadius: "10px",
        border: `1px solid ${active ? accent : "#EBEBEB"}`, boxShadow: active ? `0 0 0 1px ${accent}40` : "0 1px 3px rgba(0,0,0,0.04)",
        borderTop: `3px solid ${accent}`, minWidth: 0,
        cursor: clickable ? "pointer" : "default", transition: "all 150ms ease",
        transform: hov && clickable ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{value}</p>
          <p style={{ marginTop: "3px", fontSize: "11px", color: "#9CA3AF" }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Member card (simplified: owner, tenant, staff) ───────────
function MemberCard({ member, userLabel }: { member: CommercialEntityMember; userLabel: string }) {
  const meta = ROLE_META[member.role] ?? ROLE_META.STAFF;
  return (
    <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA", display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", color: meta.accent, flexShrink: 0 }}>
        {meta.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userLabel}</p>
        <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px" }}>{meta.label}</p>
      </div>
      <StatusBadge value={member.isActive ? "ACTIVE" : "INACTIVE"} />
    </div>
  );
}

// ─── Role section (simplified) ────────────────────────────────
function RoleSection({ role, members, usersById }: {
  role: CommercialMemberRole;
  members: CommercialEntityMember[];
  usersById: Map<string, string>;
}) {
  const meta = ROLE_META[role] ?? ROLE_META.STAFF;
  if (members.length === 0) return null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
        <span style={{ color: meta.accent }}>{meta.icon}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em" }}>{meta.label}</span>
        <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: `${meta.accent}15`, color: meta.accent, fontFamily: "'DM Mono', monospace" }}>{members.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {members.map((m) => (
          <MemberCard key={m.id} member={m} userLabel={usersById.get(m.userId) ?? m.userId} />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function CommercialManagement() {
  const [entities, setEntities]             = useState<CommercialEntity[]>([]);
  const [units, setUnits]                   = useState<UnitListItem[]>([]);
  const [members, setMembers]               = useState<CommercialEntityMember[]>([]);
  const [communityOptions, setCommunities]  = useState<OptionRow[]>([]);
  const [unitOptions, setUnitOptions]       = useState<UnitOptionRow[]>([]);
  const [userOptions, setUsers]             = useState<OptionRow[]>([]);
  const [search, setSearch]                 = useState("");
  const [tab, setTab]                       = useState<UnitTypeTab>("all");
  const [selectedEntityId, setSelectedId]   = useState("");
  const [loading, setLoading]               = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [saving, setSaving]                 = useState(false);

  // Add Owner dialog
  const [addOwnerOpen, setAddOwnerOpen]     = useState(false);
  const [ownerForm, setOwnerForm]           = useState<AddOwnerForm>(INIT_ADD_OWNER);

  // ── Derived maps ────────────────────────────────────────────
  const usersById     = useMemo(() => { const m = new Map<string, string>(); userOptions.forEach((r) => m.set(r.id, r.label)); return m; }, [userOptions]);
  const communityById = useMemo(() => { const m = new Map<string, string>(); communityOptions.forEach((r) => m.set(r.id, r.label)); return m; }, [communityOptions]);
  const unitById      = useMemo(() => { const m = new Map<string, string>(); unitOptions.forEach((r) => m.set(r.id, r.label)); return m; }, [unitOptions]);
  const unitDataById  = useMemo(() => { const m = new Map<string, UnitListItem>(); units.forEach((u) => m.set(u.id, u)); return m; }, [units]);

  const selectedEntity = useMemo(() => entities.find((e) => e.id === selectedEntityId) ?? null, [entities, selectedEntityId]);

  // Enriched rows: entity + unit data merged
  const enrichedRows: CommercialRow[] = useMemo(() => {
    return entities.map((entity) => {
      const unit = unitDataById.get(entity.unitId) ?? null;
      return {
        entity,
        unit,
        ownerLabel: entity.owner ? (usersById.get(entity.owner.userId) ?? entity.owner.userId) : "",
        communityLabel: communityById.get(entity.communityId) ?? "",
        unitLabel: unitById.get(entity.unitId) ?? "",
      };
    });
  }, [entities, unitDataById, usersById, communityById, unitById]);

  // Filter by tab + search
  const filteredRows = useMemo(() => {
    let rows = enrichedRows;

    // Tab filter by unit type
    if (tab !== "all") {
      rows = rows.filter((r) => r.unit?.type === tab);
    }

    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        return [r.entity.name, r.ownerLabel, r.communityLabel, r.unitLabel, r.entity.description ?? ""]
          .join(" ").toLowerCase().includes(q);
      });
    }

    return rows;
  }, [enrichedRows, tab, search]);

  // Stats
  const stats = useMemo(() => {
    const totalUnits = enrichedRows.length;
    const owners = enrichedRows.filter((r) => r.entity.owner != null).length;
    const tenants = enrichedRows.reduce((sum, r) => sum + (r.entity.tenants?.length ?? 0), 0);
    const staff = enrichedRows.reduce((sum, r) => sum + (r.entity.staffMembers?.length ?? 0), 0);
    return { totalUnits, owners, tenants, staff };
  }, [enrichedRows]);

  // Members for detail panel
  const ownerMembers  = useMemo(() => members.filter((m) => m.role === "OWNER"), [members]);
  const tenantMembers = useMemo(() => members.filter((m) => m.role === "TENANT"), [members]);
  const staffMembers  = useMemo(() => members.filter((m) => m.role === "STAFF" || m.role === "HR" || m.role === "FINANCE"), [members]);

  // ── Loaders ─────────────────────────────────────────────────
  const loadOptions = useCallback(async () => {
    const [c, u, us] = await Promise.all([
      commercialService.listCommunityOptions(),
      commercialService.listUnitOptions(),
      commercialService.listUserOptions(),
    ]);
    setCommunities(c);
    setUnitOptions(u);
    setUsers(us);
  }, []);

  const loadEntities = useCallback(async (opts?: { preserve?: boolean }) => {
    setLoading(true);
    try {
      const rows = await commercialService.listEntities({ includeInactive: true });
      setEntities(rows);
      if (!rows.length) { setSelectedId(""); return; }
      if (opts?.preserve && rows.some((r) => r.id === selectedEntityId)) return;
      setSelectedId(rows[0].id);
    } catch (e) { toast.error("Failed to load commercial data", { description: errorMessage(e) }); }
    finally { setLoading(false); }
  }, [selectedEntityId]);

  const loadUnits = useCallback(async () => {
    try {
      const res = await unitService.listUnits({ category: "COMMERCIAL", limit: 500, includeInactive: true });
      setUnits(res.data);
    } catch {
      // Units may fail silently; entities still work
    }
  }, []);

  const loadMembers = useCallback(async (id: string) => {
    if (!id) { setMembers([]); return; }
    setMembersLoading(true);
    try { setMembers(await commercialService.listMembers(id)); }
    catch (e) { toast.error("Failed to load members", { description: errorMessage(e) }); }
    finally { setMembersLoading(false); }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadOptions(), loadEntities(), loadUnits()]);
  }, [loadOptions, loadEntities, loadUnits]);

  useEffect(() => { void refreshAll(); }, []); // eslint-disable-line
  useEffect(() => { void loadMembers(selectedEntityId); }, [loadMembers, selectedEntityId]);

  // ── Add Owner handler ───────────────────────────────────────
  const openAddOwner = () => {
    setOwnerForm(INIT_ADD_OWNER);
    setAddOwnerOpen(true);
  };

  const saveAddOwner = async () => {
    if (!ownerForm.entityId) { toast.error("Select a commercial unit"); return; }
    if (!ownerForm.nameEN.trim()) { toast.error("Owner name (English) is required"); return; }
    if (!ownerForm.phone.trim()) { toast.error("Phone number is required"); return; }
    if (!ownerForm.nationalIdFile) { toast.error("National ID document is required"); return; }
    setSaving(true);
    try {
      // 1. Create user first
      const userRes = await apiClient.post<{ id: string }>("/users", {
        nameEN: ownerForm.nameEN.trim(),
        nameAR: ownerForm.nameAR.trim() || undefined,
        email: ownerForm.email.trim() || undefined,
        phone: ownerForm.phone.trim(),
      });
      const userId = userRes.data.id;

      // 2. Add owner member
      const member = await commercialService.addMember(ownerForm.entityId, {
        userId,
        role: "OWNER",
      });

      // 3. Upload national ID file
      const formData = new FormData();
      formData.append("file", ownerForm.nationalIdFile);
      const uploadRes = await apiClient.post<{ id: string }>("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await commercialService.updateMemberNationalId(member.id, uploadRes.data.id);

      toast.success("Owner added successfully");
      setAddOwnerOpen(false);
      await Promise.all([loadEntities({ preserve: true }), loadOptions()]);
      if (selectedEntityId === ownerForm.entityId) {
        await loadMembers(selectedEntityId);
      }
    } catch (e) { toast.error("Failed to add owner", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  // Entities without owners (for the Add Owner dialog), with searchable unit labels
  const entitiesWithoutOwner = useMemo(() => {
    return entities.filter((e) => !e.owner);
  }, [entities]);

  const filteredOwnerUnits = useMemo(() => {
    const q = ownerForm.unitSearch.trim().toLowerCase();
    return entitiesWithoutOwner.filter((ent) => {
      if (!q) return true;
      const u = unitDataById.get(ent.unitId);
      const searchStr = [u?.unitNumber, u?.block, ent.name, communityById.get(ent.communityId)].join(" ").toLowerCase();
      return searchStr.includes(q);
    });
  }, [entitiesWithoutOwner, ownerForm.unitSearch, unitDataById, communityById]);

  // ── Table columns ───────────────────────────────────────────
  const columns: DataTableColumn<CommercialRow>[] = [
    {
      key: "unit", header: "Unit",
      render: (r) => (
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: r.unit?.type === "COMMERCIAL_UNIT" ? "#FFF7ED" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {r.unit?.type === "COMMERCIAL_UNIT"
              ? <Store style={{ width: "14px", height: "14px", color: "#D97706" }} />
              : <Landmark style={{ width: "14px", height: "14px", color: "#2563EB" }} />}
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
              {r.unit ? `${r.unit.block ? `Block ${r.unit.block} - ` : ""}Unit ${r.unit.unitNumber}` : r.entity.name}
            </p>
            <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px", fontFamily: "'DM Mono', monospace" }}>
              {r.entity.name}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "community", header: "Community",
      render: (r) => (
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151" }}>
          {r.communityLabel || "---"}
        </span>
      ),
    },
    {
      key: "type", header: "Type",
      render: (r) => {
        const unitType = r.unit?.type;
        const isCommercial = unitType === "COMMERCIAL_UNIT";
        return (
          <span style={{
            fontSize: "10.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px",
            background: isCommercial ? "#FFF7ED" : "#EFF6FF",
            color: isCommercial ? "#D97706" : "#2563EB",
          }}>
            {isCommercial ? "Commercial" : "Administrative"}
          </span>
        );
      },
    },
    {
      key: "owner", header: "Owner",
      render: (r) => r.entity.owner ? (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, color: "#FFF", flexShrink: 0 }}>
            {r.ownerLabel.slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontSize: "12.5px", color: "#374151" }}>{r.ownerLabel}</span>
        </div>
      ) : <span style={{ color: "#D1D5DB", fontSize: "12px" }}>No owner</span>,
    },
    {
      key: "members", header: "Members",
      render: (r) => (
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827", fontFamily: "'DM Mono', monospace" }}>
          {r.entity.memberCount ?? 0}
        </span>
      ),
    },
    {
      key: "status", header: "Status",
      render: (r) => <StatusBadge value={r.entity.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          <button type="button" onClick={(ev) => { ev.stopPropagation(); setSelectedId(r.entity.id); }}
            title="View details"
            style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #EBEBEB", background: "#FFF", color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms ease", flexShrink: 0 }}>
            <Eye style={{ width: "11px", height: "11px" }} />
          </button>
        </div>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`
        @keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .cm-row:hover td { background: #FAFAFA !important; }
        .cm-row-sel td  { background: #F5F9FF !important; }
        .cm-row-sel:hover td { background: #EFF6FF !important; }
      `}</style>

      {/* ── Page header ────────────────────────────────────── */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>Commercial</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Commercial and administrative units with owners, tenants, and staff</p>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatCard
          label="Commercial Units" value={stats.totalUnits} accent="#2563EB"
          icon={<Building2 style={{ width: "16px", height: "16px" }} />}
          onClick={() => setTab("all")} active={tab === "all"}
        />
        <StatCard
          label="Owners" value={stats.owners} accent="#0D9488"
          icon={<Crown style={{ width: "16px", height: "16px" }} />}
        />
        <StatCard
          label="Tenants" value={stats.tenants} accent="#D97706"
          icon={<Briefcase style={{ width: "16px", height: "16px" }} />}
        />
        <StatCard
          label="Staff" value={stats.staff} accent="#6B7280"
          icon={<ClipboardList style={{ width: "16px", height: "16px" }} />}
        />
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "4px", borderRadius: "10px", background: "#F3F4F6", marginBottom: "20px" }}>
        <TabBtn label="All" active={tab === "all"} onClick={() => setTab("all")} />
        <TabBtn label="Commercial Units" active={tab === "COMMERCIAL_UNIT"} onClick={() => setTab("COMMERCIAL_UNIT")} />
        <TabBtn label="Administrative" active={tab === "ADMINISTRATIVE"} onClick={() => setTab("ADMINISTRATIVE")} />

        <PrimaryBtn label="Add Owner" icon={<Plus style={{ width: "13px", height: "13px" }} />} onClick={openAddOwner}
          loading={false} />
        <button type="button" onClick={() => void refreshAll()}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", marginLeft: "auto" }}>
          <RefreshCw style={{ width: "12px", height: "12px" }} /> Refresh
        </button>
      </div>

      {/* ── Search bar ─────────────────────────────────────── */}
      <div style={{ background: "#FFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "16px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "10px", padding: "12px 14px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
            <input placeholder="Search by unit, owner, community..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }} />
          </div>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: selectedEntity ? "1fr 340px" : "1fr", gap: "16px", alignItems: "start" }}>

        {/* LEFT: Units table */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 style={{ width: "14px", height: "14px", color: "#2563EB" }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Commercial Units</span>
            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: "#EFF6FF", color: "#2563EB", fontFamily: "'DM Mono', monospace" }}>{filteredRows.length}</span>
          </div>
          <DataTable
            columns={columns}
            rows={filteredRows}
            rowKey={(r) => r.entity.id}
            loading={loading}
            emptyTitle="No commercial units found"
            emptyDescription="Commercial entities will appear here when units are created."
            rowClassName={(r) => selectedEntityId === r.entity.id ? "cm-row-sel cm-row" : "cm-row"}
            onRowClick={(r) => setSelectedId(r.entity.id)}
          />
        </div>

        {/* RIGHT: Detail panel */}
        {selectedEntity && (
          <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden", position: "sticky", top: "16px" }}>

            {/* Panel header */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Building2 style={{ width: "13px", height: "13px", color: "#2563EB" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(() => {
                      const u = unitDataById.get(selectedEntity.unitId);
                      return u ? `${u.block ? `Block ${u.block} - ` : ""}Unit ${u.unitNumber}` : selectedEntity.name;
                    })()}
                  </p>
                  <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px" }}>
                    {communityById.get(selectedEntity.communityId) ?? "---"} · {unitById.get(selectedEntity.unitId) ?? "---"}
                  </p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge value={selectedEntity.isActive ? "ACTIVE" : "INACTIVE"} />
                </div>
              </div>

              {/* Unit type badge */}
              {(() => {
                const u = unitDataById.get(selectedEntity.unitId);
                const isCommercial = u?.type === "COMMERCIAL_UNIT";
                return u ? (
                  <span style={{
                    display: "inline-block", marginTop: "8px",
                    fontSize: "10.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px",
                    background: isCommercial ? "#FFF7ED" : "#EFF6FF",
                    color: isCommercial ? "#D97706" : "#2563EB",
                  }}>
                    {isCommercial ? "Commercial Unit" : "Administrative"}
                  </span>
                ) : null;
              })()}
            </div>

            {/* Members list */}
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {membersLoading ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>Loading members...</p>
                </div>
              ) : members.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <Users style={{ width: "24px", height: "24px", color: "#D1D5DB", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No members assigned</p>
                </div>
              ) : (
                <>
                  <RoleSection role="OWNER" members={ownerMembers} usersById={usersById} />
                  <RoleSection role="TENANT" members={tenantMembers} usersById={usersById} />
                  <RoleSection role="STAFF" members={staffMembers} usersById={usersById} />
                </>
              )}

              {/* Summary */}
              {selectedEntity.memberCount > 0 && (
                <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#F9FAFB", border: "1px solid #F3F4F6" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Total Members</span>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#111827", fontFamily: "'DM Mono', monospace" }}>{selectedEntity.memberCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Owner Dialog ───────────────────────────────── */}
      <Dialog open={addOwnerOpen} onOpenChange={setAddOwnerOpen}>
        <DialogContent style={{ maxWidth: "560px", fontFamily: "'Work Sans', sans-serif" }}>
          <DialogHeader>
            <DialogTitle style={{ fontSize: "15px", fontWeight: 800, color: "#111827" }}>Add Owner</DialogTitle>
            <DialogDescription style={{ fontSize: "12.5px", color: "#6B7280" }}>
              Assign an owner to a commercial unit. National ID document is required.
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "8px" }}>
            {/* Unit search + selection */}
            <Field label="Commercial Unit *" hint="Search and select a unit without an owner">
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: "10px", top: "9px", width: "13px", height: "13px", color: "#9CA3AF", pointerEvents: "none" }} />
                <input
                  placeholder="Search by unit number, block, community..."
                  value={ownerForm.unitSearch}
                  onChange={(e) => setOwnerForm((p) => ({ ...p, unitSearch: e.target.value }))}
                  style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }}
                />
              </div>
              <div style={{ maxHeight: "150px", overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: "7px", marginTop: "4px" }}>
                {filteredOwnerUnits.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#9CA3AF", padding: "12px", textAlign: "center" }}>
                    {entitiesWithoutOwner.length === 0 ? "All units have owners" : "No matching units"}
                  </p>
                ) : filteredOwnerUnits.map((ent) => {
                  const u = unitDataById.get(ent.unitId);
                  const isCommercial = u?.type === "COMMERCIAL_UNIT";
                  const unitLabel = u ? `Unit ${u.unitNumber}${u.block ? ` (Block ${u.block})` : ""}` : ent.name;
                  const communityLabel = communityById.get(ent.communityId) ?? "";
                  const selected = ownerForm.entityId === ent.id;
                  return (
                    <div
                      key={ent.id}
                      onClick={() => setOwnerForm((p) => ({ ...p, entityId: ent.id }))}
                      style={{
                        padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                        background: selected ? "#EFF6FF" : "transparent",
                        borderBottom: "1px solid #F3F4F6",
                        transition: "background 100ms ease",
                      }}
                    >
                      <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: isCommercial ? "#FFF7ED" : "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {isCommercial
                          ? <Store style={{ width: "11px", height: "11px", color: "#D97706" }} />
                          : <Landmark style={{ width: "11px", height: "11px", color: "#2563EB" }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#111827", lineHeight: 1.2 }}>
                          {unitLabel}
                          <span style={{ fontSize: "10px", fontWeight: 700, marginLeft: "6px", padding: "1px 5px", borderRadius: "4px", background: isCommercial ? "#FFF7ED" : "#EFF6FF", color: isCommercial ? "#D97706" : "#2563EB" }}>
                            {isCommercial ? "Commercial" : "Administrative"}
                          </span>
                        </p>
                        <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "1px" }}>{communityLabel}</p>
                      </div>
                      {selected && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            </Field>

            {/* Owner info fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Full Name (English) *">
                <input value={ownerForm.nameEN} onChange={(e) => setOwnerForm((p) => ({ ...p, nameEN: e.target.value }))} placeholder="John Doe" style={inputStyle} />
              </Field>
              <Field label="Full Name (Arabic)">
                <input value={ownerForm.nameAR} onChange={(e) => setOwnerForm((p) => ({ ...p, nameAR: e.target.value }))} placeholder="الاسم بالعربية" dir="rtl" style={inputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Phone *">
                <input value={ownerForm.phone} onChange={(e) => setOwnerForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+20 1xx xxx xxxx" style={inputStyle} />
              </Field>
              <Field label="Email">
                <input type="email" value={ownerForm.email} onChange={(e) => setOwnerForm((p) => ({ ...p, email: e.target.value }))} placeholder="owner@email.com" style={inputStyle} />
              </Field>
            </div>

            <Field label="National ID Document *" hint="Upload a scan or photo (required)">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setOwnerForm((p) => ({ ...p, nationalIdFile: file }));
                }}
                style={{ ...inputStyle, padding: "7px 10px", fontSize: "12px" }}
              />
              {ownerForm.nationalIdFile && (
                <p style={{ fontSize: "11px", color: "#0D9488", marginTop: "4px", fontWeight: 600 }}>
                  Selected: {ownerForm.nationalIdFile.name}
                </p>
              )}
            </Field>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
            <GhostBtn label="Cancel" onClick={() => setAddOwnerOpen(false)} />
            <PrimaryBtn label="Add Owner" icon={<Plus style={{ width: "13px", height: "13px" }} />} onClick={() => void saveAddOwner()} loading={saving} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
