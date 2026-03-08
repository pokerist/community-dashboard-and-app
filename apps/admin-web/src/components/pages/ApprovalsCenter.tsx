import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, Search, CalendarRange,
  ChevronDown, Users, Home, Briefcase, UserCheck, Building2,
  SlidersHorizontal, Eye,
} from "lucide-react";
import { DataTable, DataTableColumn } from "../DataTable";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import { StatusBadge } from "../StatusBadge";
import approvalsService, {
  ApprovalBaseItem,
  ApprovalStats,
  DelegateApprovalItem,
  DelegateFeeMode,
  FamilyApprovalItem,
  FamilyRelationship,
  HomeStaffApprovalItem,
  HomeStaffType,
  OwnerApprovalItem,
  OwnerOption,
  UnitOption,
} from "../../lib/approvals-service";
import {
  errorMessage,
  formatCurrencyEGP,
  formatDate,
  formatDateTime,
  humanizeEnum,
  toInitials,
} from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type TabKey = "owners" | "family" | "delegates" | "home-staff";
type StatusFilter = "PENDING" | "PROCESSING" | "ALL";

type SelectedItem =
  | { tab: "owners"; item: OwnerApprovalItem }
  | { tab: "family"; item: FamilyApprovalItem }
  | { tab: "delegates"; item: DelegateApprovalItem }
  | { tab: "home-staff"; item: HomeStaffApprovalItem }

type PreviewState = {
  loading: boolean; objectUrl: string | null; mimeType: string | null; error: string | null;
};

// ─── Constants ────────────────────────────────────────────────

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

const RELATIONSHIP_OPTIONS: FamilyRelationship[] = ["SON_DAUGHTER", "MOTHER_FATHER", "SPOUSE"];
const HOME_STAFF_TYPES: HomeStaffType[] = ["DRIVER", "NANNY", "SERVANT", "GARDENER", "OTHER"];
const DELEGATE_FEE_MODES: DelegateFeeMode[] = ["NO_FEE", "FEE_REQUIRED"];

const TAB_META: Record<TabKey, { label: string; icon: React.ReactNode; statsKey: keyof ApprovalStats; accent: string }> = {
  owners:      { label: "Owners",       icon: <Building2 style={{ width: "13px", height: "13px" }} />, statsKey: "pendingOwners",        accent: "#2563EB" },
  family:      { label: "Family",       icon: <Users     style={{ width: "13px", height: "13px" }} />, statsKey: "pendingFamilyMembers", accent: "#0D9488" },
  delegates:   { label: "Delegates",    icon: <UserCheck style={{ width: "13px", height: "13px" }} />, statsKey: "pendingDelegates",     accent: "#BE185D" },
  "home-staff":{ label: "Home Staff",   icon: <Home      style={{ width: "13px", height: "13px" }} />, statsKey: "pendingHomeStaff",     accent: "#7C3AED" },
};

function buildUnitLabel(projectName: string, unitNumber: string | null): string {
  return unitNumber ? `${projectName} – ${unitNumber}` : projectName;
}

function collectDocumentUrls(item: ApprovalBaseItem | null): string[] {
  if (!item) return [];
  const urls: string[] = [];
  if (item.documents.photo)      urls.push(item.documents.photo);
  if (item.documents.nationalId) urls.push(item.documents.nationalId);
  if (item.documents.passport)   urls.push(item.documents.passport);
  item.documents.other.forEach((r) => urls.push(r.url));
  return urls;
}

// ─── Primitive UI ─────────────────────────────────────────────

const inputStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "12.5px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "34px" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

function ReviewBtn({ onClick, label = "Review" }: { onClick: () => void; label?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "6px", border: "1px solid #E5E7EB", background: hov ? "#111827" : "#FFF", color: hov ? "#FFF" : "#374151", cursor: "pointer", fontSize: "11.5px", fontWeight: 700, transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0 }}>
      <Eye style={{ width: "10px", height: "10px" }} />{label}
    </button>
  );
}

function ApproveBtn({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={busy} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 18px", borderRadius: "7px", background: hov ? "#047857" : "#059669", color: "#FFF", border: "none", cursor: busy ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif", opacity: busy ? 0.7 : 1 }}>
      <CheckCircle2 style={{ width: "14px", height: "14px" }} />{busy ? "Approving…" : "Approve"}
    </button>
  );
}

function RejectBtn({ onClick, busy, confirm = false }: { onClick: () => void; busy: boolean; confirm?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={busy} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 18px", borderRadius: "7px", background: hov ? "#B91C1C" : (confirm ? "#DC2626" : "#FEF2F2"), color: confirm ? "#FFF" : "#DC2626", border: confirm ? "none" : "1px solid #FCA5A5", cursor: busy ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif", opacity: busy ? 0.7 : 1 }}>
      <XCircle style={{ width: "14px", height: "14px" }} />{confirm ? (busy ? "Rejecting…" : "Confirm Reject") : "Reject"}
    </button>
  );
}

function GhostBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "8px 14px", borderRadius: "7px", background: hov ? "#F5F5F5" : "#FFF", color: "#6B7280", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, transition: "background 120ms ease", fontFamily: "'Work Sans', sans-serif" }}>
      {label}
    </button>
  );
}

// ─── Filter bar ───────────────────────────────────────────────

function FilterBar({ children, open, onToggle, activeCount }: { children: React.ReactNode; open: boolean; onToggle: () => void; activeCount: number }) {
  return (
    <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", marginBottom: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: open ? "1px solid #F3F4F6" : "none" }}>
        <Search style={{ width: "13px", height: "13px", color: "#9CA3AF", flexShrink: 0 }} />
        {/* first child as search */}
        <div style={{ flex: 1 }}>{Array.isArray(children) ? (children as React.ReactNode[])[0] : children}</div>
        <button type="button" onClick={onToggle}
          style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${activeCount > 0 ? "#2563EB40" : "#E5E7EB"}`, background: activeCount > 0 ? "#EFF6FF" : "#FAFAFA", color: activeCount > 0 ? "#2563EB" : "#6B7280", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", flexShrink: 0, fontFamily: "'Work Sans', sans-serif" }}>
          <SlidersHorizontal style={{ width: "11px", height: "11px" }} />
          Filters
          {activeCount > 0 && <span style={{ width: "15px", height: "15px", borderRadius: "50%", background: "#2563EB", color: "#FFF", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>{activeCount}</span>}
          <ChevronDown style={{ width: "10px", height: "10px", transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }} />
        </button>
      </div>
      {open && (
        <div style={{ padding: "10px 14px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {/* date range pair */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FAFAFA", flexShrink: 0 }}>
            <CalendarRange style={{ width: "11px", height: "11px", color: "#9CA3AF" }} />
            <span style={{ fontSize: "10.5px", color: "#9CA3AF", fontWeight: 600 }}>FROM</span>
            {(Array.isArray(children) ? (children as React.ReactNode[])[1] : null)}
            <span style={{ fontSize: "10.5px", color: "#9CA3AF", fontWeight: 600, marginLeft: "4px" }}>TO</span>
            {(Array.isArray(children) ? (children as React.ReactNode[])[2] : null)}
          </div>
          {/* rest of filters */}
          {Array.isArray(children) && (children as React.ReactNode[]).slice(3)}
        </div>
      )}
    </div>
  );
}

// ─── Stat cards ───────────────────────────────────────────────

function ApprovalStatCard({ tab, stats, statsLoading, active, onClick }: { tab: TabKey; stats: ApprovalStats | null; statsLoading: boolean; active: boolean; onClick: () => void }) {
  const meta  = TAB_META[tab];
  const count = stats ? (stats[meta.statsKey] ?? 0) : 0;
  const [hov, setHov] = useState(false);

  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ flex: 1, minWidth: 0, padding: "14px 16px", borderRadius: "10px", border: `1px solid ${active ? meta.accent + "50" : "#EBEBEB"}`, background: active ? `${meta.accent}08` : hov ? "#FAFAFA" : "#FFF", boxShadow: active ? `0 0 0 2px ${meta.accent}30` : "0 1px 3px rgba(0,0,0,0.04)", cursor: "pointer", transition: "all 120ms ease", textAlign: "left", borderTop: `3px solid ${active ? meta.accent : "#EBEBEB"}`, fontFamily: "'Work Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <span style={{ color: active ? meta.accent : "#9CA3AF", transition: "color 120ms" }}>{meta.icon}</span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: active ? meta.accent : "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{meta.label}</span>
      </div>
      <p style={{ fontSize: "26px", fontWeight: 900, color: active ? meta.accent : "#111827", letterSpacing: "-0.04em", lineHeight: 1, margin: 0, fontFamily: "'DM Mono', monospace" }}>
        {statsLoading ? "—" : String(count)}
      </p>
      {count > 0 && !statsLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "5px" }}>
          <Clock style={{ width: "9px", height: "9px", color: "#F59E0B" }} />
          <span style={{ fontSize: "10px", color: "#F59E0B", fontWeight: 700 }}>pending review</span>
        </div>
      )}
    </button>
  );
}

// ─── Detail row ───────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "12px", padding: "6px 0", borderBottom: "1px solid #F9FAFB" }}>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", width: "110px", flexShrink: 0, paddingTop: "1px" }}>{label}</span>
      <span style={{ fontSize: "13px", color: "#111827", flex: 1 }}>{value || "—"}</span>
    </div>
  );
}

// ─── Document preview card ────────────────────────────────────

function DocCard({ label, url, preview, onOpen }: { label: string; url: string | null; preview?: PreviewState; onOpen: () => void }) {
  const isImage = Boolean(preview?.mimeType?.startsWith("image/"));
  return (
    <div style={{ borderRadius: "8px", border: "1px solid #EBEBEB", overflow: "hidden", background: "#FAFAFA" }}>
      <div style={{ padding: "7px 10px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        {url && (
          <button type="button" onClick={onOpen}
            style={{ fontSize: "10.5px", fontWeight: 600, color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif" }}>
            Open ↗
          </button>
        )}
      </div>
      <div style={{ padding: "8px", minHeight: "64px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!url ? (
          <p style={{ fontSize: "12px", color: "#D1D5DB" }}>Not provided</p>
        ) : preview?.loading ? (
          <p style={{ fontSize: "12px", color: "#9CA3AF" }}>Loading…</p>
        ) : preview?.objectUrl && isImage ? (
          <button type="button" onClick={onOpen} style={{ width: "100%", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
            <img src={preview.objectUrl} alt={label} style={{ width: "100%", height: "90px", objectFit: "cover", borderRadius: "5px" }} />
          </button>
        ) : (
          <button type="button" onClick={onOpen}
            style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", cursor: "pointer", fontSize: "12px", fontFamily: "'Work Sans', sans-serif" }}>
            View document
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ApprovalsCenter() {
  const [activeTab, setActiveTab] = useState<TabKey>("owners");
  const [stats, setStats]         = useState<ApprovalStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [owners,     setOwners]     = useState<OwnerApprovalItem[]>([]);
  const [family,     setFamily]     = useState<FamilyApprovalItem[]>([]);
  const [delegates,  setDelegates]  = useState<DelegateApprovalItem[]>([]);
  const [homeStaff,  setHomeStaff]  = useState<HomeStaffApprovalItem[]>([]);

  const [ownersLoading,    setOL] = useState(false);
  const [familyLoading,    setFL] = useState(false);
  const [delegatesLoading, setDL] = useState(false);
  const [homeStaffLoading, setHL] = useState(false);

  // Filters
  const [ownerSearch,           setOwnerSearch]           = useState("");
  const [ownerStatus,           setOwnerStatus]           = useState<StatusFilter>("ALL");
  const [ownerDateFrom,         setOwnerDateFrom]         = useState("");
  const [ownerDateTo,           setOwnerDateTo]           = useState("");
  const [ownerRegistrationType, setOwnerRegType]          = useState<"ALL" | "SELF" | "PRE_REG">("ALL");
  const [ownerFiltersOpen,      setOwnerFiltersOpen]      = useState(false);

  const [familySearch,      setFamilySearch]      = useState("");
  const [familyStatus,      setFamilyStatus]      = useState<StatusFilter>("PENDING");
  const [familyDateFrom,    setFamilyDateFrom]    = useState("");
  const [familyDateTo,      setFamilyDateTo]      = useState("");
  const [familyRelationship,setFamilyRel]         = useState<"ALL" | FamilyRelationship>("ALL");
  const [familyFiltersOpen, setFamilyFiltersOpen] = useState(false);

  const [delegateSearch,     setDelegateSearch]     = useState("");
  const [delegateStatus,     setDelegateStatus]     = useState<StatusFilter>("PENDING");
  const [delegateDateFrom,   setDelegateDateFrom]   = useState("");
  const [delegateDateTo,     setDelegateDateTo]     = useState("");
  const [delegateFeeMode,    setDelegateFeeMode]    = useState<"ALL" | DelegateFeeMode>("ALL");
  const [delegateFiltersOpen,setDelegateFiltersOpen]= useState(false);

  const [homeStaffSearch,     setHSSearch]          = useState("");
  const [homeStaffStatus,     setHSStatus]          = useState<StatusFilter>("PENDING");
  const [homeStaffDateFrom,   setHSDateFrom]        = useState("");
  const [homeStaffDateTo,     setHSDateTo]          = useState("");
  const [homeStaffType,       setHSType]            = useState<"ALL" | HomeStaffType>("ALL");
  const [homeStaffFiltersOpen,setHSFiltersOpen]     = useState(false);

  // Review drawer
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [actionBusy,   setActionBusy]   = useState(false);
  const [rejectMode,   setRejectMode]   = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Document previews
  const [previewByUrl, setPreviewByUrl] = useState<Record<string, PreviewState>>({});
  const previewByUrlRef = useRef<Record<string, PreviewState>>({});
  const createdObjectUrls = useRef<string[]>([]);

  useEffect(() => { previewByUrlRef.current = previewByUrl; }, [previewByUrl]);
  useEffect(() => () => { createdObjectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // ── Loaders ──────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await approvalsService.getStats()); }
    catch (e) { toast.error("Failed to load stats", { description: errorMessage(e) }); }
    finally { setStatsLoading(false); }
  }, []);

  const loadOwners = useCallback(async () => {
    setOL(true);
    try { setOwners(await approvalsService.listOwners({ search: ownerSearch || undefined, status: ownerStatus, dateFrom: ownerDateFrom || undefined, dateTo: ownerDateTo || undefined, registrationType: ownerRegistrationType === "ALL" ? undefined : ownerRegistrationType })); }
    catch (e) { toast.error("Failed to load owner approvals", { description: errorMessage(e) }); }
    finally { setOL(false); }
  }, [ownerDateFrom, ownerDateTo, ownerRegistrationType, ownerSearch, ownerStatus]);

  const loadFamily = useCallback(async () => {
    setFL(true);
    try { setFamily(await approvalsService.listFamilyMembers({ search: familySearch || undefined, status: familyStatus === "ALL" || familyStatus === "PROCESSING" ? undefined : familyStatus, dateFrom: familyDateFrom || undefined, dateTo: familyDateTo || undefined, relationship: familyRelationship === "ALL" ? undefined : familyRelationship })); }
    catch (e) { toast.error("Failed to load family approvals", { description: errorMessage(e) }); }
    finally { setFL(false); }
  }, [familyDateFrom, familyDateTo, familyRelationship, familySearch, familyStatus]);

  const loadDelegates = useCallback(async () => {
    setDL(true);
    try { setDelegates(await approvalsService.listDelegates({ search: delegateSearch || undefined, status: delegateStatus === "ALL" || delegateStatus === "PROCESSING" ? undefined : delegateStatus, dateFrom: delegateDateFrom || undefined, dateTo: delegateDateTo || undefined, feeMode: delegateFeeMode === "ALL" ? undefined : delegateFeeMode })); }
    catch (e) { toast.error("Failed to load delegate approvals", { description: errorMessage(e) }); }
    finally { setDL(false); }
  }, [delegateDateFrom, delegateDateTo, delegateFeeMode, delegateSearch, delegateStatus]);

  const loadHomeStaff = useCallback(async () => {
    setHL(true);
    try { setHomeStaff(await approvalsService.listHomeStaff({ search: homeStaffSearch || undefined, status: homeStaffStatus === "ALL" || homeStaffStatus === "PROCESSING" ? undefined : homeStaffStatus, dateFrom: homeStaffDateFrom || undefined, dateTo: homeStaffDateTo || undefined, staffType: homeStaffType === "ALL" ? undefined : homeStaffType })); }
    catch (e) { toast.error("Failed to load home staff approvals", { description: errorMessage(e) }); }
    finally { setHL(false); }
  }, [homeStaffDateFrom, homeStaffDateTo, homeStaffSearch, homeStaffStatus, homeStaffType]);


  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => {
    if (activeTab === "owners")      void loadOwners();
    if (activeTab === "family")      void loadFamily();
    if (activeTab === "delegates")   void loadDelegates();
    if (activeTab === "home-staff")  void loadHomeStaff();
  }, [activeTab, loadOwners, loadFamily, loadDelegates, loadHomeStaff]);

  // ── Document preview ──────────────────────────────────────────

  const ensurePreview = useCallback(async (url: string) => {
    if (!url) return;
    const cur = previewByUrlRef.current[url];
    if (cur?.loading || cur?.objectUrl || cur?.error) return;
    setPreviewByUrl((p) => { const e = p[url]; if (e?.loading || e?.objectUrl || e?.error) return p; const n = { ...p, [url]: { loading: true, objectUrl: null, mimeType: null, error: null } }; previewByUrlRef.current = n; return n; });
    try {
      const blob = await approvalsService.fetchDocumentBlob(url);
      const objectUrl = URL.createObjectURL(blob);
      createdObjectUrls.current.push(objectUrl);
      setPreviewByUrl((p) => { const n = { ...p, [url]: { loading: false, objectUrl, mimeType: blob.type || null, error: null } }; previewByUrlRef.current = n; return n; });
    } catch (e) {
      setPreviewByUrl((p) => { const n = { ...p, [url]: { loading: false, objectUrl: null, mimeType: null, error: errorMessage(e) } }; previewByUrlRef.current = n; return n; });
    }
  }, []);

  const selectedBaseItem = selectedItem?.item ?? null;
  useEffect(() => { collectDocumentUrls(selectedBaseItem).forEach((u) => void ensurePreview(u)); }, [ensurePreview, selectedBaseItem]);

  const openDocument = useCallback(async (url: string) => {
    const preview = previewByUrl[url];
    if (preview?.objectUrl) { window.open(preview.objectUrl, "_blank", "noopener,noreferrer"); return; }
    try { const blob = await approvalsService.fetchDocumentBlob(url); const u = URL.createObjectURL(blob); createdObjectUrls.current.push(u); window.open(u, "_blank", "noopener,noreferrer"); }
    catch (e) { toast.error("Failed to open document", { description: errorMessage(e) }); }
  }, [previewByUrl]);

  // ── Optimistic updates ────────────────────────────────────────

  const removeOptimistically = useCallback((tab: TabKey, id: string) => {
    let ownerRow: OwnerApprovalItem | null = null, familyRow: FamilyApprovalItem | null = null, delegateRow: DelegateApprovalItem | null = null, staffRow: HomeStaffApprovalItem | null = null;
    if (tab === "owners")      setOwners((p)     => { ownerRow    = p.find((r) => r.id === id) ?? null; return p.filter((r) => r.id !== id); });
    if (tab === "family")      setFamily((p)     => { familyRow   = p.find((r) => r.id === id) ?? null; return p.filter((r) => r.id !== id); });
    if (tab === "delegates")   setDelegates((p)  => { delegateRow = p.find((r) => r.id === id) ?? null; return p.filter((r) => r.id !== id); });
    if (tab === "home-staff")  setHomeStaff((p)  => { staffRow    = p.find((r) => r.id === id) ?? null; return p.filter((r) => r.id !== id); });
    setStats((p) => {
      if (!p) return p;
      if (tab === "owners")     return { ...p, pendingOwners: Math.max(0, p.pendingOwners - 1), totalPending: Math.max(0, p.totalPending - 1) };
      if (tab === "family")     return { ...p, pendingFamilyMembers: Math.max(0, p.pendingFamilyMembers - 1), totalPending: Math.max(0, p.totalPending - 1) };
      if (tab === "delegates")  return { ...p, pendingDelegates: Math.max(0, p.pendingDelegates - 1), totalPending: Math.max(0, p.totalPending - 1) };
      return { ...p, pendingHomeStaff: Math.max(0, p.pendingHomeStaff - 1), totalPending: Math.max(0, p.totalPending - 1) };
    });
    return () => {
      if (tab === "owners"     && ownerRow)    setOwners((p)    => [ownerRow!,    ...p]);
      if (tab === "family"     && familyRow)   setFamily((p)    => [familyRow!,   ...p]);
      if (tab === "delegates"  && delegateRow) setDelegates((p) => [delegateRow!, ...p]);
      if (tab === "home-staff" && staffRow)    setHomeStaff((p) => [staffRow!,    ...p]);
      setStats((p) => {
        if (!p) return p;
        if (tab === "owners")     return { ...p, pendingOwners: p.pendingOwners + 1, totalPending: p.totalPending + 1 };
        if (tab === "family")     return { ...p, pendingFamilyMembers: p.pendingFamilyMembers + 1, totalPending: p.totalPending + 1 };
        if (tab === "delegates")  return { ...p, pendingDelegates: p.pendingDelegates + 1, totalPending: p.totalPending + 1 };
        return { ...p, pendingHomeStaff: p.pendingHomeStaff + 1, totalPending: p.totalPending + 1 };
      });
    };
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selectedItem) return;
    if (!window.confirm("Approve and send credentials?")) return;
    setActionBusy(true);
    const rollback = removeOptimistically(selectedItem.tab, selectedItem.item.id);
    try {
      if (selectedItem.tab === "owners")     await approvalsService.approveOwner(selectedItem.item.id);
      if (selectedItem.tab === "family")     await approvalsService.approveFamilyMember(selectedItem.item.id);
      if (selectedItem.tab === "delegates")  await approvalsService.approveDelegate(selectedItem.item.id);
      if (selectedItem.tab === "home-staff") await approvalsService.approveHomeStaff(selectedItem.item.id);
      toast.success("Approval completed"); setDrawerOpen(false); setSelectedItem(null); setRejectMode(false); setRejectReason("");
    } catch (e) { rollback(); toast.error("Approval failed", { description: errorMessage(e) }); }
    finally { setActionBusy(false); }
  }, [removeOptimistically, selectedItem]);

  const handleReject = useCallback(async () => {
    if (!selectedItem) return;
    if (!rejectReason.trim()) { toast.error("Rejection reason is required"); return; }
    setActionBusy(true);
    const rollback = removeOptimistically(selectedItem.tab, selectedItem.item.id);
    try {
      if (selectedItem.tab === "owners")     await approvalsService.rejectOwner(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "family")     await approvalsService.rejectFamilyMember(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "delegates")  await approvalsService.rejectDelegate(selectedItem.item.id, rejectReason.trim());
      if (selectedItem.tab === "home-staff") await approvalsService.rejectHomeStaff(selectedItem.item.id, rejectReason.trim());
      toast.success("Request rejected"); setDrawerOpen(false); setSelectedItem(null); setRejectMode(false); setRejectReason("");
    } catch (e) { rollback(); toast.error("Rejection failed", { description: errorMessage(e) }); }
    finally { setActionBusy(false); }
  }, [rejectReason, removeOptimistically, selectedItem]);

  const openReview = useCallback((item: SelectedItem) => { setSelectedItem(item); setDrawerOpen(true); setRejectMode(false); setRejectReason(""); }, []);

  // ── Columns ───────────────────────────────────────────────────

  const ownerColumns = useMemo<DataTableColumn<OwnerApprovalItem>[]>(() => [
    { key: "name",      header: "Name",      render: (r) => <span style={{ fontWeight: 600, color: "#111827" }}>{r.name || "Unknown"}</span> },
    { key: "phone",     header: "Phone",     render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.phone}</span> },
    { key: "nationalId",header: "Nat. ID",   render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "#6B7280" }}>{r.nationalId}</span> },
    { key: "submitted", header: "Submitted", render: (r) => <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{formatDateTime(r.submittedAt)}</span> },
    { key: "type",      header: "Type",      render: (r) => <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: r.isPreRegistration ? "#EFF6FF" : "#F3F4F6", color: r.isPreRegistration ? "#1D4ED8" : "#6B7280" }}>{r.isPreRegistration ? "Pre-reg" : "Self"}</span> },
    { key: "status",    header: "Status",    render: (r) => <StatusBadge value={r.status} /> },
    { key: "actions",   header: "",          render: (r) => <ReviewBtn onClick={() => openReview({ tab: "owners", item: r })} /> },
  ], [openReview]);

  const familyColumns = useMemo<DataTableColumn<FamilyApprovalItem>[]>(() => [
    { key: "name",         header: "Name",         render: (r) => <span style={{ fontWeight: 600, color: "#111827" }}>{r.fullName}</span> },
    { key: "phone",        header: "Phone",        render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.phone}</span> },
    { key: "relationship", header: "Relationship", render: (r) => <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: "#F0FDFA", color: "#0D9488" }}>{humanizeEnum(r.relationship)}</span> },
    { key: "owner",        header: "Owner",        render: (r) => r.ownerName },
    { key: "unit",         header: "Unit",         render: (r) => <span style={{ fontSize: "12px", color: "#6B7280" }}>{buildUnitLabel(r.projectName, r.unitNumber)}</span> },
    { key: "submitted",    header: "Submitted",    render: (r) => <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{formatDateTime(r.submittedAt)}</span> },
    { key: "status",       header: "Status",       render: (r) => <StatusBadge value={r.status} /> },
    { key: "actions",      header: "",             render: (r) => <ReviewBtn onClick={() => openReview({ tab: "family", item: r })} /> },
  ], [openReview]);

  const delegateColumns = useMemo<DataTableColumn<DelegateApprovalItem>[]>(() => [
    { key: "name",    header: "Name",       render: (r) => <span style={{ fontWeight: 600, color: "#111827" }}>{r.fullName}</span> },
    { key: "phone",   header: "Phone",      render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.phone}</span> },
    { key: "owner",   header: "Owner",      render: (r) => r.ownerName },
    { key: "unit",    header: "Unit",       render: (r) => <span style={{ fontSize: "12px", color: "#6B7280" }}>{buildUnitLabel(r.projectName, r.unitNumber)}</span> },
    { key: "period",  header: "Valid Period",render: (r) => <span style={{ fontSize: "11.5px", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>{formatDate(r.validFrom)} → {formatDate(r.validTo)}</span> },
    { key: "fee",     header: "Fee",        render: (r) => <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: "#FFF1F2", color: "#BE185D" }}>{humanizeEnum(r.feeMode)}</span> },
    { key: "status",  header: "Status",     render: (r) => <StatusBadge value={r.status} /> },
    { key: "actions", header: "",           render: (r) => <ReviewBtn onClick={() => openReview({ tab: "delegates", item: r })} /> },
  ], [openReview]);

  const homeStaffColumns = useMemo<DataTableColumn<HomeStaffApprovalItem>[]>(() => [
    { key: "name",   header: "Name",        render: (r) => <span style={{ fontWeight: 600, color: "#111827" }}>{r.fullName}</span> },
    { key: "type",   header: "Staff Type",  render: (r) => <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: "#F5F3FF", color: "#7C3AED" }}>{humanizeEnum(r.staffType)}</span> },
    { key: "phone",  header: "Phone",       render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.phone}</span> },
    { key: "owner",  header: "Owner",       render: (r) => r.ownerName },
    { key: "unit",   header: "Unit",        render: (r) => <span style={{ fontSize: "12px", color: "#6B7280" }}>{buildUnitLabel(r.projectName, r.unitNumber)}</span> },
    { key: "period", header: "Access",      render: (r) => <span style={{ fontSize: "11.5px", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>{formatDate(r.accessValidFrom)} → {formatDate(r.accessValidTo)}</span> },
    { key: "liveIn", header: "Live-In",     render: (r) => <span style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "10.5px", fontWeight: 700, background: r.isLiveIn ? "#ECFDF5" : "#F3F4F6", color: r.isLiveIn ? "#065F46" : "#6B7280" }}>{r.isLiveIn ? "Live-In" : "Day"}</span> },
    { key: "status", header: "Status",      render: (r) => <StatusBadge value={r.status} /> },
    { key: "actions",header: "",            render: (r) => <ReviewBtn onClick={() => openReview({ tab: "home-staff", item: r })} /> },
  ], [openReview]);

  // ── Tab content factory ───────────────────────────────────────

  const getItemName = (item: SelectedItem): string => {
    if (item.tab === "owners")  return item.item.name || "Owner";
    return (item.item as FamilyApprovalItem | DelegateApprovalItem | HomeStaffApprovalItem).fullName;
  };

  const getItemPhone = (item: SelectedItem): string => {
    return (item.item as OwnerApprovalItem | FamilyApprovalItem | DelegateApprovalItem | HomeStaffApprovalItem).phone;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── Page header ────────────────────────────────────── */}
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Approvals</h1>
        <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Unified queue — owners, family, delegates, and home staff.</p>
      </div>

      {/* ── Stat cards (horizontal) ────────────────────────── */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", overflowX: "auto", paddingBottom: "2px" }}>
        {(["owners", "family", "delegates", "home-staff"] as TabKey[]).map((tab) => (
          <ApprovalStatCard key={tab} tab={tab} stats={stats} statsLoading={statsLoading} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
        ))}
      </div>

      {/* ── Custom tab bar ────────────────────────────────── */}
      <div style={{ display: "flex", gap: "2px", padding: "4px", borderRadius: "10px", background: "#F3F4F6", marginBottom: "16px", overflowX: "auto" }}>
        {(["owners", "family", "delegates", "home-staff"] as TabKey[]).map((tab) => {
          const meta   = TAB_META[tab];
          const active = activeTab === tab;
          const count  = stats ? (stats[meta.statsKey] ?? 0) : null;
          return (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "7px", border: "none", background: active ? "#FFF" : "transparent", color: active ? "#111827" : "#9CA3AF", cursor: "pointer", fontSize: "12.5px", fontWeight: active ? 700 : 500, transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif", flexShrink: 0, boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              <span style={{ color: active ? meta.accent : "#D1D5DB" }}>{meta.icon}</span>
              {meta.label}
              {count !== null && count > 0 && (
                <span style={{ fontSize: "9.5px", fontWeight: 700, padding: "1px 5px", borderRadius: "10px", background: active ? meta.accent : "#E5E7EB", color: active ? "#FFF" : "#6B7280", fontFamily: "'DM Mono', monospace" }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ══ Tab panels ══════════════════════════════════════ */}

      {/* ── Owners ─────────────────────────────────────────── */}
      {activeTab === "owners" && (
        <FilterBar open={ownerFiltersOpen} onToggle={() => setOwnerFiltersOpen((p) => !p)}
          activeCount={[ownerStatus !== "ALL", ownerDateFrom, ownerDateTo, ownerRegistrationType !== "ALL"].filter(Boolean).length}>
          <input placeholder="Search name or phone…" value={ownerSearch} onChange={(e) => setOwnerSearch(e.target.value)} style={{ ...inputStyle, border: "none", background: "transparent", padding: "0" }} />
          <input type="date" value={ownerDateFrom} onChange={(e) => setOwnerDateFrom(e.target.value)} style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <input type="date" value={ownerDateTo}   onChange={(e) => setOwnerDateTo(e.target.value)}   style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <select value={ownerStatus} onChange={(e) => setOwnerStatus(e.target.value as StatusFilter)} style={{ ...selectStyle, width: "130px" }}>
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
          </select>
          <select value={ownerRegistrationType} onChange={(e) => setOwnerRegType(e.target.value as "ALL"|"SELF"|"PRE_REG")} style={{ ...selectStyle, width: "130px" }}>
            <option value="ALL">All Types</option>
            <option value="SELF">Self</option>
            <option value="PRE_REG">Pre-reg</option>
          </select>
        </FilterBar>
      )}
      {activeTab === "owners" && <DataTable columns={ownerColumns} rows={owners} rowKey={(r) => r.id} loading={ownersLoading} emptyTitle="No owner approvals" emptyDescription="No owner registration matches current filters." />}

      {/* ── Family ─────────────────────────────────────────── */}
      {activeTab === "family" && (
        <FilterBar open={familyFiltersOpen} onToggle={() => setFamilyFiltersOpen((p) => !p)}
          activeCount={[familyStatus !== "PENDING", familyDateFrom, familyDateTo, familyRelationship !== "ALL"].filter(Boolean).length}>
          <input placeholder="Search name or phone…" value={familySearch} onChange={(e) => setFamilySearch(e.target.value)} style={{ ...inputStyle, border: "none", background: "transparent", padding: "0" }} />
          <input type="date" value={familyDateFrom} onChange={(e) => setFamilyDateFrom(e.target.value)} style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <input type="date" value={familyDateTo}   onChange={(e) => setFamilyDateTo(e.target.value)}   style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <select value={familyStatus} onChange={(e) => setFamilyStatus(e.target.value as StatusFilter)} style={{ ...selectStyle, width: "130px" }}>
            <option value="PENDING">Pending</option>
            <option value="ALL">All</option>
          </select>
          <select value={familyRelationship} onChange={(e) => setFamilyRel(e.target.value as "ALL"|FamilyRelationship)} style={{ ...selectStyle, width: "150px" }}>
            <option value="ALL">All Relationships</option>
            {RELATIONSHIP_OPTIONS.map((v) => <option key={v} value={v}>{humanizeEnum(v)}</option>)}
          </select>
        </FilterBar>
      )}
      {activeTab === "family" && <DataTable columns={familyColumns} rows={family} rowKey={(r) => r.id} loading={familyLoading} emptyTitle="No family approvals" />}

      {/* ── Delegates ──────────────────────────────────────── */}
      {activeTab === "delegates" && (
        <FilterBar open={delegateFiltersOpen} onToggle={() => setDelegateFiltersOpen((p) => !p)}
          activeCount={[delegateStatus !== "PENDING", delegateDateFrom, delegateDateTo, delegateFeeMode !== "ALL"].filter(Boolean).length}>
          <input placeholder="Search name or phone…" value={delegateSearch} onChange={(e) => setDelegateSearch(e.target.value)} style={{ ...inputStyle, border: "none", background: "transparent", padding: "0" }} />
          <input type="date" value={delegateDateFrom} onChange={(e) => setDelegateDateFrom(e.target.value)} style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <input type="date" value={delegateDateTo}   onChange={(e) => setDelegateDateTo(e.target.value)}   style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <select value={delegateStatus} onChange={(e) => setDelegateStatus(e.target.value as StatusFilter)} style={{ ...selectStyle, width: "130px" }}>
            <option value="PENDING">Pending</option>
            <option value="ALL">All</option>
          </select>
          <select value={delegateFeeMode} onChange={(e) => setDelegateFeeMode(e.target.value as "ALL"|DelegateFeeMode)} style={{ ...selectStyle, width: "150px" }}>
            <option value="ALL">All Fee Modes</option>
            {DELEGATE_FEE_MODES.map((v) => <option key={v} value={v}>{humanizeEnum(v)}</option>)}
          </select>
        </FilterBar>
      )}
      {activeTab === "delegates" && <DataTable columns={delegateColumns} rows={delegates} rowKey={(r) => r.id} loading={delegatesLoading} emptyTitle="No delegate approvals" />}

      {/* ── Home Staff ──────────────────────────────────────── */}
      {activeTab === "home-staff" && (
        <FilterBar open={homeStaffFiltersOpen} onToggle={() => setHSFiltersOpen((p) => !p)}
          activeCount={[homeStaffStatus !== "PENDING", homeStaffDateFrom, homeStaffDateTo, homeStaffType !== "ALL"].filter(Boolean).length}>
          <input placeholder="Search name or phone…" value={homeStaffSearch} onChange={(e) => setHSSearch(e.target.value)} style={{ ...inputStyle, border: "none", background: "transparent", padding: "0" }} />
          <input type="date" value={homeStaffDateFrom} onChange={(e) => setHSDateFrom(e.target.value)} style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <input type="date" value={homeStaffDateTo}   onChange={(e) => setHSDateTo(e.target.value)}   style={{ ...inputStyle, width: "130px", border: "none", background: "transparent" }} />
          <select value={homeStaffStatus} onChange={(e) => setHSStatus(e.target.value as StatusFilter)} style={{ ...selectStyle, width: "130px" }}>
            <option value="PENDING">Pending</option>
            <option value="ALL">All</option>
          </select>
          <select value={homeStaffType} onChange={(e) => setHSType(e.target.value as "ALL"|HomeStaffType)} style={{ ...selectStyle, width: "150px" }}>
            <option value="ALL">All Staff Types</option>
            {HOME_STAFF_TYPES.map((v) => <option key={v} value={v}>{humanizeEnum(v)}</option>)}
          </select>
        </FilterBar>
      )}
      {activeTab === "home-staff" && <DataTable columns={homeStaffColumns} rows={homeStaff} rowKey={(r) => r.id} loading={homeStaffLoading} emptyTitle="No home staff approvals" />}

      {/* ══ Review drawer ════════════════════════════════════ */}
      <DrawerForm
        open={drawerOpen}
        onOpenChange={(o) => { setDrawerOpen(o); if (!o) { setRejectMode(false); setRejectReason(""); } }}
        title="Review Request"
        description="Review applicant details, documents, and take action."
        widthClassName="w-full sm:max-w-[540px]"
        footer={
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            {rejectMode && (
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason…"
                style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #FECACA", fontSize: "13px", minHeight: "80px", resize: "vertical", fontFamily: "'Work Sans', sans-serif", outline: "none", background: "#FFF", boxSizing: "border-box" }} />
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              {rejectMode ? (
                <>
                  <GhostBtn label="Cancel" onClick={() => setRejectMode(false)} />
                  <RejectBtn onClick={() => void handleReject()} busy={actionBusy} confirm />
                </>
              ) : (
                <>
                  <RejectBtn onClick={() => setRejectMode(true)} busy={false} />
                  <ApproveBtn onClick={() => void handleApprove()} busy={actionBusy} />
                </>
              )}
            </div>
          </div>
        }
      >
        {selectedItem ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: "'Work Sans', sans-serif" }}>
            {/* Profile header */}
            <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", overflow: "hidden" }}>
              <div style={{ height: "4px", background: `linear-gradient(90deg, ${TAB_META[selectedItem.tab].accent}, ${TAB_META[selectedItem.tab].accent}88)` }} />
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `${TAB_META[selectedItem.tab].accent}18`, border: `1.5px solid ${TAB_META[selectedItem.tab].accent}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: TAB_META[selectedItem.tab].accent }}>{toInitials(getItemName(selectedItem))}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>{getItemName(selectedItem)}</p>
                  <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "3px 0 0", fontFamily: "'DM Mono', monospace" }}>{getItemPhone(selectedItem)}</p>
                </div>
                <StatusBadge value={selectedItem.item.status ?? "PENDING"} />
              </div>
              <div style={{ padding: "8px 16px", borderTop: "1px solid #F3F4F6", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Submitted {formatDateTime(selectedItem.item.submittedAt)}</span>
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 7px", borderRadius: "4px", background: selectedItem.item.isPreRegistration ? "#EFF6FF" : "#F3F4F6", color: selectedItem.item.isPreRegistration ? "#1D4ED8" : "#6B7280" }}>
                  {selectedItem.item.isPreRegistration ? "Pre-Registered" : "Self-Registered"}
                </span>
              </div>
            </div>

            {/* Documents */}
            <div>
              <p style={{ fontSize: "11.5px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Documents</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <DocCard label="Photo"      url={selectedItem.item.documents.photo}      preview={selectedItem.item.documents.photo      ? previewByUrl[selectedItem.item.documents.photo]      : undefined} onOpen={() => selectedItem.item.documents.photo      && void openDocument(selectedItem.item.documents.photo)} />
                  <DocCard label="National ID" url={selectedItem.item.documents.nationalId} preview={selectedItem.item.documents.nationalId ? previewByUrl[selectedItem.item.documents.nationalId] : undefined} onOpen={() => selectedItem.item.documents.nationalId && void openDocument(selectedItem.item.documents.nationalId)} />
                  <DocCard label="Passport"   url={selectedItem.item.documents.passport}   preview={selectedItem.item.documents.passport   ? previewByUrl[selectedItem.item.documents.passport]   : undefined} onOpen={() => selectedItem.item.documents.passport   && void openDocument(selectedItem.item.documents.passport)} />
                  {selectedItem.item.documents.other.map((doc) => (
                    <DocCard key={doc.url} label={doc.label} url={doc.url} preview={previewByUrl[doc.url]} onOpen={() => void openDocument(doc.url)} />
                  ))}
                </div>
              </div>

            {/* Details */}
            <div>
              <p style={{ fontSize: "11.5px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Details</p>
              <div style={{ borderRadius: "9px", border: "1px solid #EBEBEB", overflow: "hidden" }}>
                {selectedItem.tab === "owners" && <>
                  <DetailRow label="Nat. ID"  value={<span style={{ fontFamily: "'DM Mono', monospace" }}>{selectedItem.item.nationalId}</span>} />
                  <DetailRow label="Origin"   value={selectedItem.item.origin} />
                  <DetailRow label="Expires"  value={formatDateTime(selectedItem.item.expiresAt)} />
                </>}
                {selectedItem.tab === "family" && <>
                  <DetailRow label="Relationship" value={humanizeEnum(selectedItem.item.relationship)} />
                  <DetailRow label="Owner"        value={selectedItem.item.ownerName} />
                  <DetailRow label="Unit"         value={buildUnitLabel(selectedItem.item.projectName, selectedItem.item.unitNumber)} />
                  <DetailRow label="Permissions"  value={selectedItem.item.featurePermissions ? Object.keys(selectedItem.item.featurePermissions).join(", ") || "None" : "None"} />
                </>}
                {selectedItem.tab === "delegates" && <>
                  <DetailRow label="Owner"     value={selectedItem.item.ownerName} />
                  <DetailRow label="Unit"      value={buildUnitLabel(selectedItem.item.projectName, selectedItem.item.unitNumber)} />
                  <DetailRow label="Valid"     value={`${formatDate(selectedItem.item.validFrom)} → ${formatDate(selectedItem.item.validTo)}`} />
                  <DetailRow label="QR Scopes" value={selectedItem.item.qrScopes.length ? selectedItem.item.qrScopes.join(", ") : "None"} />
                  <DetailRow label="Fee"       value={`${humanizeEnum(selectedItem.item.feeMode)}${selectedItem.item.feeAmount !== null ? ` (${formatCurrencyEGP(selectedItem.item.feeAmount)})` : ""}`} />
                </>}
                {selectedItem.tab === "home-staff" && <>
                  <DetailRow label="Staff Type"  value={humanizeEnum(selectedItem.item.staffType)} />
                  <DetailRow label="Owner"       value={selectedItem.item.ownerName} />
                  <DetailRow label="Unit"        value={buildUnitLabel(selectedItem.item.projectName, selectedItem.item.unitNumber)} />
                  <DetailRow label="Live-In"     value={selectedItem.item.isLiveIn ? "Yes" : "No"} />
                  <DetailRow label="Employment"  value={`${selectedItem.item.employmentFrom ? formatDate(selectedItem.item.employmentFrom) : "N/A"} → ${selectedItem.item.employmentTo ? formatDate(selectedItem.item.employmentTo) : "N/A"}`} />
                  <DetailRow label="Access"      value={`${formatDate(selectedItem.item.accessValidFrom)} → ${formatDate(selectedItem.item.accessValidTo)}`} />
                </>}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="No request selected" description="Select a row from the approvals table to review details." />
        )}
      </DrawerForm>
    </div>
  );
}