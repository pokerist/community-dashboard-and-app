import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Pencil, Archive, User, Phone, Fingerprint,
  Briefcase, Calendar, Shield, DoorOpen, Activity, ChevronDown,
  SlidersHorizontal, Search, CheckCircle2, FileUp, X, Check, Clock,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { StatusBadge } from "../StatusBadge";
import {
  COMPOUND_STAFF_PERMISSIONS,
  WEEK_DAYS,
  CompoundStaff,
  CompoundStaffPermission,
  CompoundStaffStatus,
  CreateCompoundStaffPayload,
  UpdateCompoundStaffPayload,
  default as compoundStaffService,
} from "../../lib/compound-staff-service";
import type { BlueCollarWeekDay, CompoundStaffScheduleInput } from "../../lib/compound-staff-service";
import { errorMessage, formatDateTime, humanizeEnum } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type ScheduleDayForm = { enabled: boolean; startTime: string; endTime: string; notes: string };

type StaffFormState = {
  communityId: string; commercialEntityId: string; userId: string;
  fullName: string; phone: string; nationalId: string; photoFileId: string;
  profession: string; jobTitle: string; contractFrom: string; contractTo: string;
  schedules: Record<BlueCollarWeekDay, ScheduleDayForm>; status: CompoundStaffStatus;
  permissions: CompoundStaffPermission[]; gateIds: string[];
};

const EMPTY_DAY: ScheduleDayForm = { enabled: false, startTime: "", endTime: "", notes: "" };
const INIT_SCHEDULES: Record<BlueCollarWeekDay, ScheduleDayForm> = Object.fromEntries(WEEK_DAYS.map((d) => [d, { ...EMPTY_DAY }])) as Record<BlueCollarWeekDay, ScheduleDayForm>;

const INIT: StaffFormState = {
  communityId: "", commercialEntityId: "", userId: "", fullName: "", phone: "",
  nationalId: "", photoFileId: "", profession: "", jobTitle: "", contractFrom: "",
  contractTo: "", schedules: { ...INIT_SCHEDULES }, status: "ACTIVE", permissions: [], gateIds: [],
};

const DAY_LABELS: Record<BlueCollarWeekDay, string> = {
  SUNDAY: "Sunday", MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday",
};

// ─── Helpers ──────────────────────────────────────────────────

function toDateInput(v?: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

const STATUS_ACCENT: Record<CompoundStaffStatus, string> = {
  ACTIVE: "#059669", INACTIVE: "#9CA3AF", SUSPENDED: "#DC2626",
};

// ─── Design tokens ────────────────────────────────────────────

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const timeInputStyle: React.CSSProperties = { ...inputStyle, width: "100px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: "12px" };

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, required, hint, span2 = false, children }: { label: string; required?: boolean; hint?: string; span2?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: span2 ? "span 2" : undefined }}>
      <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: "3px" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: "10.5px", color: "#9CA3AF", margin: "-2px 0 2px" }}>{hint}</p>}
      {children}
    </div>
  );
}

function FileField({ label, hint, uploading, uploaded, fileName, accept, onChange }: { label: string; hint?: string; uploading: boolean; uploaded: boolean; fileName?: string; accept: string; onChange: (f: File | null) => void }) {
  return (
    <Field label={label} hint={hint}>
      <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "7px", border: `1px dashed ${uploaded ? "#10B981" : "#D1D5DB"}`, background: uploaded ? "#ECFDF5" : "#FAFAFA", cursor: uploading ? "not-allowed" : "pointer", fontSize: "12px", color: uploaded ? "#065F46" : "#6B7280", transition: "all 120ms ease" }}>
        {uploading ? <RefreshCw style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} /> : uploaded ? <CheckCircle2 style={{ width: "12px", height: "12px" }} /> : <FileUp style={{ width: "12px", height: "12px" }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploading ? "Uploading…" : uploaded ? (fileName || "Uploaded") : `Upload ${label}`}</span>
        <input type="file" accept={accept} style={{ display: "none" }} disabled={uploading} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
    </Field>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ color: "#9CA3AF" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

// ─── Staff row card ───────────────────────────────────────────

function StaffRow({ row, selected, onSelect, onEdit, onArchive }: { row: CompoundStaff; selected: boolean; onSelect: () => void; onEdit: () => void; onArchive: () => void }) {
  const accent = STATUS_ACCENT[row.status] ?? "#9CA3AF";
  const initials = row.fullName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  return (
    <button type="button" onClick={onSelect}
      style={{ width: "100%", textAlign: "left", padding: "11px 13px", borderRadius: "8px", border: `1px solid ${selected ? "#2563EB40" : "#EBEBEB"}`, background: selected ? "#EFF6FF" : "#FFF", boxShadow: selected ? "0 0 0 2px #2563EB25" : "none", cursor: "pointer", transition: "all 120ms ease", display: "flex", alignItems: "center", gap: "10px", fontFamily: "'Work Sans', sans-serif" }}>
      {/* Avatar */}
      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: selected ? "#2563EB18" : "#F3F4F6", border: `1.5px solid ${selected ? "#2563EB40" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "11px", fontWeight: 800, color: selected ? "#2563EB" : "#6B7280" }}>{initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.fullName}</p>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent, flexShrink: 0 }} />
        </div>
        <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: 0 }}>{row.profession}{row.jobTitle ? ` · ${row.jobTitle}` : ""}</p>
      </div>
      {/* Actions */}
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onEdit}
          style={{ width: "26px", height: "26px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280", transition: "all 120ms ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#111827"; e.currentTarget.style.color = "#FFF"; e.currentTarget.style.borderColor = "#111827"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
          <Pencil style={{ width: "10px", height: "10px" }} />
        </button>
        <button type="button" onClick={onArchive}
          style={{ width: "26px", height: "26px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#DC2626", transition: "all 120ms ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#DC2626"; e.currentTarget.style.color = "#FFF"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#DC2626"; }}>
          <Archive style={{ width: "10px", height: "10px" }} />
        </button>
      </div>
    </button>
  );
}

// ─── Detail panel ─────────────────────────────────────────────

function DetailPanel({ selected }: { selected: CompoundStaff | null }) {
  if (!selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "8px" }}>
        <User style={{ width: "28px", height: "28px", color: "#E5E7EB" }} />
        <p style={{ fontSize: "13px", color: "#9CA3AF", fontFamily: "'Work Sans', sans-serif" }}>Select a staff member to view details</p>
      </div>
    );
  }

  const accent = STATUS_ACCENT[selected.status] ?? "#9CA3AF";
  const initials = selected.fullName.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontFamily: "'Work Sans', sans-serif" }}>
      {/* Profile card */}
      <div style={{ borderRadius: "9px", border: "1px solid #EBEBEB", overflow: "hidden" }}>
        <div style={{ height: "3px", background: `linear-gradient(90deg, ${accent}, ${accent}55)` }} />
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: `${accent}15`, border: `1.5px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: accent }}>{initials}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "14.5px", fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>{selected.fullName}</p>
            <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "3px 0 0" }}>{selected.profession}{selected.jobTitle ? ` · ${selected.jobTitle}` : ""}</p>
          </div>
          <StatusBadge value={selected.status} />
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #F3F4F6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Phone style={{ width: "11px", height: "11px", color: "#D1D5DB", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#374151", fontFamily: "'DM Mono', monospace" }}>{selected.phone}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Fingerprint style={{ width: "11px", height: "11px", color: "#D1D5DB", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#374151", fontFamily: "'DM Mono', monospace" }}>{selected.nationalId}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", gridColumn: "span 2" }}>
            <Clock style={{ width: "11px", height: "11px", color: "#D1D5DB", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Updated {formatDateTime(selected.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Gate access */}
      <div style={{ borderRadius: "9px", border: "1px solid #EBEBEB", overflow: "hidden" }}>
        <div style={{ padding: "9px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
          <DoorOpen style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Gate Access</span>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "#F3F4F6", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{selected.gateAccesses.length}</span>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "5px" }}>
          {selected.gateAccesses.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#D1D5DB" }}>No gates assigned</p>
          ) : selected.gateAccesses.map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "5px 8px", borderRadius: "6px", background: "#F9FAFB" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#059669", flexShrink: 0 }} />
              <span style={{ fontSize: "12.5px", color: "#374151" }}>{g.gateName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <div style={{ borderRadius: "9px", border: "1px solid #EBEBEB", overflow: "hidden" }}>
        <div style={{ padding: "9px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
          <Activity style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Activity Log</span>
        </div>
        <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {selected.activityLogs.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#D1D5DB", padding: "4px 0" }}>No activity recorded</p>
          ) : selected.activityLogs.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 0", borderBottom: "1px solid #F9FAFB" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#D1D5DB", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "#374151", flex: 1 }}>{humanizeEnum(a.action)}</span>
              <span style={{ fontSize: "11px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{formatDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Permission/Gate checkbox ─────────────────────────────────

function CheckItem({ label, checked, disabled, accent = "#2563EB", onChange }: { label: string; checked: boolean; disabled?: boolean; accent?: string; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "7px", border: `1px solid ${checked ? accent + "30" : "#E5E7EB"}`, background: checked ? `${accent}08` : "#FAFAFA", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 120ms ease" }}>
      <div style={{ width: "14px", height: "14px", borderRadius: "4px", border: `1.5px solid ${checked ? accent : "#D1D5DB"}`, background: checked ? accent : "#FFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 120ms ease" }}>
        {checked && <Check style={{ width: "9px", height: "9px", color: "#FFF" }} />}
      </div>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ display: "none" }} />
      <span style={{ fontSize: "12px", fontWeight: checked ? 600 : 400, color: checked ? accent : "#374151", fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────

export function CompoundStaffManagement() {
  const [rows,      setRows]      = useState<CompoundStaff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected,  setSelected]  = useState<CompoundStaff | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form,      setForm]      = useState<StaffFormState>(INIT);

  const [photoUploading,        setPhotoUploading]        = useState(false);
  const [natIdDocUploading,     setNatIdDocUploading]     = useState(false);
  const [natIdDocFileId,        setNatIdDocFileId]        = useState("");
  const [natIdDocFileName,      setNatIdDocFileName]      = useState("");

  const [statusFilter,    setStatusFilter]    = useState("all");
  const [professionFilter,setProfessionFilter]= useState("");
  const [expiringOnly,    setExpiringOnly]    = useState(false);
  const [filtersOpen,     setFiltersOpen]     = useState(false);

  const [communityOptions, setCommunityOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [entityOptions,    setEntityOptions]    = useState<Array<{ id: string; label: string; communityId: string }>>([]);
  const [userOptions,      setUserOptions]      = useState<Array<{ id: string; label: string }>>([]);
  const [gateOptions,      setGateOptions]      = useState<Array<{ id: string; label: string; communityId: string }>>([]);

  const filteredEntities = useMemo(() => entityOptions.filter((it) => it.communityId === form.communityId), [entityOptions, form.communityId]);
  const filteredGates    = useMemo(() => gateOptions.filter((it) => it.communityId === form.communityId),    [gateOptions,    form.communityId]);

  const loadOptions = useCallback(async () => {
    const [communities, entities, users, gates] = await Promise.all([
      compoundStaffService.listCommunityOptions(),
      compoundStaffService.listCommercialEntityOptions(),
      compoundStaffService.listUserOptions(),
      compoundStaffService.listGateOptions(),
    ]);
    setCommunityOptions(communities); setEntityOptions(entities); setUserOptions(users); setGateOptions(gates);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const staff = await compoundStaffService.list({ status: statusFilter === "all" ? undefined : (statusFilter as CompoundStaffStatus), profession: professionFilter || undefined, contractExpiringSoon: expiringOnly || undefined });
      setRows(staff);
      if (staff.length > 0) setSelectedId((id) => id ?? staff[0].id);
      if (staff.length === 0) { setSelectedId(null); setSelected(null); }
    } catch (e) { toast.error("Failed to load staff", { description: errorMessage(e) }); }
    finally { setLoading(false); }
  }, [expiringOnly, professionFilter, statusFilter]);

  useEffect(() => { void Promise.all([loadOptions(), loadRows()]); }, [loadOptions, loadRows]);
  useEffect(() => {
    if (!selectedId) return;
    void compoundStaffService.getById(selectedId).then(setSelected).catch((e) => toast.error("Failed to load detail", { description: errorMessage(e) }));
  }, [selectedId]);

  const openCreate = () => { setEditingId(null); setForm(INIT); setNatIdDocFileId(""); setNatIdDocFileName(""); setDialogOpen(true); };
  const openEdit   = (row: CompoundStaff) => {
    setEditingId(row.id);
    const schedMap = { ...INIT_SCHEDULES };
    (row.schedules ?? []).forEach((s) => { schedMap[s.dayOfWeek] = { enabled: s.isActive, startTime: s.startTime ?? "", endTime: s.endTime ?? "", notes: s.notes ?? "" }; });
    setForm({ communityId: row.communityId ?? "", commercialEntityId: row.commercialEntityId ?? "", userId: row.userId ?? "", fullName: row.fullName, phone: row.phone, nationalId: row.nationalId, photoFileId: row.photoFileId ?? "", profession: row.profession, jobTitle: row.jobTitle ?? "", contractFrom: toDateInput(row.contractFrom), contractTo: toDateInput(row.contractTo), schedules: schedMap, status: row.status, permissions: row.accesses.map((a) => a.permission), gateIds: row.gateAccesses.map((g) => g.gateId) });
    setNatIdDocFileId(""); setNatIdDocFileName(""); setDialogOpen(true);
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    try { const u = await compoundStaffService.uploadProfilePhoto(file); setForm((p) => ({ ...p, photoFileId: u.id })); toast.success("Profile photo uploaded"); }
    catch (e) { toast.error("Failed to upload photo", { description: errorMessage(e) }); }
    finally { setPhotoUploading(false); }
  };

  const handleNatIdUpload = async (file: File | null) => {
    if (!file) return;
    setNatIdDocUploading(true);
    try { const u = await compoundStaffService.uploadNationalId(file); setNatIdDocFileId(u.id); setNatIdDocFileName(u.name); toast.success("National ID uploaded"); }
    catch (e) { toast.error("Failed to upload National ID", { description: errorMessage(e) }); }
    finally { setNatIdDocUploading(false); }
  };

  const save = async () => {
    if (!form.communityId || !form.fullName.trim() || !form.phone.trim() || !form.nationalId.trim() || !form.profession.trim()) { toast.error("Fill all required fields"); return; }
    // Validate schedule times
    for (const day of WEEK_DAYS) {
      const d = form.schedules[day];
      if (d.enabled && (!d.startTime || !d.endTime)) { toast.error(`${DAY_LABELS[day]}: Start and end time are required when the day is enabled`); return; }
    }
    setSaving(true);
    try {
      const gateAccesses = form.gateIds.map((gateId) => ({ gateId, directions: ["ENTRY", "EXIT"] as Array<"ENTRY"|"EXIT"> }));
      const schedules: CompoundStaffScheduleInput[] = WEEK_DAYS.map((day) => {
        const d = form.schedules[day];
        return { dayOfWeek: day, startTime: d.startTime || undefined, endTime: d.endTime || undefined, notes: d.notes || undefined, isActive: d.enabled };
      });
      if (editingId) {
        const payload: UpdateCompoundStaffPayload = { communityId: form.communityId, commercialEntityId: form.commercialEntityId || null, userId: form.userId || null, fullName: form.fullName.trim(), phone: form.phone.trim(), nationalId: form.nationalId.trim(), photoFileId: form.photoFileId || null, profession: form.profession.trim(), jobTitle: form.jobTitle || null, schedules, contractFrom: form.contractFrom ? `${form.contractFrom}T00:00:00.000Z` : null, contractTo: form.contractTo ? `${form.contractTo}T00:00:00.000Z` : null, status: form.status, gateAccesses: form.status === "ACTIVE" ? gateAccesses : [] };
        await compoundStaffService.update(editingId, payload);
        await compoundStaffService.setAccess(editingId, { permissions: form.status === "ACTIVE" ? form.permissions : [] });
      } else {
        const payload: CreateCompoundStaffPayload = { communityId: form.communityId, commercialEntityId: form.commercialEntityId || undefined, userId: form.userId || undefined, fullName: form.fullName.trim(), phone: form.phone.trim(), nationalId: form.nationalId.trim(), photoFileId: form.photoFileId || undefined, profession: form.profession.trim(), jobTitle: form.jobTitle || undefined, schedules, contractFrom: form.contractFrom ? `${form.contractFrom}T00:00:00.000Z` : undefined, contractTo: form.contractTo ? `${form.contractTo}T00:00:00.000Z` : undefined, status: form.status, permissions: form.status === "ACTIVE" ? form.permissions : [], gateAccesses: form.status === "ACTIVE" ? gateAccesses : [] };
        await compoundStaffService.create(payload);
      }
      setDialogOpen(false); await loadRows(); toast.success("Staff saved");
    } catch (e) { toast.error("Failed to save staff", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const activeFilters = [statusFilter !== "all", professionFilter, expiringOnly].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Compound Staff</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Manage compound staff, access permissions, and gate assignments.</p>
        </div>
        <button type="button" onClick={openCreate}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "#111827", color: "#FFF", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
          <Plus style={{ width: "13px", height: "13px" }} /> Add Staff
        </button>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: filtersOpen ? "1px solid #F3F4F6" : "none" }}>
          <Search style={{ width: "13px", height: "13px", color: "#9CA3AF", flexShrink: 0 }} />
          <input placeholder="Search by profession…" value={professionFilter} onChange={(e) => setProfessionFilter(e.target.value)} style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "13px", color: "#111827", fontFamily: "'Work Sans', sans-serif" }} />
          <button type="button" onClick={() => void loadRows()}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FAFAFA", color: "#6B7280", cursor: "pointer", fontSize: "11.5px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
            <RefreshCw style={{ width: "10px", height: "10px" }} />
          </button>
          <button type="button" onClick={() => setFiltersOpen((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${activeFilters > 0 ? "#2563EB40" : "#E5E7EB"}`, background: activeFilters > 0 ? "#EFF6FF" : "#FAFAFA", color: activeFilters > 0 ? "#2563EB" : "#6B7280", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "'Work Sans', sans-serif" }}>
            <SlidersHorizontal style={{ width: "11px", height: "11px" }} />
            Filters
            {activeFilters > 0 && <span style={{ width: "15px", height: "15px", borderRadius: "50%", background: "#2563EB", color: "#FFF", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeFilters}</span>}
            <ChevronDown style={{ width: "10px", height: "10px", transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, width: "140px" }}>
              <option value="all">All Statuses</option>
              {(["ACTIVE","INACTIVE","SUSPENDED"] as CompoundStaffStatus[]).map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
            </select>
            <CheckItem label="Expiring Soon" checked={expiringOnly} onChange={() => setExpiringOnly((p) => !p)} accent="#D97706" />
          </div>
        )}
      </div>

      {/* ── Two-column layout ───────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "14px", alignItems: "start" }}>
        {/* Staff list */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>Staff Members</span>
            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#F3F4F6", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{rows.length}</span>
          </div>
          <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "600px", overflowY: "auto" }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: "58px", borderRadius: "8px", background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s infinite" }} />
              ))
            ) : rows.length === 0 ? (
              <p style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: "#9CA3AF" }}>No staff found.</p>
            ) : rows.map((row) => (
              <StaffRow key={row.id} row={row} selected={selectedId === row.id}
                onSelect={() => setSelectedId(row.id)}
                onEdit={() => openEdit(row)}
                onArchive={() => compoundStaffService.remove(row.id).then(() => loadRows()).catch((e) => toast.error("Failed to archive", { description: errorMessage(e) }))}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", padding: "16px", overflow: "hidden" }}>
          <DetailPanel selected={selected} />
        </div>
      </div>

      {/* ══ Create/Edit dialog ════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: "640px", padding: 0, borderRadius: "12px", overflow: "hidden", border: "1px solid #EBEBEB", fontFamily: "'Work Sans', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "3px", background: editingId ? "linear-gradient(90deg, #2563EB, #0D9488)" : "linear-gradient(90deg, #0D9488, #BE185D)", flexShrink: 0 }} />
          <div style={{ padding: "18px 24px 10px", flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>
                {editingId ? "Edit Staff Member" : "Add Staff Member"}
              </DialogTitle>
              <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Fill in all required fields marked with *</p>
            </DialogHeader>
          </div>

          <div style={{ overflowY: "auto", padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* ── Identity ────────────────────────────────────── */}
            <div>
              <SectionLabel icon={<User style={{ width: "12px", height: "12px" }} />} label="Identity" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Full Name" required>
                  <input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Ahmed Hassan" style={inputStyle} />
                </Field>
                <Field label="Phone" required>
                  <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+2010xxxxxxxx" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
                </Field>
                <Field label="National ID" required>
                  <input value={form.nationalId} onChange={(e) => setForm((p) => ({ ...p, nationalId: e.target.value }))} placeholder="29800000000000" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CompoundStaffStatus }))} style={selectStyle}>
                    {(["ACTIVE","INACTIVE","SUSPENDED"] as CompoundStaffStatus[]).map((s) => <option key={s} value={s}>{humanizeEnum(s)}</option>)}
                  </select>
                </Field>
                <FileField label="National ID Doc" uploading={natIdDocUploading} uploaded={!!natIdDocFileId} fileName={natIdDocFileName} accept=".jpg,.jpeg,.png,.pdf" onChange={(f) => void handleNatIdUpload(f)} />
                <FileField label="Profile Photo" uploading={photoUploading} uploaded={!!form.photoFileId} fileName={form.photoFileId ? `ID: ${form.photoFileId.slice(0, 12)}…` : ""} accept=".jpg,.jpeg,.png" onChange={(f) => void handlePhotoUpload(f)} />
              </div>
            </div>

            {/* ── Assignment ──────────────────────────────────── */}
            <div>
              <SectionLabel icon={<Briefcase style={{ width: "12px", height: "12px" }} />} label="Assignment" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Community" required>
                  <select value={form.communityId || ""} onChange={(e) => setForm((p) => ({ ...p, communityId: e.target.value, commercialEntityId: "", gateIds: [] }))} style={selectStyle}>
                    <option value="">Select community</option>
                    {communityOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Commercial Entity">
                  <select value={form.commercialEntityId || ""} onChange={(e) => setForm((p) => ({ ...p, commercialEntityId: e.target.value }))} style={selectStyle}>
                    <option value="">None</option>
                    {filteredEntities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </Field>
                <Field label="Linked User">
                  <select value={form.userId || ""} onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))} style={selectStyle}>
                    <option value="">None</option>
                    {userOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </Field>
                <Field label="Profession" required>
                  <input value={form.profession} onChange={(e) => setForm((p) => ({ ...p, profession: e.target.value }))} placeholder="Security Guard" style={inputStyle} />
                </Field>
                <Field label="Job Title" span2>
                  <input value={form.jobTitle} onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))} placeholder="Senior Guard" style={inputStyle} />
                </Field>
              </div>
            </div>

            {/* ── Contract ────────────────────────────────────── */}
            <div>
              <SectionLabel icon={<Calendar style={{ width: "12px", height: "12px" }} />} label="Contract" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <Field label="Start Date">
                  <input type="date" value={form.contractFrom} onChange={(e) => setForm((p) => ({ ...p, contractFrom: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="End Date">
                  <input type="date" value={form.contractTo} onChange={(e) => setForm((p) => ({ ...p, contractTo: e.target.value }))} style={inputStyle} />
                </Field>
              </div>
            </div>

            {/* ── Weekly Schedule ──────────────────────────────── */}
            <div>
              <SectionLabel icon={<Clock style={{ width: "12px", height: "12px" }} />} label="Weekly Schedule" />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {WEEK_DAYS.map((day) => {
                  const d = form.schedules[day];
                  const updateDay = (patch: Partial<ScheduleDayForm>) => setForm((p) => ({ ...p, schedules: { ...p.schedules, [day]: { ...p.schedules[day], ...patch } } }));
                  return (
                    <div key={day} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 12px", borderRadius: "8px",
                      border: `1px solid ${d.enabled ? "#2563EB25" : "#F3F4F6"}`,
                      background: d.enabled ? "#F8FAFF" : "#FAFAFA",
                      transition: "all 120ms ease",
                    }}>
                      {/* Toggle */}
                      <button type="button" onClick={() => updateDay({ enabled: !d.enabled })}
                        style={{
                          width: "36px", height: "20px", borderRadius: "10px", border: "none", cursor: "pointer",
                          background: d.enabled ? "#2563EB" : "#D1D5DB", position: "relative", flexShrink: 0,
                          transition: "background 150ms ease",
                        }}>
                        <span style={{
                          position: "absolute", top: "2px", width: "16px", height: "16px", borderRadius: "50%",
                          background: "#FFF", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                          left: d.enabled ? "18px" : "2px", transition: "left 150ms ease",
                        }} />
                      </button>

                      {/* Day name */}
                      <span style={{
                        width: "80px", fontSize: "12.5px", fontWeight: d.enabled ? 700 : 500,
                        color: d.enabled ? "#111827" : "#9CA3AF", flexShrink: 0,
                      }}>
                        {DAY_LABELS[day]}
                      </span>

                      {d.enabled ? (
                        <>
                          {/* Start time */}
                          <input type="time" value={d.startTime} onChange={(e) => updateDay({ startTime: e.target.value })} style={timeInputStyle} />
                          <span style={{ fontSize: "11px", color: "#9CA3AF", flexShrink: 0 }}>to</span>
                          {/* End time */}
                          <input type="time" value={d.endTime} onChange={(e) => updateDay({ endTime: e.target.value })} style={timeInputStyle} />
                          {/* Notes */}
                          <input value={d.notes} onChange={(e) => updateDay({ notes: e.target.value })}
                            placeholder="Notes…" style={{ ...inputStyle, flex: 1, fontSize: "11.5px", height: "30px", minWidth: "80px" }} />
                        </>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>Day off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Permissions ─────────────────────────────────── */}
            <div>
              <SectionLabel icon={<Shield style={{ width: "12px", height: "12px" }} />} label={`Permissions ${form.status !== "ACTIVE" ? "(disabled when inactive)" : ""}`} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {COMPOUND_STAFF_PERMISSIONS.map((perm, i) => (
                  <CheckItem key={perm} label={humanizeEnum(perm)} checked={form.permissions.includes(perm)} disabled={form.status !== "ACTIVE"} accent={ACCENTS[i % ACCENTS.length]}
                    onChange={() => setForm((p) => ({ ...p, permissions: p.permissions.includes(perm) ? p.permissions.filter((x) => x !== perm) : [...p.permissions, perm] }))} />
                ))}
              </div>
            </div>

            {/* ── Gate access ─────────────────────────────────── */}
            <div>
              <SectionLabel icon={<DoorOpen style={{ width: "12px", height: "12px" }} />} label="Gate Access" />
              {filteredGates.length === 0 ? (
                <p style={{ fontSize: "12.5px", color: "#9CA3AF" }}>Select a community first to see gate options.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {filteredGates.map((gate) => (
                    <CheckItem key={gate.id} label={gate.label} checked={form.gateIds.includes(gate.id)} disabled={form.status !== "ACTIVE"} accent="#0D9488"
                      onChange={() => setForm((p) => ({ ...p, gateIds: p.gateIds.includes(gate.id) ? p.gateIds.filter((id) => id !== gate.id) : [...p.gateIds, gate.id] }))} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 24px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0, background: "#FFF" }}>
            <button type="button" disabled={saving} onClick={() => setDialogOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: saving ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: "12px", height: "12px" }} /> Cancel
            </button>
            <button type="button" disabled={saving} onClick={() => void save()}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 20px", borderRadius: "7px", background: saving ? "#9CA3AF" : "#111827", color: "#FFF", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", transition: "background 120ms ease" }}>
              <Check style={{ width: "13px", height: "13px" }} />
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Staff"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}