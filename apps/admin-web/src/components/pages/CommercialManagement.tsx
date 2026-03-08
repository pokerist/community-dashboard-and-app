import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, Pencil, Plus, RefreshCw, Trash2,
  UserCog, Users, Search, ChevronRight,
  ShieldCheck, Crown, Briefcase, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { DataTable, type DataTableColumn } from "../DataTable";
import { StatusBadge } from "../StatusBadge";
import commercialService, {
  COMMERCIAL_MEMBER_ROLES,
  COMMERCIAL_PERMISSION_KEYS,
  CommercialEntity,
  CommercialEntityMember,
  CommercialMemberPermissions,
  CommercialMemberRole,
} from "../../lib/commercial-service";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";

// ─── Constants ────────────────────────────────────────────────

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];
const accentFor = (i: number) => ACCENTS[i % ACCENTS.length];

const ROLE_META: Record<CommercialMemberRole, { label: string; icon: React.ReactNode; accent: string; bg: string }> = {
  OWNER: { label: "Owner",  icon: <Crown    style={{ width: "12px", height: "12px" }} />, accent: "#BE185D", bg: "#FFF1F2" },
  HR:    { label: "HR",     icon: <UserCog  style={{ width: "12px", height: "12px" }} />, accent: "#2563EB", bg: "#EFF6FF" },
  STAFF: { label: "Staff",  icon: <Briefcase style={{ width: "12px", height: "12px" }} />, accent: "#0D9488", bg: "#F0FDFA" },
};

const PERMISSION_LABELS: Record<keyof CommercialMemberPermissions, string> = {
  can_work_orders:      "Work Orders",
  can_attendance:       "Attendance",
  can_service_requests: "Service Requests",
  can_tickets:          "Ticket Handling",
  can_photo_upload:     "Photo Uploads",
  can_task_reminders:   "Task Reminders",
};

const EMPTY_PERMISSIONS: CommercialMemberPermissions = { can_work_orders: false, can_attendance: false, can_service_requests: false, can_tickets: false, can_photo_upload: false, can_task_reminders: false };
const FULL_PERMISSIONS:  CommercialMemberPermissions = { can_work_orders: true,  can_attendance: true,  can_service_requests: true,  can_tickets: true,  can_photo_upload: true,  can_task_reminders: true  };

function memberDefaultPermissions(role: CommercialMemberRole): CommercialMemberPermissions {
  return role === "OWNER" || role === "HR" ? { ...FULL_PERMISSIONS } : { ...EMPTY_PERMISSIONS };
}

// ─── Types ────────────────────────────────────────────────────

type OptionRow     = { id: string; label: string };
type UnitOptionRow = { id: string; label: string; communityId: string | null };

type EntityFormState = { name: string; description: string; communityId: string; unitId: string; ownerUserId: string };
type MemberFormState = { userId: string; role: CommercialMemberRole; isActive: boolean; permissions: CommercialMemberPermissions };

const INIT_ENTITY: EntityFormState = { name: "", description: "", communityId: "", unitId: "", ownerUserId: "" };
const INIT_MEMBER: MemberFormState = { userId: "", role: "STAFF", isActive: true, permissions: { ...EMPTY_PERMISSIONS } };

// ─── Primitive UI components ──────────────────────────────────

function PrimaryBtn({ label, icon, onClick, loading: ld = false }: { label: string; icon?: React.ReactNode; onClick: () => void; loading?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={ld} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", background: hov ? "#1D4ED8" : "#2563EB", color: "#FFF", border: "none", cursor: ld ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", boxShadow: "0 1px 3px rgba(37,99,235,0.25)", opacity: ld ? 0.7 : 1, flexShrink: 0 }}>
      {icon}{ld ? "Saving…" : label}
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

function OutlineBtn({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 11px", borderRadius: "7px", background: hov ? "#F5F5F5" : "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "12px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
      {icon}{label}
    </button>
  );
}

function IconBtn({ icon, onClick, danger = false, title }: { icon: React.ReactNode; onClick: (e: React.MouseEvent) => void; danger?: boolean; title?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${hov ? (danger ? "#FCA5A5" : "#D1D5DB") : "#EBEBEB"}`, background: hov ? (danger ? "#FEF2F2" : "#F5F5F5") : "#FFF", color: danger ? "#DC2626" : "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms ease", flexShrink: 0 }}>
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

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: "72px", resize: "vertical" };

// ─── KPI stat card ────────────────────────────────────────────
function StatCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: 1, padding: "14px 16px", background: "#FFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderTop: `3px solid ${accent}`, minWidth: 0 }}>
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

// ─── Member card (inside hierarchy panel) ────────────────────
function MemberCard({ member, userLabel, onEdit, onRemove }: { member: CommercialEntityMember; userLabel: string; onEdit: () => void; onRemove: () => void }) {
  const meta = ROLE_META[member.role];
  const activePerms = COMMERCIAL_PERMISSION_KEYS.filter((k) => member.permissions[k]);

  return (
    <div style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FAFAFA", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Role icon */}
        <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", color: meta.accent, flexShrink: 0 }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userLabel}</p>
          <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px" }}>Updated {formatDateTime(member.updatedAt)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <StatusBadge value={member.isActive ? "ACTIVE" : "INACTIVE"} />
          <IconBtn icon={<Pencil style={{ width: "11px", height: "11px" }} />} onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit member" />
          <IconBtn icon={<Trash2 style={{ width: "11px", height: "11px" }} />} onClick={(e) => { e.stopPropagation(); onRemove(); }} danger title="Archive member" />
        </div>
      </div>

      {/* Permission chips */}
      {activePerms.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {activePerms.map((k) => (
            <span key={k} style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px", background: `${meta.accent}12`, color: meta.accent }}>
              {PERMISSION_LABELS[k]}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: "10.5px", color: "#D1D5DB" }}>No permission flags enabled</p>
      )}
    </div>
  );
}

// ─── Role section ─────────────────────────────────────────────
function RoleSection({ role, members, usersById, onEdit, onRemove, onAdd }: {
  role: CommercialMemberRole;
  members: CommercialEntityMember[];
  usersById: Map<string, string>;
  onEdit: (m: CommercialEntityMember) => void;
  onRemove: (m: CommercialEntityMember) => void;
  onAdd: () => void;
}) {
  const meta = ROLE_META[role];
  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: meta.accent }}>{meta.icon}</span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em" }}>{meta.label}</span>
          <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: `${meta.accent}15`, color: meta.accent, fontFamily: "'DM Mono', monospace" }}>{members.length}</span>
        </div>
        {role !== "OWNER" && (
          <button type="button" onClick={onAdd}
            style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: meta.accent, background: "transparent", border: "none", cursor: "pointer", padding: "2px 0" }}>
            <Plus style={{ width: "11px", height: "11px" }} /> Add
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <div style={{ padding: "12px", borderRadius: "8px", border: "1px dashed #E5E7EB", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#9CA3AF" }}>No {meta.label.toLowerCase()} members</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              userLabel={usersById.get(m.userId) ?? m.userId}
              onEdit={() => onEdit(m)}
              onRemove={() => onRemove(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function CommercialManagement() {
  const [entities, setEntities]               = useState<CommercialEntity[]>([]);
  const [members, setMembers]                 = useState<CommercialEntityMember[]>([]);
  const [communityOptions, setCommunities]    = useState<OptionRow[]>([]);
  const [unitOptions, setUnits]               = useState<UnitOptionRow[]>([]);
  const [userOptions, setUsers]               = useState<OptionRow[]>([]);
  const [communityFilterId, setCF]            = useState("all");
  const [unitFilterId, setUF]                 = useState("all");
  const [includeInactive, setInactive]        = useState(false);
  const [search, setSearch]                   = useState("");
  const [selectedEntityId, setSelectedId]     = useState("");
  const [loading, setLoading]                 = useState(false);
  const [membersLoading, setMembersLoading]   = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [filtersOpen, setFiltersOpen]         = useState(false);

  const [entityDialogOpen, setEntityDialog]   = useState(false);
  const [editingEntityId, setEditingEid]      = useState<string | null>(null);
  const [entityForm, setEntityForm]           = useState<EntityFormState>(INIT_ENTITY);

  const [memberDialogOpen, setMemberDialog]   = useState(false);
  const [editingMemberId, setEditingMid]      = useState<string | null>(null);
  const [memberForm, setMemberForm]           = useState<MemberFormState>(INIT_MEMBER);

  // ── Derived maps ─────────────────────────────────────────────
  const usersById      = useMemo(() => { const m = new Map<string, string>(); userOptions.forEach((r) => m.set(r.id, r.label)); return m; }, [userOptions]);
  const communityById  = useMemo(() => { const m = new Map<string, string>(); communityOptions.forEach((r) => m.set(r.id, r.label)); return m; }, [communityOptions]);
  const unitById       = useMemo(() => { const m = new Map<string, string>(); unitOptions.forEach((r) => m.set(r.id, r.label)); return m; }, [unitOptions]);
  const selectedEntity = useMemo(() => entities.find((e) => e.id === selectedEntityId) ?? null, [entities, selectedEntityId]);

  const filteredEntities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter((e) => {
      const owner = e.owner?.userId ? usersById.get(e.owner.userId) ?? "" : "";
      return [e.name, e.description ?? "", communityById.get(e.communityId) ?? "", unitById.get(e.unitId) ?? "", owner].join(" ").toLowerCase().includes(q);
    });
  }, [communityById, entities, search, unitById, usersById]);

  const ownerMembers = useMemo(() => members.filter((m) => m.role === "OWNER"), [members]);
  const hrMembers    = useMemo(() => members.filter((m) => m.role === "HR"),    [members]);
  const staffMembers = useMemo(() => members.filter((m) => m.role === "STAFF"), [members]);

  const availableUnits = useMemo(() => {
    if (!entityForm.communityId) return unitOptions;
    return unitOptions.filter((u) => u.communityId === entityForm.communityId);
  }, [entityForm.communityId, unitOptions]);

  const activeFilters = [communityFilterId !== "all", unitFilterId !== "all", includeInactive].filter(Boolean).length;

  const stats = useMemo(() => ({
    total:   entities.length,
    active:  entities.filter((e) => e.isActive).length,
    members: selectedEntity?.memberCount ?? 0,
  }), [entities, selectedEntity]);

  // ── Loaders ──────────────────────────────────────────────────
  const loadOptions = useCallback(async () => {
    const [c, u, us] = await Promise.all([commercialService.listCommunityOptions(), commercialService.listUnitOptions(), commercialService.listUserOptions()]);
    setCommunities(c); setUnits(u); setUsers(us);
  }, []);

  const loadEntities = useCallback(async (opts?: { preserve?: boolean }) => {
    setLoading(true);
    try {
      const rows = await commercialService.listEntities({ communityId: communityFilterId !== "all" ? communityFilterId : undefined, unitId: unitFilterId !== "all" ? unitFilterId : undefined, includeInactive });
      setEntities(rows);
      if (!rows.length) { setSelectedId(""); return; }
      if (opts?.preserve && rows.some((r) => r.id === selectedEntityId)) return;
      setSelectedId(rows[0].id);
    } catch (e) { toast.error("Failed to load entities", { description: errorMessage(e) }); }
    finally { setLoading(false); }
  }, [communityFilterId, includeInactive, selectedEntityId, unitFilterId]);

  const loadMembers = useCallback(async (id: string) => {
    if (!id) { setMembers([]); return; }
    setMembersLoading(true);
    try { setMembers(await commercialService.listMembers(id)); }
    catch (e) { toast.error("Failed to load members", { description: errorMessage(e) }); }
    finally { setMembersLoading(false); }
  }, []);

  useEffect(() => { void loadOptions().then(() => loadEntities()); }, []);  // eslint-disable-line
  useEffect(() => { void loadEntities({ preserve: true }); }, [communityFilterId, unitFilterId, includeInactive]); // eslint-disable-line
  useEffect(() => { void loadMembers(selectedEntityId); }, [loadMembers, selectedEntityId]);

  // ── Entity CRUD ──────────────────────────────────────────────
  const openCreateEntity = () => { setEditingEid(null); setEntityForm(INIT_ENTITY); setEntityDialog(true); };
  const openEditEntity = (e: CommercialEntity) => { setEditingEid(e.id); setEntityForm({ name: e.name, description: e.description ?? "", communityId: e.communityId, unitId: e.unitId, ownerUserId: e.owner?.userId ?? "" }); setEntityDialog(true); };

  const saveEntity = async () => {
    if (!entityForm.name.trim() || !entityForm.communityId || !entityForm.unitId) { toast.error("Name, community, and unit are required"); return; }
    if (!editingEntityId && !entityForm.ownerUserId) { toast.error("Owner user is required for new entities"); return; }
    setSaving(true);
    try {
      if (editingEntityId) {
        await commercialService.updateEntity(editingEntityId, { name: entityForm.name.trim(), description: entityForm.description.trim() || undefined, communityId: entityForm.communityId, unitId: entityForm.unitId });
        toast.success("Entity updated");
      } else {
        const created = await commercialService.createEntity({ name: entityForm.name.trim(), description: entityForm.description.trim() || undefined, communityId: entityForm.communityId, unitId: entityForm.unitId, ownerUserId: entityForm.ownerUserId });
        setSelectedId(created.id);
        toast.success("Entity created");
      }
      setEntityDialog(false);
      await loadEntities({ preserve: true });
      await loadMembers(selectedEntityId);
    } catch (e) { toast.error("Failed to save entity", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const removeEntity = async (e: CommercialEntity) => {
    if (!window.confirm(`Archive entity "${e.name}"?`)) return;
    try { await commercialService.removeEntity(e.id); toast.success("Entity archived"); await loadEntities(); setMembers([]); }
    catch (err) { toast.error("Failed to archive", { description: errorMessage(err) }); }
  };

  // ── Member CRUD ──────────────────────────────────────────────
  const openAddMember = (role: CommercialMemberRole) => {
    if (!selectedEntityId) { toast.error("Select an entity first"); return; }
    setEditingMid(null);
    setMemberForm({ userId: "", role, isActive: true, permissions: memberDefaultPermissions(role) });
    setMemberDialog(true);
  };

  const openEditMember = (m: CommercialEntityMember) => {
    setEditingMid(m.id);
    setMemberForm({ userId: m.userId, role: m.role, isActive: m.isActive, permissions: { ...m.permissions } });
    setMemberDialog(true);
  };

  const setMemberRole = (role: CommercialMemberRole) => setMemberForm((p) => ({ ...p, role, permissions: memberDefaultPermissions(role) }));
  const togglePermission = (key: keyof CommercialMemberPermissions) => setMemberForm((p) => p.role !== "STAFF" ? p : { ...p, permissions: { ...p.permissions, [key]: !p.permissions[key] } });

  const saveMember = async () => {
    if (!memberForm.userId && !editingMemberId) { toast.error("Select a user"); return; }
    const perms = memberForm.role === "STAFF" ? memberForm.permissions : memberDefaultPermissions(memberForm.role);
    setSaving(true);
    try {
      if (editingMemberId) {
        await commercialService.updateMember(editingMemberId, { role: memberForm.role, isActive: memberForm.isActive, permissions: perms });
        toast.success("Member updated");
      } else {
        if (!selectedEntityId) { toast.error("Select an entity first"); return; }
        await commercialService.addMember(selectedEntityId, { userId: memberForm.userId, role: memberForm.role, permissions: perms });
        toast.success("Member added");
      }
      setMemberDialog(false);
      await loadMembers(selectedEntityId);
      await loadEntities({ preserve: true });
    } catch (e) { toast.error("Failed to save member", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const removeMember = async (m: CommercialEntityMember) => {
    const label = usersById.get(m.userId) ?? m.userId;
    if (!window.confirm(`Archive member "${label}"?`)) return;
    try { await commercialService.removeMember(m.id); toast.success("Member archived"); await loadMembers(selectedEntityId); await loadEntities({ preserve: true }); }
    catch (e) { toast.error("Failed to archive member", { description: errorMessage(e) }); }
  };

  // ── Table columns ────────────────────────────────────────────
  const columns: DataTableColumn<CommercialEntity>[] = [
    {
      key: "entity", header: "Entity",
      render: (e) => (
        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: e.isActive ? "#EFF6FF" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 style={{ width: "14px", height: "14px", color: e.isActive ? "#2563EB" : "#9CA3AF" }} />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{e.name}</p>
            {e.description && <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }}>{e.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "location", header: "Community / Unit",
      render: (e) => (
        <div>
          <p style={{ fontSize: "12.5px", fontWeight: 600, color: "#374151" }}>{communityById.get(e.communityId) ?? "—"}</p>
          <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "1px", fontFamily: "'DM Mono', monospace" }}>{unitById.get(e.unitId) ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "owner", header: "Owner",
      render: (e) => e.owner ? (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, color: "#FFF", flexShrink: 0 }}>
            {(usersById.get(e.owner.userId) ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontSize: "12.5px", color: "#374151" }}>{usersById.get(e.owner.userId) ?? "—"}</span>
        </div>
      ) : <span style={{ color: "#D1D5DB", fontSize: "12px" }}>No owner</span>,
    },
    {
      key: "members", header: "Members",
      render: (e) => (
        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827", fontFamily: "'DM Mono', monospace" }}>
          {e.memberCount ?? 0}
        </span>
      ),
    },
    {
      key: "status", header: "Status",
      render: (e) => <StatusBadge value={e.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "actions", header: "",
      render: (e) => (
        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
          <IconBtn icon={<Pencil style={{ width: "11px", height: "11px" }} />} onClick={(ev) => { ev.stopPropagation(); openEditEntity(e); }} title="Edit entity" />
          <IconBtn icon={<Trash2 style={{ width: "11px", height: "11px" }} />} onClick={(ev) => { ev.stopPropagation(); void removeEntity(e); }} danger title="Archive entity" />
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
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Entities and member hierarchy — Owner · HR · Staff</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <OutlineBtn label="Refresh" icon={<RefreshCw style={{ width: "12px", height: "12px" }} />} onClick={() => void loadOptions().then(() => loadEntities())} />
          <PrimaryBtn label="Create Entity" icon={<Plus style={{ width: "13px", height: "13px" }} />} onClick={openCreateEntity} />
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatCard label="Total Entities"         value={stats.total}   accent={ACCENTS[1]} icon={<Building2 style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Active Entities"        value={stats.active}  accent={ACCENTS[0]} icon={<ShieldCheck style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Members (selected)"     value={stats.members} accent={ACCENTS[2]} icon={<Users style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Hierarchy"              value="Owner · HR · Staff" accent="#6B7280" icon={<Crown style={{ width: "16px", height: "16px" }} />} />
      </div>

      {/* ── Search + filter bar ────────────────────────────── */}
      <div style={{ background: "#FFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "16px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "10px", padding: "12px 14px", borderBottom: filtersOpen ? "1px solid #F3F4F6" : "none" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
            <input placeholder="Search by name, owner, unit…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }} />
          </div>
          <button type="button" onClick={() => setFiltersOpen((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "7px", border: `1px solid ${activeFilters > 0 ? "#2563EB40" : "#E5E7EB"}`, background: activeFilters > 0 ? "#EFF6FF" : "#FAFAFA", color: activeFilters > 0 ? "#2563EB" : "#6B7280", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", transition: "all 120ms ease", flexShrink: 0 }}>
            <SlidersHorizontal style={{ width: "13px", height: "13px" }} />
            Filters
            {activeFilters > 0 && <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#2563EB", color: "#FFF", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>{activeFilters}</span>}
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Community</label>
              <select value={communityFilterId} onChange={(e) => setCF(e.target.value)} style={selectStyle}>
                <option value="all">All communities</option>
                {communityOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Unit</label>
              <select value={unitFilterId} onChange={(e) => setUF(e.target.value)} style={selectStyle}>
                <option value="all">All units</option>
                {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12.5px", color: "#374151", cursor: "pointer", gridColumn: "span 2" }}>
              <input type="checkbox" checked={includeInactive} onChange={(e) => setInactive(e.target.checked)} style={{ accentColor: "#2563EB" }} />
              Include inactive entities
            </label>
          </div>
        )}
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>

        {/* ══ LEFT: Entity table ════════════════════════════ */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "8px" }}>
            <Building2 style={{ width: "14px", height: "14px", color: "#2563EB" }} />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Entities</span>
            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: "#EFF6FF", color: "#2563EB", fontFamily: "'DM Mono', monospace" }}>{filteredEntities.length}</span>
          </div>
          <DataTable
            columns={columns}
            rows={filteredEntities}
            rowKey={(e) => e.id}
            loading={loading}
            emptyTitle="No commercial entities found"
            emptyDescription="Create your first entity to get started."
            rowClassName={(e) => selectedEntityId === e.id ? "cm-row-sel cm-row" : "cm-row"}
            onRowClick={(e) => setSelectedId(e.id)}
          />
        </div>

        {/* ══ RIGHT: Hierarchy panel ════════════════════════ */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden", position: "sticky", top: "16px" }}>

          {/* Panel header */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
            {selectedEntity ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Building2 style={{ width: "13px", height: "13px", color: "#2563EB" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13.5px", fontWeight: 700, color: "#111827", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedEntity.name}</p>
                    <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px" }}>{communityById.get(selectedEntity.communityId) ?? "—"} · {unitById.get(selectedEntity.unitId) ?? "—"}</p>
                  </div>
                  <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                    <StatusBadge value={selectedEntity.isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>
                </div>
                {selectedEntity.description && (
                  <p style={{ fontSize: "11.5px", color: "#6B7280", marginTop: "8px", lineHeight: 1.5 }}>{selectedEntity.description}</p>
                )}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>Hierarchy View</p>
                <p style={{ fontSize: "11.5px", color: "#9CA3AF", marginTop: "2px" }}>Select an entity from the table</p>
              </div>
            )}
          </div>

          {/* Hierarchy body */}
          {!selectedEntity ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <Users style={{ width: "18px", height: "18px", color: "#D1D5DB" }} />
              </div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#6B7280" }}>No entity selected</p>
              <p style={{ marginTop: "4px", fontSize: "11.5px", color: "#9CA3AF", lineHeight: 1.5 }}>Click a row in the table to view its member hierarchy.</p>
            </div>
          ) : membersLoading ? (
            <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: "48px", borderRadius: "8px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
              ))}
            </div>
          ) : (
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <RoleSection role="OWNER"  members={ownerMembers} usersById={usersById} onEdit={openEditMember} onRemove={(m) => void removeMember(m)} onAdd={() => openAddMember("OWNER")} />
              <RoleSection role="HR"     members={hrMembers}    usersById={usersById} onEdit={openEditMember} onRemove={(m) => void removeMember(m)} onAdd={() => openAddMember("HR")} />
              <RoleSection role="STAFF"  members={staffMembers} usersById={usersById} onEdit={openEditMember} onRemove={(m) => void removeMember(m)} onAdd={() => openAddMember("STAFF")} />
            </div>
          )}
        </div>
      </div>

      {/* ══ DIALOGS ══════════════════════════════════════════ */}

      {/* Entity dialog */}
      <Dialog open={entityDialogOpen} onOpenChange={setEntityDialog}>
        <DialogContent style={{ maxWidth: "520px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>{editingEntityId ? "Edit Entity" : "Create Entity"}</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>A commercial entity is linked to one community and one unit.</DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <Field label="Entity Name"><input value={entityForm.name} onChange={(e) => setEntityForm((p) => ({ ...p, name: e.target.value }))} placeholder="Downtown Pharmacy" style={inputStyle} /></Field>
            <Field label="Description" hint="Optional — shown in the hierarchy panel."><textarea value={entityForm.description} onChange={(e) => setEntityForm((p) => ({ ...p, description: e.target.value }))} placeholder="24/7 medical and healthcare retail" style={textareaStyle} /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Community">
                <select value={entityForm.communityId || ""} style={selectStyle} onChange={(e) => setEntityForm((p) => ({ ...p, communityId: e.target.value, unitId: "" }))}>
                  <option value="">Select community</option>
                  {communityOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </Field>
              <Field label="Unit">
                <select value={entityForm.unitId || ""} style={{ ...selectStyle, opacity: !entityForm.communityId ? 0.6 : 1 }} disabled={!entityForm.communityId} onChange={(e) => setEntityForm((p) => ({ ...p, unitId: e.target.value }))}>
                  <option value="">Select unit</option>
                  {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </Field>
            </div>
            {!editingEntityId && (
              <Field label="Owner User" hint="The commercial owner member — assigned permanently.">
                <select value={entityForm.ownerUserId || ""} style={selectStyle} onChange={(e) => setEntityForm((p) => ({ ...p, ownerUserId: e.target.value }))}>
                  <option value="">Select owner user</option>
                  {userOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </Field>
            )}
            {editingEntityId && <p style={{ fontSize: "11.5px", color: "#9CA3AF" }}>Owner is managed via the hierarchy panel member assignments.</p>}
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setEntityDialog(false)} />
            <PrimaryBtn label="Save Entity" onClick={() => void saveEntity()} loading={saving} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Member dialog */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialog}>
        <DialogContent style={{ maxWidth: "520px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>{editingMemberId ? "Edit Member" : "Add Member"}</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Assign role and permissions for this entity member.</DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="User">
                <select value={memberForm.userId || ""} disabled={Boolean(editingMemberId)} style={{ ...selectStyle, opacity: editingMemberId ? 0.6 : 1 }} onChange={(e) => setMemberForm((p) => ({ ...p, userId: e.target.value }))}>
                  <option value="">Select user</option>
                  {userOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </Field>
              <Field label="Role">
                <select value={memberForm.role} style={selectStyle} onChange={(e) => setMemberRole(e.target.value as CommercialMemberRole)}>
                  {COMMERCIAL_MEMBER_ROLES.map((r) => <option key={r} value={r}>{humanizeEnum(r)}</option>)}
                </select>
              </Field>
            </div>

            {editingMemberId && (
              <Field label="Status">
                <select value={memberForm.isActive ? "active" : "inactive"} style={selectStyle} onChange={(e) => setMemberForm((p) => ({ ...p, isActive: e.target.value === "active" }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}

            {/* Permission grid */}
            <Field label="Permissions" hint={memberForm.role !== "STAFF" ? "Owner and HR receive all permissions automatically." : "Select which actions this staff member can perform."}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "2px" }}>
                {COMMERCIAL_PERMISSION_KEYS.map((key, ki) => {
                  const checked = memberForm.permissions[key];
                  const disabled = memberForm.role !== "STAFF";
                  const accent = accentFor(ki);
                  return (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 10px", border: `1px solid ${checked ? accent + "40" : "#E5E7EB"}`, borderRadius: "7px", cursor: disabled ? "default" : "pointer", background: checked ? `${accent}08` : "#FAFAFA", opacity: disabled ? 0.7 : 1, transition: "all 120ms ease", fontSize: "12px", fontWeight: checked ? 600 : 400, color: checked ? "#111827" : "#6B7280" }}>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePermission(key)} style={{ accentColor: accent }} />
                      {PERMISSION_LABELS[key]}
                    </label>
                  );
                })}
              </div>
            </Field>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setMemberDialog(false)} />
            <PrimaryBtn label="Save Member" onClick={() => void saveMember()} loading={saving} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}