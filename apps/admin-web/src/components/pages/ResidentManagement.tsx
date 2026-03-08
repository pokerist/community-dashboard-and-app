import { JSXElementConstructor, ReactElement, ReactNode, ReactPortal, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, Plus, Trash2, Ban, RefreshCw, User,
  ChevronRight, Home, Mail, Phone, CreditCard,
  Calendar, SlidersHorizontal, UserCheck, UserX, AlertTriangle,
  Fingerprint,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { DataTable, type DataTableColumn } from "../DataTable";
import { StatusBadge } from "../StatusBadge";
import apiClient from "../../lib/api-client";
import {
  errorMessage, formatDate, humanizeEnum, maskNationalId, toInitials,
} from "../../lib/live-data";
import { ResidentDetailsPanel } from "./ResidentDetailsPanel";
import type { ResidentOverview } from "./resident-360.types";

// ─── Types ────────────────────────────────────────────────────

type ResidentRow = {
  id: string; name: string; nameAr: string; nationalId: string;
  mobile: string; email: string; units: string[];
  rawStatus: string; status: string; registrationDate: string; avatar: string;
};

type UnitOption = { id: string; label: string };

type CreateResidentForm = {
  nameEN: string; nameAR: string; email: string; phone: string;
  password: string; nationalId: string; dateOfBirth: string;
  unitId: string; unitRole: "FAMILY" | "TENANT" | "OWNER";
};

type OwnerPaymentMode = "CASH" | "INSTALLMENT";

type OwnerInstallmentDraft = {
  dueDate: string; amount: string; referencePageIndex: string; referenceFile: File | null;
};

type OwnerUnitDraft = {
  unitId: string; paymentMode: OwnerPaymentMode; contractSignedAt: string;
  contractFile: File | null; notes: string; installments: OwnerInstallmentDraft[];
};

type CreateOwnerForm = {
  nameEN: string; nameAR: string; email: string; phone: string;
  nationalId: string; nationalIdPhotoFile: File | null; units: OwnerUnitDraft[];
};

const INIT_RESIDENT: CreateResidentForm = { nameEN: "", nameAR: "", email: "", phone: "", password: "", nationalId: "", dateOfBirth: "", unitId: "", unitRole: "FAMILY" };
const INIT_OWNER: CreateOwnerForm = { nameEN: "", nameAR: "", email: "", phone: "", nationalId: "", nationalIdPhotoFile: null, units: [makeUnitDraft()] };

function makeInstallmentDraft(): OwnerInstallmentDraft { return { dueDate: "", amount: "", referencePageIndex: "", referenceFile: null }; }
function makeUnitDraft(): OwnerUnitDraft { return { unitId: "", paymentMode: "CASH", contractSignedAt: "", contractFile: null, notes: "", installments: [] }; }

// ─── Design tokens ────────────────────────────────────────────

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

const STATUS_STYLES: Record<string, { dot: string; bg: string; color: string }> = {
  ACTIVE:    { dot: "#10B981", bg: "#ECFDF5", color: "#065F46" },
  SUSPENDED: { dot: "#F59E0B", bg: "#FFFBEB", color: "#92400E" },
  DISABLED:  { dot: "#6B7280", bg: "#F3F4F6", color: "#374151" },
  INVITED:   { dot: "#3B82F6", bg: "#EFF6FF", color: "#1D4ED8" },
};

// ─── Primitives ───────────────────────────────────────────────

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

function PrimaryBtn({ label, icon, onClick, loading: ld = false, small = false }: { label: string; icon?: React.ReactNode; onClick: () => void; loading?: boolean; small?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={ld} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: small ? "5px 11px" : "7px 14px", borderRadius: "7px", background: hov ? "#1D4ED8" : "#2563EB", color: "#FFF", border: "none", cursor: ld ? "not-allowed" : "pointer", fontSize: small ? "12px" : "12.5px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", boxShadow: "0 1px 3px rgba(37,99,235,0.25)", opacity: ld ? 0.7 : 1, flexShrink: 0 }}>
      {icon}{ld ? "Saving…" : label}
    </button>
  );
}

function DangerBtn({ label, icon, onClick, small = false }: { label: string; icon?: React.ReactNode; onClick: () => void; small?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: small ? "5px 11px" : "7px 14px", borderRadius: "7px", background: hov ? "#B91C1C" : "#FEF2F2", color: hov ? "#FFF" : "#DC2626", border: "1px solid #FCA5A5", cursor: "pointer", fontSize: small ? "12px" : "12.5px", fontWeight: 600, transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
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

function OutlineBtn({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 12px", borderRadius: "7px", background: hov ? "#F5F5F5" : "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
      {icon}{label}
    </button>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: "3px" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "-2px" }}>{hint}</p>}
      {children}
    </div>
  );
}

// ─── Resident avatar ──────────────────────────────────────────

function ResidentAvatar({ initials, idx }: { initials: string; idx: number }) {
  const accent = ACCENTS[idx % ACCENTS.length];
  return (
    <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: `${accent}18`, border: `1.5px solid ${accent}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: "11px", fontWeight: 800, color: accent, letterSpacing: "-0.01em", fontFamily: "'Work Sans', sans-serif" }}>{initials}</span>
    </div>
  );
}

// ─── Inline status pill ───────────────────────────────────────

function StatusPill({ raw }: { raw: string }) {
  const s = STATUS_STYLES[raw.toUpperCase()] ?? STATUS_STYLES["DISABLED"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "20px", background: s.bg, fontSize: "11px", fontWeight: 700, color: s.color, whiteSpace: "nowrap" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {humanizeEnum(raw)}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────

function StatCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "14px 16px", background: "#FFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderTop: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${accent}12`, display: "flex", alignItems: "center", justifyContent: "center", color: accent, flexShrink: 0 }}>{icon}</div>
        <div>
          <p style={{ fontSize: "22px", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>{value}</p>
          <p style={{ marginTop: "3px", fontSize: "11px", color: "#9CA3AF" }}>{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

type ResidentManagementProps = { onNavigateToCreate?: () => void };

export function ResidentManagement({ onNavigateToCreate }: ResidentManagementProps) {
  const [rows, setRows]                       = useState<ResidentRow[]>([]);
  const [unitOptions, setUnitOptions]         = useState<UnitOption[]>([]);
  const [residentOptions, setResidentOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading]             = useState(false);
  const [loadError, setLoadError]             = useState<string | null>(null);
  const [searchTerm, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]       = useState("all");
  const [filtersOpen, setFiltersOpen]         = useState(false);

  // 360 sheet
  const [selectedResidentId, setSelectedId]   = useState<string | null>(null);
  const [selectedOverview, setOverview]       = useState<ResidentOverview | null>(null);
  const [isOverviewLoading, setOvLoading]     = useState(false);

  // Create dialogs
  const [createMode, setCreateMode]           = useState<"owner" | "quick" | null>(null);
  const [residentForm, setResidentForm]       = useState<CreateResidentForm>(INIT_RESIDENT);
  const [ownerForm, setOwnerForm]             = useState<CreateOwnerForm>(INIT_OWNER);
  const [saving, setSaving]                   = useState(false);

  // ── Loaders ──────────────────────────────────────────────────

  const loadResidents = useCallback(async () => {
    setIsLoading(true); setLoadError(null);
    try {
      const [res, unitsRes] = await Promise.all([
        apiClient.get("/admin/users", { params: { userType: "resident", take: 200, skip: 0 } }),
        apiClient.get("/units", { params: { page: 1, limit: 100, status: "AVAILABLE" } }),
      ]);
      const users = Array.isArray(res.data) ? res.data : [];
      setRows(users.map((u: any, i: number) => {
        const unitLabels = u?.resident?.residentUnits?.map((ru: any) => { const unit = ru?.unit; if (!unit) return null; return `${unit.block ? unit.block + "-" : ""}${unit.unitNumber}`; })?.filter(Boolean) ?? [];
        return { id: u.id, name: u.nameEN ?? "—", nameAr: u.nameAR ?? "—", nationalId: maskNationalId(u?.resident?.nationalId), mobile: u.phone ?? "—", email: u.email ?? "—", units: unitLabels.length > 0 ? unitLabels : ["—"], rawStatus: String(u.userStatus ?? "ACTIVE").toUpperCase(), status: humanizeEnum(u.userStatus ?? "ACTIVE"), registrationDate: formatDate(u.createdAt), avatar: toInitials(u.nameEN) };
      }));
      setResidentOptions(users.map((u: any) => ({ id: String(u.id), label: [u.nameEN, u.email, u.phone].filter(Boolean).join(" • ") || String(u.id) })));
      const rawUnits = Array.isArray(unitsRes.data?.data) ? unitsRes.data.data : Array.isArray(unitsRes.data) ? unitsRes.data : [];
      setUnitOptions(rawUnits.map((u: any) => ({ id: String(u.id), label: [u.projectName, u.block ? `Block ${u.block}` : null, u.unitNumber ? `Unit ${u.unitNumber}` : null].filter(Boolean).join(" - ") || String(u.id) })).filter((u: UnitOption) => !!u.id));
    } catch (e) { const msg = errorMessage(e); setLoadError(msg); toast.error("Failed to load residents", { description: msg }); }
    finally { setIsLoading(false); }
  }, []);

  const loadOverview = useCallback(async (userId: string) => {
    setSelectedId(userId); setOvLoading(true);
    try { const res = await apiClient.get(`/admin/users/residents/${userId}/overview`); setOverview(res.data as ResidentOverview); }
    catch (e) { toast.error("Failed to load resident details", { description: errorMessage(e) }); setOverview(null); }
    finally { setOvLoading(false); }
  }, []);

  const refreshOverview = useCallback(async () => { await loadResidents(); if (selectedResidentId) await loadOverview(selectedResidentId); }, [loadResidents, loadOverview, selectedResidentId]);

  useEffect(() => { void loadResidents(); }, [loadResidents]);

  const uploadFile = useCallback(async (endpoint: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const res = await apiClient.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
    const id = res.data?.id as string | undefined;
    if (!id) throw new Error("Upload did not return file id");
    return id;
  }, []);

  // ── Actions ──────────────────────────────────────────────────

  const handleCreateResident = async () => {
    if (!residentForm.nameEN.trim()) { toast.error("Resident name is required"); return; }
    if (!residentForm.email.trim() && !residentForm.phone.trim()) { toast.error("Provide at least email or phone"); return; }
    setSaving(true); let uid: string | null = null;
    try {
      const ur = await apiClient.post("/admin/users", { nameEN: residentForm.nameEN.trim(), nameAR: residentForm.nameAR.trim() || undefined, email: residentForm.email.trim() || undefined, phone: residentForm.phone.trim() || undefined, password: residentForm.password.trim() || undefined, signupSource: "dashboard" });
      uid = ur.data?.id; if (!uid) throw new Error("User creation did not return an id");
      await apiClient.post("/admin/users/residents", { userId: uid, nationalId: residentForm.nationalId.trim() || undefined, dateOfBirth: residentForm.dateOfBirth ? new Date(residentForm.dateOfBirth).toISOString() : undefined });
      if (residentForm.unitId) await apiClient.post(`/units/${residentForm.unitId}/assign-user`, { userId: uid, role: residentForm.unitRole });
      toast.success("Resident created"); setResidentForm(INIT_RESIDENT); setCreateMode(null); await loadResidents();
    } catch (e) { toast.error("Failed to create resident", { description: uid ? `User created (${uid}) but profile failed. ${errorMessage(e)}` : errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const handleCreateOwner = async () => {
    if (!ownerForm.nameEN.trim()) { toast.error("Resident English name is required"); return; }
    if (!ownerForm.phone.trim()) { toast.error("Phone is required"); return; }
    if (!ownerForm.nationalIdPhotoFile) { toast.error("National ID image is required"); return; }
    if (!ownerForm.units.length || !ownerForm.units[0].unitId) { toast.error("At least one unit assignment is required"); return; }
    setSaving(true);
    try {
      const natIdFileId = await uploadFile("/files/upload/national-id", ownerForm.nationalIdPhotoFile);
      const mappedUnits = [];
      for (let i = 0; i < ownerForm.units.length; i++) {
        const ud = ownerForm.units[i];
        if (!ud.unitId) throw new Error(`Unit required in assignment #${i + 1}`);
        if (ud.paymentMode === "INSTALLMENT" && !ud.installments.length) throw new Error(`Installments required for assignment #${i + 1}`);
        const contractFileId = ud.contractFile ? await uploadFile("/files/upload/contract", ud.contractFile) : undefined;
        const installments = [];
        for (let j = 0; j < ud.installments.length; j++) {
          const inst = ud.installments[j];
          if (!inst.dueDate) throw new Error(`Due date required for installment #${j + 1} in assignment #${i + 1}`);
          const amt = Number(inst.amount);
          if (!Number.isFinite(amt) || amt <= 0) throw new Error(`Invalid amount for installment #${j + 1}`);
          const referenceFileId = inst.referenceFile ? await uploadFile("/files/upload/contract", inst.referenceFile) : undefined;
          installments.push({ dueDate: new Date(inst.dueDate).toISOString(), amount: amt, referenceFileId, referencePageIndex: inst.referencePageIndex ? Number(inst.referencePageIndex) : undefined });
        }
        mappedUnits.push({ unitId: ud.unitId, paymentMode: ud.paymentMode, contractSignedAt: ud.contractSignedAt ? new Date(ud.contractSignedAt).toISOString() : undefined, contractFileId, notes: ud.notes.trim() || undefined, installments });
      }
      await apiClient.post("/owners/create-with-unit", { nameEN: ownerForm.nameEN.trim(), nameAR: ownerForm.nameAR.trim() || undefined, email: ownerForm.email.trim() || undefined, phone: ownerForm.phone.trim(), nationalId: ownerForm.nationalId.trim() || undefined, nationalIdPhotoId: natIdFileId, units: mappedUnits });
      toast.success("Resident created successfully"); setOwnerForm(INIT_OWNER); setCreateMode(null); await loadResidents();
    } catch (e) { toast.error("Failed to create resident", { description: errorMessage(e) }); }
    finally { setSaving(false); }
  };

  const handleToggleSuspend = async (id: string, name: string) => {
    const row = rows.find((r) => r.id === id); if (!row) return;
    const cur = row.rawStatus.toUpperCase();
    const next = cur === "SUSPENDED" || cur === "DISABLED" ? "ACTIVE" : "SUSPENDED";
    try {
      await apiClient.patch(`/admin/users/${id}`, { userStatus: next });
      setRows((p) => p.map((r) => r.id === id ? { ...r, rawStatus: next, status: humanizeEnum(next) } : r));
      toast.success(`Resident ${next === "SUSPENDED" ? "suspended" : "activated"}`);
    } catch (e) { toast.error("Failed to update status", { description: errorMessage(e) }); }
  };

  const handleDeactivate = async (id: string, name: string) => {
    try {
      await apiClient.delete(`/admin/users/${id}`);
      setRows((p) => p.map((r) => r.id === id ? { ...r, rawStatus: "DISABLED", status: humanizeEnum("DISABLED") } : r));
      toast.success("Resident deactivated");
    } catch (e) { toast.error("Failed to deactivate", { description: errorMessage(e) }); }
  };

  const handleHardDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete ${name} permanently and purge unit links/leases?\nThis will reset affected units to AVAILABLE.`)) return;
    try {
      await apiClient.delete(`/admin/users/${id}/hard?purge=true`);
      setRows((p) => p.filter((r) => r.id !== id));
      toast.success("Resident permanently deleted");
    } catch (e) { toast.error("Failed to permanently delete", { description: errorMessage(e) }); }
  };

  const canSuspend  = (s: string) => s === "ACTIVE";
  const canActivate = (s: string) => s === "SUSPENDED" || s === "DISABLED";
  const canDeactivate = (s: string) => ["ACTIVE","SUSPENDED","INVITED"].includes(s);

  // ── Derived ───────────────────────────────────────────────────

  const filteredRows = useMemo(() => rows.filter((r) => {
    const q = searchTerm.trim().toLowerCase();
    const matchSearch = !q || [r.name, r.email, r.mobile, ...r.units].some((v) => v.toLowerCase().includes(q));
    const matchStatus = statusFilter === "all" || r.rawStatus === statusFilter.toUpperCase();
    return matchSearch && matchStatus;
  }), [rows, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total:     rows.length,
    active:    rows.filter((r) => r.rawStatus === "ACTIVE").length,
    suspended: rows.filter((r) => r.rawStatus === "SUSPENDED").length,
    invited:   rows.filter((r) => r.rawStatus === "INVITED").length,
  }), [rows]);

  const activeFilters = [statusFilter !== "all"].filter(Boolean).length;

  // ── Table columns ─────────────────────────────────────────────

  const columns: DataTableColumn<ResidentRow>[] = [
    {
      key: "resident", header: "Resident",
      render: (r: { avatar: string; name: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined; nameAr: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined; }, i: any) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ResidentAvatar initials={r.avatar} idx={i ?? 0} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>{r.name}</p>
            <p style={{ fontSize: "10.5px", color: "#9CA3AF", marginTop: "2px", direction: "rtl", textAlign: "left" }}>{r.nameAr !== "—" ? r.nameAr : ""}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contact", header: "Contact",
      render: (r) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#374151" }}>
            <Phone style={{ width: "10px", height: "10px", color: "#9CA3AF", flexShrink: 0 }} />{r.mobile}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#9CA3AF" }}>
            <Mail style={{ width: "10px", height: "10px", flexShrink: 0 }} />{r.email}
          </span>
        </div>
      ),
    },
    {
      key: "nationalId", header: "National ID",
      render: (r) => (
        <span style={{ fontSize: "12px", fontFamily: "'DM Mono', monospace", color: "#6B7280", display: "flex", alignItems: "center", gap: "5px" }}>
          <Fingerprint style={{ width: "11px", height: "11px", color: "#D1D5DB" }} />{r.nationalId}
        </span>
      ),
    },
    {
      key: "units", header: "Units",
      render: (r) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {r.units.map((u) => (
            <span key={`${r.id}-${u}`} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "5px", background: "#F3F4F6", fontSize: "11px", fontWeight: 600, color: "#374151" }}>
              <Home style={{ width: "9px", height: "9px", color: "#9CA3AF" }} />{u}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "status", header: "Status",
      render: (r) => <StatusPill raw={r.rawStatus} />,
    },
    {
      key: "regDate", header: "Registered",
      render: (r) => (
        <span style={{ fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", gap: "4px" }}>
          <Calendar style={{ width: "10px", height: "10px" }} />{r.registrationDate}
        </span>
      ),
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          {/* 360 button — primary CTA */}
          <button type="button" onClick={() => void loadOverview(r.id)}
            style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", background: "#111827", color: "#FFF", border: "none", cursor: "pointer", fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.02em", transition: "opacity 120ms ease", flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            360 <ChevronRight style={{ width: "10px", height: "10px" }} />
          </button>

          {/* Suspend / Activate */}
          {canSuspend(r.rawStatus) && (
            <ActionIconBtn icon={<Ban style={{ width: "11px", height: "11px" }} />} title="Suspend" onClick={() => void handleToggleSuspend(r.id, r.name)} color="#F59E0B" />
          )}
          {canActivate(r.rawStatus) && (
            <ActionIconBtn icon={<UserCheck style={{ width: "11px", height: "11px" }} />} title="Activate" onClick={() => void handleToggleSuspend(r.id, r.name)} color="#10B981" />
          )}

          {/* Deactivate */}
          {canDeactivate(r.rawStatus) && (
            <ActionIconBtn icon={<UserX style={{ width: "11px", height: "11px" }} />} title="Deactivate" onClick={() => void handleDeactivate(r.id, r.name)} color="#6B7280" />
          )}

          {/* Hard delete */}
          <ActionIconBtn icon={<Trash2 style={{ width: "11px", height: "11px" }} />} title="Permanently delete" onClick={() => void handleHardDelete(r.id, r.name)} color="#DC2626" danger />
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
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2, margin: 0 }}>Residents</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Live resident records — click <strong style={{ color: "#111827" }}>360</strong> for the full profile.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <OutlineBtn label="Refresh" icon={<RefreshCw style={{ width: "12px", height: "12px" }} />} onClick={() => void loadResidents()} />
          <OutlineBtn label="Quick Add" icon={<Plus style={{ width: "12px", height: "12px" }} />} onClick={() => setCreateMode("quick")} />
          <PrimaryBtn
            label="Add Resident"
            icon={<User style={{ width: "13px", height: "13px" }} />}
            onClick={() => { if (onNavigateToCreate) { onNavigateToCreate(); return; } setCreateMode("owner"); }}
          />
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <StatCard label="Total Residents" value={stats.total}     accent={ACCENTS[1]} icon={<User style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Active"          value={stats.active}    accent={ACCENTS[0]} icon={<UserCheck style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Suspended"       value={stats.suspended} accent="#F59E0B"    icon={<Ban style={{ width: "16px", height: "16px" }} />} />
        <StatCard label="Invited"         value={stats.invited}   accent={ACCENTS[2]} icon={<Mail style={{ width: "16px", height: "16px" }} />} />
      </div>

      {/* ── Error banner ───────────────────────────────────── */}
      {loadError && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#991B1B", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
          {loadError}
        </div>
      )}

      {/* ── Search + filter bar ────────────────────────────── */}
      <div style={{ background: "#FFF", borderRadius: "10px", border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: "16px", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "10px", padding: "12px 14px", borderBottom: filtersOpen ? "1px solid #F3F4F6" : "none" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
            <input placeholder="Search by name, email, phone, unit…" value={searchTerm} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: "32px", fontSize: "12.5px", background: "#F9FAFB" }} />
          </div>
          <button type="button" onClick={() => setFiltersOpen((p) => !p)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 12px", borderRadius: "7px", border: `1px solid ${activeFilters > 0 ? "#2563EB40" : "#E5E7EB"}`, background: activeFilters > 0 ? "#EFF6FF" : "#FAFAFA", color: activeFilters > 0 ? "#2563EB" : "#6B7280", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", transition: "all 120ms ease", flexShrink: 0 }}>
            <SlidersHorizontal style={{ width: "13px", height: "13px" }} />
            Filters
            {activeFilters > 0 && <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#2563EB", color: "#FFF", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>{activeFilters}</span>}
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding: "12px 14px", display: "flex", gap: "10px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "200px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="disabled">Disabled</option>
                <option value="invited">Invited</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Count row ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <p style={{ fontSize: "12px", color: "#9CA3AF" }}>
          Showing <strong style={{ color: "#374151", fontFamily: "'DM Mono', monospace" }}>{filteredRows.length}</strong> of <strong style={{ color: "#374151", fontFamily: "'DM Mono', monospace" }}>{rows.length}</strong> residents
        </p>
      </div>

      {/* ── Data table ─────────────────────────────────────── */}
      <DataTable
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.id}
        loading={isLoading}
        emptyTitle="No residents found"
        emptyDescription="Try adjusting your filters or add a new resident."
      />

      {/* ══ DIALOGS ══════════════════════════════════════════ */}

      {/* ── Owner / full create dialog ──────────────────────── */}
      <Dialog open={createMode === "owner"} onOpenChange={(o: any) => !o && setCreateMode(null)}>
        <DialogContent style={{ maxWidth: "680px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif", maxHeight: "92vh" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>Add Resident — Full Flow</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Creates resident account, unit assignments, contract documents, and payment plans.</DialogDescription>
            </DialogHeader>
          </div>

          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", maxHeight: "calc(92vh - 130px)" }}>
            {/* Identity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Name (EN)" required><input value={ownerForm.nameEN} onChange={(e) => setOwnerForm((p) => ({ ...p, nameEN: e.target.value }))} placeholder="Ahmed Hassan Mohamed" style={inputStyle} /></Field>
              <Field label="Name (AR)"><input value={ownerForm.nameAR} onChange={(e) => setOwnerForm((p) => ({ ...p, nameAR: e.target.value }))} placeholder="أحمد حسن محمد" style={{ ...inputStyle, direction: "rtl" }} /></Field>
              <Field label="Email"><input type="email" value={ownerForm.email} onChange={(e) => setOwnerForm((p) => ({ ...p, email: e.target.value }))} placeholder="resident@example.com" style={inputStyle} /></Field>
              <Field label="Phone" required><input value={ownerForm.phone} onChange={(e) => setOwnerForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+2010xxxxxxxx" style={inputStyle} /></Field>
              <Field label="National ID"><input value={ownerForm.nationalId} onChange={(e) => setOwnerForm((p) => ({ ...p, nationalId: e.target.value }))} placeholder="29800000000000" style={inputStyle} /></Field>
              <Field label="National ID Photo" required hint={ownerForm.nationalIdPhotoFile?.name ?? "No file selected"}>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setOwnerForm((p) => ({ ...p, nationalIdPhotoFile: e.target.files?.[0] ?? null }))} style={inputStyle} />
              </Field>
            </div>

            {/* Unit assignments */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <p style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827" }}>Unit Assignments & Payment Plans</p>
                <OutlineBtn label="Add Unit" icon={<Plus style={{ width: "11px", height: "11px" }} />} onClick={() => setOwnerForm((p) => ({ ...p, units: [...p.units, makeUnitDraft()] }))} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {ownerForm.units.map((ud, ui) => (
                  <div key={ui} style={{ borderRadius: "8px", border: `1px solid ${ACCENTS[ui % ACCENTS.length]}25`, background: `${ACCENTS[ui % ACCENTS.length]}04`, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", background: `${ACCENTS[ui % ACCENTS.length]}08` }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: ACCENTS[ui % ACCENTS.length] }}>Assignment #{ui + 1}</span>
                      {ownerForm.units.length > 1 && <button type="button" onClick={() => setOwnerForm((p) => ({ ...p, units: p.units.filter((_, idx) => idx !== ui) }))} style={{ fontSize: "11px", color: "#DC2626", background: "none", border: "none", cursor: "pointer" }}>Remove</button>}
                    </div>
                    <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <Field label="Unit">
                        <select value={ud.unitId} style={selectStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, unitId: e.target.value } : u) }))}>
                          <option value="">Select unit</option>
                          {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Payment Mode">
                        <select value={ud.paymentMode} style={selectStyle} onChange={(e) => { const mode = e.target.value as OwnerPaymentMode; setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, paymentMode: mode, installments: mode === "INSTALLMENT" && !u.installments.length ? [makeInstallmentDraft()] : mode === "CASH" ? [] : u.installments } : u) })); }}>
                          <option value="CASH">Cash</option>
                          <option value="INSTALLMENT">Installment</option>
                        </select>
                      </Field>
                      <Field label="Contract Signed Date"><input type="date" value={ud.contractSignedAt} style={inputStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, contractSignedAt: e.target.value } : u) }))} /></Field>
                      <Field label="Contract File" hint={ud.contractFile?.name ?? "Optional"}>
                        <input type="file" accept="image/*,application/pdf" style={inputStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, contractFile: e.target.files?.[0] ?? null } : u) }))} />
                      </Field>
                      <div style={{ gridColumn: "span 2" }}>
                        <Field label="Notes"><input value={ud.notes} style={inputStyle} placeholder="Optional notes…" onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, notes: e.target.value } : u) }))} /></Field>
                      </div>
                    </div>

                    {ud.paymentMode === "INSTALLMENT" && (
                      <div style={{ padding: "0 14px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <p style={{ fontSize: "11.5px", fontWeight: 700, color: "#374151" }}>Installments / Checks</p>
                          <button type="button" onClick={() => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, installments: [...u.installments, makeInstallmentDraft()] } : u) }))}
                            style={{ fontSize: "11px", fontWeight: 600, color: ACCENTS[1], background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {ud.installments.map((inst, ii) => (
                            <div key={ii} style={{ padding: "10px 12px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FAFAFA", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "8px", alignItems: "end" }}>
                              <Field label="Due Date"><input type="date" value={inst.dueDate} style={inputStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, installments: u.installments.map((it, j) => j === ii ? { ...it, dueDate: e.target.value } : it) } : u) }))} /></Field>
                              <Field label="Amount"><input type="number" value={inst.amount} style={inputStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, installments: u.installments.map((it, j) => j === ii ? { ...it, amount: e.target.value } : it) } : u) }))} /></Field>
                              <Field label="Page #"><input type="number" value={inst.referencePageIndex} style={inputStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, installments: u.installments.map((it, j) => j === ii ? { ...it, referencePageIndex: e.target.value } : it) } : u) }))} /></Field>
                              <Field label="Check File">
                                <input type="file" accept="image/*,application/pdf" style={inputStyle} onChange={(e) => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, installments: u.installments.map((it, j) => j === ii ? { ...it, referenceFile: e.target.files?.[0] ?? null } : it) } : u) }))} />
                              </Field>
                              <button type="button" onClick={() => setOwnerForm((p) => ({ ...p, units: p.units.map((u, i) => i === ui ? { ...u, installments: u.installments.filter((_, j) => j !== ii) } : u) }))}
                                style={{ width: "26px", height: "26px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Trash2 style={{ width: "11px", height: "11px" }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setCreateMode(null)} />
            <PrimaryBtn label="Create Resident" onClick={() => void handleCreateOwner()} loading={saving} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Quick create dialog ─────────────────────────────── */}
      <Dialog open={createMode === "quick"} onOpenChange={(o: any) => !o && setCreateMode(null)}>
        <DialogContent style={{ maxWidth: "520px", borderRadius: "10px", border: "1px solid #EBEBEB", padding: 0, overflow: "hidden", fontFamily: "'Work Sans', sans-serif" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "15px", color: "#111827" }}>Quick Add Resident</DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Lightweight flow — base user, resident profile, optional unit assignment.</DialogDescription>
            </DialogHeader>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "13px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <Field label="Name (EN)" required><input value={residentForm.nameEN} onChange={(e) => setResidentForm((p) => ({ ...p, nameEN: e.target.value }))} placeholder="Ahmed Ali" style={inputStyle} /></Field>
              <Field label="Name (AR)"><input value={residentForm.nameAR} onChange={(e) => setResidentForm((p) => ({ ...p, nameAR: e.target.value }))} placeholder="أحمد علي" style={{ ...inputStyle, direction: "rtl" }} /></Field>
              <Field label="Email"><input type="email" value={residentForm.email} onChange={(e) => setResidentForm((p) => ({ ...p, email: e.target.value }))} placeholder="resident@example.com" style={inputStyle} /></Field>
              <Field label="Phone"><input value={residentForm.phone} onChange={(e) => setResidentForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+201000000000" style={inputStyle} /></Field>
              <Field label="National ID"><input value={residentForm.nationalId} onChange={(e) => setResidentForm((p) => ({ ...p, nationalId: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Date of Birth"><input type="date" value={residentForm.dateOfBirth} onChange={(e) => setResidentForm((p) => ({ ...p, dateOfBirth: e.target.value }))} style={inputStyle} /></Field>
              <Field label="Password" hint="Leave empty to auto-generate."><input type="password" value={residentForm.password} onChange={(e) => setResidentForm((p) => ({ ...p, password: e.target.value }))} style={inputStyle} /></Field>
            </div>
            <Field label="Assign Unit" hint="Optional — leaves unassigned if blank.">
              <select value={residentForm.unitId} onChange={(e) => setResidentForm((p) => ({ ...p, unitId: e.target.value }))} style={selectStyle}>
                <option value="">No unit assignment</option>
                {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
            {residentForm.unitId && (
              <Field label="Unit Role">
                <select value={residentForm.unitRole} onChange={(e) => setResidentForm((p) => ({ ...p, unitRole: e.target.value as CreateResidentForm["unitRole"] }))} style={selectStyle}>
                  <option value="FAMILY">Family</option>
                  <option value="TENANT">Tenant</option>
                  <option value="OWNER">Owner</option>
                </select>
              </Field>
            )}
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <GhostBtn label="Cancel" onClick={() => setCreateMode(null)} />
            <PrimaryBtn label="Create Resident" onClick={() => void handleCreateResident()} loading={saving} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Resident 360 sheet ──────────────────────────────── */}
      <Sheet open={!!selectedResidentId} onOpenChange={(o: any) => { if (!o) { setSelectedId(null); setOverview(null); } }}>
        <SheetContent side="right" style={{ width: "92vw", maxWidth: "980px", overflowY: "auto", fontFamily: "'Work Sans', sans-serif" }}>
          <SheetHeader style={{ paddingBottom: "16px", borderBottom: "1px solid #F3F4F6" }}>
            <SheetTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 800, fontSize: "16px", color: "#111827" }}>Resident 360°</SheetTitle>
            <SheetDescription style={{ fontSize: "12px", color: "#9CA3AF" }}>Full profile, units, ownership, household tree, and documents.</SheetDescription>
          </SheetHeader>
          <div style={{ marginTop: "20px" }}>
            {isOverviewLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ height: "60px", borderRadius: "8px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "sk-shimmer 1.4s ease infinite" }} />
                ))}
              </div>
            ) : selectedOverview ? (
              <ResidentDetailsPanel overview={selectedOverview} unitOptions={unitOptions} residentOptions={residentOptions} onRefresh={refreshOverview} />
            ) : (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No resident details loaded.</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Action icon button ───────────────────────────────────────

function ActionIconBtn({ icon, onClick, color, title, danger = false }: { icon: React.ReactNode; onClick: () => void; color: string; title: string; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: "28px", height: "28px", borderRadius: "6px", border: `1px solid ${hov ? color + "60" : "#EBEBEB"}`, background: hov ? (danger ? "#FEF2F2" : `${color}10`) : "#FFF", color: hov ? color : "#9CA3AF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 120ms ease", flexShrink: 0 }}>
      {icon}
    </button>
  );
}