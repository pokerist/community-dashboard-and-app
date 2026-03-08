import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown, RefreshCw, Search, SlidersHorizontal,
  User, UserCheck, X, Plus,
} from "lucide-react";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import usersService, {
  Broker, DelegateListItem, FamilyMemberListItem, HomeStaffListItem,
  HouseholdRequestStatus, OwnerListItem, SystemUserListItem, TenantListItem,
  UserDetailResponse, UserStatus, UserStats,
} from "../../lib/users-service";
import commercialService, { CommercialDirectoryUser } from "../../lib/commercial-service";
import compoundStaffService, { CompoundStaff, CompoundStaffStatus } from "../../lib/compound-staff-service";
import { errorMessage } from "../../lib/live-data";

// ─── Types & constants ────────────────────────────────────────

type UsersTabKey =
  | "owners" | "family-members" | "tenants" | "home-staff"
  | "delegates" | "brokers" | "commercial" | "compound-staff" | "system-users";

const ALL_TABS: Array<{ key: UsersTabKey; label: string }> = [
  { key: "owners",         label: "Owners"         },
  { key: "family-members", label: "Family Members" },
  { key: "tenants",        label: "Tenants"        },
  { key: "home-staff",     label: "Home Staff"     },
  { key: "delegates",      label: "Delegates"      },
  { key: "brokers",        label: "Brokers"        },
  { key: "commercial",     label: "Commercial"     },
  { key: "compound-staff", label: "Compound Staff" },
  { key: "system-users",   label: "System Users"   },
];

const USER_STATUS_OPTIONS      = [{ value:"all",label:"All statuses" },{ value:"ACTIVE",label:"Active" },{ value:"SUSPENDED",label:"Suspended" },{ value:"PENDING",label:"Pending" },{ value:"INVITED",label:"Invited" },{ value:"DISABLED",label:"Disabled" }];
const HOUSEHOLD_STATUS_OPTIONS = [{ value:"all",label:"All statuses" },{ value:"APPROVED",label:"Approved" },{ value:"PENDING",label:"Pending" },{ value:"REJECTED",label:"Rejected" },{ value:"CANCELLED",label:"Cancelled" }];
const LEASE_STATUS_OPTIONS     = [{ value:"all",label:"All lease statuses" },{ value:"ACTIVE",label:"Active" },{ value:"EXPIRING_SOON",label:"Expiring Soon" },{ value:"EXPIRED",label:"Expired" },{ value:"TERMINATED",label:"Terminated" }];
const STAFF_TYPE_OPTIONS       = [{ value:"all",label:"All staff types" },{ value:"DRIVER",label:"Driver" },{ value:"NANNY",label:"Nanny" },{ value:"SERVANT",label:"Servant" },{ value:"GARDENER",label:"Gardener" },{ value:"OTHER",label:"Other" }];
const COMMERCIAL_STATUS_OPTIONS= [{ value:"all",label:"All statuses" },{ value:"ACTIVE",label:"Active" },{ value:"INACTIVE",label:"Inactive" }];

// ─── Style tokens ─────────────────────────────────────────────

const ff     = "'Work Sans', sans-serif";
const ffMono = "'DM Mono', monospace";

const inputBase: React.CSSProperties = {
  height: "36px", borderRadius: "7px", border: "1px solid #E5E7EB",
  background: "#FFF", fontFamily: ff, fontSize: "12.5px", color: "#111827",
  outline: "none", padding: "0 10px", boxSizing: "border-box", width: "100%",
};
const selectStyle: React.CSSProperties  = { ...inputBase, cursor: "pointer" };
const textareaStyle: React.CSSProperties = { ...inputBase, height: "auto", resize: "vertical", padding: "8px 10px" };

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}
function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
function formatCurrency(v: number | null) {
  if (v == null || isNaN(v)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
function avatarFallback(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0,2).map((p) => p[0]?.toUpperCase()).join("") || "NA";
}

// ─── Avatar bubble ────────────────────────────────────────────

function AvatarBubble({ name, src }: { name: string; src?: string | null }) {
  const colors = ["#EFF6FF:#1D4ED8","#ECFDF5:#059669","#FEF2F2:#B91C1C","#FFF7ED:#C2410C","#F5F3FF:#6D28D9"];
  const idx = name.charCodeAt(0) % colors.length;
  const [bg, color] = colors[idx].split(":");
  return src
    ? <img src={src} alt={name} style={{ width:"34px", height:"34px", borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
    : <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:bg, color, fontSize:"12px", fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:ff }}>{avatarFallback(name)}</div>;
}

// ─── Generic table ────────────────────────────────────────────

type Col<T> = { key: string; header: string; render: (row: T) => React.ReactNode; mono?: boolean };

function DataGrid<T>({ cols, rows, rowKey, loading }: { cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; loading: boolean }) {
  if (loading) return (
    <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden" }}>
      {Array.from({length:7}).map((_,i) => (
        <div key={i} style={{ display:"flex", gap:"12px", padding:"12px 14px", borderBottom:"1px solid #F9FAFB" }}>
          {[60,180,140,100,80,80,100].map((w,j) => (
            <div key={j} style={{ height:"14px", borderRadius:"4px", width:w, background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite" }} />
          ))}
        </div>
      ))}
    </div>
  );
  if (!rows.length) return <EmptyState title="No results found" description="Try adjusting your filters or search term." />;

  return (
    <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols.length}, minmax(80px,1fr))`, gap:"8px", padding:"9px 14px", background:"#FAFAFA", borderBottom:"1px solid #F3F4F6" }}>
        {cols.map((c) => (
          <span key={c.key} style={{ fontSize:"10.5px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>{c.header}</span>
        ))}
      </div>
      {/* Rows */}
      {rows.map((row) => (
        <div key={rowKey(row)}
          style={{ display:"grid", gridTemplateColumns:`repeat(${cols.length}, minmax(80px,1fr))`, gap:"8px", padding:"10px 14px", borderBottom:"1px solid #F9FAFB", transition:"background 100ms", alignItems:"center" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
          {cols.map((c) => (
            <div key={c.key} style={{ fontSize:"12.5px", color:"#374151", fontFamily:c.mono?ffMono:ff, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {c.render(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────

function ActionBtn({ label, onClick, variant = "default" }: { label: string; onClick: () => void; variant?: "default" | "danger" | "success" }) {
  const colors = variant === "danger"  ? { bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA" }
               : variant === "success" ? { bg:"#ECFDF5", color:"#059669", border:"#A7F3D0" }
               :                         { bg:"#FFF",    color:"#374151", border:"#E5E7EB" };
  return (
    <button type="button" onClick={onClick}
      style={{ padding:"5px 10px", borderRadius:"6px", border:`1px solid ${colors.border}`, background:colors.bg, color:colors.color, fontSize:"11.5px", fontWeight:600, cursor:"pointer", fontFamily:ff, whiteSpace:"nowrap", transition:"all 100ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}>
      {label}
    </button>
  );
}

// ─── Field row (for drawers) ──────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"130px 1fr", gap:"8px", padding:"7px 0", borderBottom:"1px solid #F9FAFB", fontSize:"12.5px" }}>
      <span style={{ color:"#9CA3AF", fontFamily:ff, fontWeight:600 }}>{label}</span>
      <span style={{ color:"#374151", fontFamily:ff }}>{value || "—"}</span>
    </div>
  );
}

// ─── Drawer field input ───────────────────────────────────────

function DrawerField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
      <label style={{ fontSize:"10.5px", fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={inputBase} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export function UsersHubPage() {
  const [activeTab,       setActiveTab]       = useState<UsersTabKey>("owners");
  const [search,          setSearch]          = useState("");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [secondaryFilter, setSecondaryFilter] = useState("all");
  const [tableLoading,    setTableLoading]    = useState(false);
  const [statsLoading,    setStatsLoading]    = useState(false);
  const [stats,           setStats]           = useState<UserStats | null>(null);
  const [filtersOpen,     setFiltersOpen]     = useState(false);

  const [owners,          setOwners]          = useState<OwnerListItem[]>([]);
  const [familyMembers,   setFamilyMembers]   = useState<FamilyMemberListItem[]>([]);
  const [tenants,         setTenants]         = useState<TenantListItem[]>([]);
  const [homeStaff,       setHomeStaff]       = useState<HomeStaffListItem[]>([]);
  const [delegates,       setDelegates]       = useState<DelegateListItem[]>([]);
  const [brokers,         setBrokers]         = useState<Broker[]>([]);
  const [systemUsers,     setSystemUsers]     = useState<SystemUserListItem[]>([]);
  const [commercialUsers, setCommercialUsers] = useState<CommercialDirectoryUser[]>([]);
  const [compoundStaff,   setCompoundStaff]   = useState<CompoundStaff[]>([]);

  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userDetail,    setUserDetail]    = useState<UserDetailResponse | null>(null);
  const [detailTab,     setDetailTab]     = useState<"profile" | "activity" | "linked">("profile");

  const [brokerDrawerOpen, setBrokerDrawerOpen] = useState(false);
  const [brokerSaving,     setBrokerSaving]     = useState(false);
  const [editingBroker,    setEditingBroker]    = useState<Broker | null>(null);
  const [brokerForm,       setBrokerForm]       = useState({ name:"", email:"", phone:"", agencyName:"", licenseNumber:"" });

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ALL_TABS.some((t) => t.key === tab)) setActiveTab(tab as UsersTabKey);
    setSearch(params.get("q") ?? "");
    setStatusFilter(params.get("status") ?? "all");
    setSecondaryFilter(params.get("f1") ?? "all");
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", activeTab);
    if (search.trim()) params.set("q", search.trim()); else params.delete("q");
    if (statusFilter !== "all") params.set("status", statusFilter); else params.delete("status");
    if (secondaryFilter !== "all") params.set("f1", secondaryFilter); else params.delete("f1");
    const q = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash || ""}`);
  }, [activeTab, search, secondaryFilter, statusFilter]);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await usersService.getStats()); }
    catch (e) { toast.error("Failed to load stats", { description: errorMessage(e) }); }
    finally { setStatsLoading(false); }
  }, []);

  const loadTabData = useCallback(async () => {
    setTableLoading(true);
    const q = search.trim() || undefined;
    const st = statusFilter === "all" ? undefined : statusFilter;
    try {
      if (activeTab === "owners")         setOwners((await usersService.listOwners({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab === "family-members") setFamilyMembers((await usersService.listFamilyMembers({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab === "tenants")   setTenants((await usersService.listTenants({ page:1,limit:20,search:q,status:st as UserStatus,leaseStatus:secondaryFilter==="all"?undefined:secondaryFilter as any })).items);
      else if (activeTab === "home-staff") setHomeStaff((await usersService.listHomeStaff({ page:1,limit:20,search:q,status:st as HouseholdRequestStatus,staffType:secondaryFilter==="all"?undefined:secondaryFilter as any })).items);
      else if (activeTab === "delegates") setDelegates((await usersService.listDelegates({ page:1,limit:20,search:q,status:st as HouseholdRequestStatus })).items);
      else if (activeTab === "brokers")   setBrokers((await usersService.listBrokers({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab === "system-users") setSystemUsers((await usersService.listSystemUsers({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab === "commercial") {
        const rows = await commercialService.listDirectoryUsers({ includeInactive: statusFilter === "all" || statusFilter === "INACTIVE" });
        const filtered = (statusFilter === "ACTIVE" || statusFilter === "INACTIVE" ? rows.filter((r) => r.status === statusFilter) : rows).filter((r) => !q || [r.userLabel,r.role,r.entityName,r.communityName,r.unitLabel].join(" ").toLowerCase().includes(q.toLowerCase()));
        setCommercialUsers(filtered.slice(0,20));
      } else if (activeTab === "compound-staff") {
        setCompoundStaff((await compoundStaffService.list({ status:st as CompoundStaffStatus, profession:q })).slice(0,20));
      }
    } catch (e) { toast.error("Failed to load data", { description: errorMessage(e) }); }
    finally { setTableLoading(false); }
  }, [activeTab, search, secondaryFilter, statusFilter]);

  useEffect(() => { void refreshStats(); }, [refreshStats]);
  useEffect(() => { void loadTabData();  }, [loadTabData]);

  const openUserDetail = useCallback(async (userId: string) => {
    setDetailOpen(true); setDetailLoading(true); setDetailTab("profile");
    try { setUserDetail(await usersService.getUserDetail(userId)); }
    catch (e) { toast.error("Failed to load profile", { description: errorMessage(e) }); setDetailOpen(false); }
    finally { setDetailLoading(false); }
  }, []);

  const applyStatusLocally = useCallback((userId: string, nextStatus: UserStatus) => {
    setOwners((p) => p.map((r) => r.userId===userId ? {...r,status:nextStatus} : r));
    setFamilyMembers((p) => p.map((r) => r.userId===userId ? {...r,status:nextStatus} : r));
    setTenants((p) => p.map((r) => r.userId===userId ? {...r,status:nextStatus} : r));
    setBrokers((p) => p.map((r) => r.userId===userId ? {...r,status:nextStatus} : r));
    setSystemUsers((p) => p.map((r) => r.userId===userId ? {...r,status:nextStatus} : r));
    setUserDetail((p) => p?.id===userId ? {...p,status:nextStatus} : p);
  }, []);

  const suspendOrActivate = useCallback(async (userId: string, currentStatus: UserStatus) => {
    try {
      if (currentStatus === "SUSPENDED") {
        await usersService.activateUser(userId);
        applyStatusLocally(userId, "ACTIVE");
        toast.success("User activated");
      } else {
        const reason = window.prompt("Suspension reason");
        if (!reason?.trim()) return;
        await usersService.suspendUser(userId, { reason: reason.trim() });
        applyStatusLocally(userId, "SUSPENDED");
        toast.success("User suspended");
      }
      void refreshStats();
    } catch (e) { toast.error("Failed to update user status", { description: errorMessage(e) }); }
  }, [applyStatusLocally, refreshStats]);

  const openBrokerCreate = () => {
    setEditingBroker(null);
    setBrokerForm({ name:"", email:"", phone:"", agencyName:"", licenseNumber:"" });
    setBrokerDrawerOpen(true);
  };
  const openBrokerEdit = (b: Broker) => {
    setEditingBroker(b);
    setBrokerForm({ name:b.name, email:b.email??"", phone:b.phone??"", agencyName:b.agencyName??"", licenseNumber:b.licenseNumber??"" });
    setBrokerDrawerOpen(true);
  };
  const saveBroker = async () => {
    if (!editingBroker && !brokerForm.name.trim()) { toast.error("Name is required"); return; }
    setBrokerSaving(true);
    try {
      if (editingBroker) {
        await usersService.updateBroker(editingBroker.id, { name:brokerForm.name.trim()||undefined, email:brokerForm.email.trim()||null, phone:brokerForm.phone.trim()||null, agencyName:brokerForm.agencyName.trim()||null, licenseNumber:brokerForm.licenseNumber.trim()||null });
        toast.success("Broker updated");
      } else {
        await usersService.createBroker({ name:brokerForm.name.trim(), email:brokerForm.email.trim()||undefined, phone:brokerForm.phone.trim()||undefined, agencyName:brokerForm.agencyName.trim()||undefined, licenseNumber:brokerForm.licenseNumber.trim()||undefined });
        toast.success("Broker created");
      }
      setBrokerDrawerOpen(false);
      await Promise.all([loadTabData(), refreshStats()]);
    } catch (e) { toast.error("Failed to save broker", { description: errorMessage(e) }); }
    finally { setBrokerSaving(false); }
  };

  // ── Column definitions ───────────────────────────────────────

  const ownerCols = useMemo<Col<OwnerListItem>[]>(() => [
    { key:"name",   header:"Name",       render:(r) => <div style={{ display:"flex", alignItems:"center", gap:"8px" }}><AvatarBubble name={r.name} /><span style={{ fontSize:"13px", fontWeight:600, color:"#111827" }}>{r.name}</span></div> },
    { key:"email",  header:"Email",      render:(r) => r.email||"—", mono:true },
    { key:"phone",  header:"Phone",      render:(r) => r.phone||"—", mono:true },
    { key:"units",  header:"Units",      render:(r) => r.unitNumbers.length?r.unitNumbers.join(", "):"0" },
    { key:"family", header:"Family",     render:(r) => String(r.familyMembersCount) },
    { key:"staff",  header:"Home Staff", render:(r) => String(r.homeStaffCount) },
    { key:"status", header:"Status",     render:(r) => <StatusBadge value={r.status} /> },
    { key:"actions",header:"Actions",    render:(r) => <div style={{ display:"flex",gap:"4px" }}><ActionBtn label="View" onClick={() => void openUserDetail(r.userId)} /><ActionBtn label={r.status==="SUSPENDED"?"Activate":"Suspend"} onClick={() => void suspendOrActivate(r.userId,r.status)} variant={r.status==="SUSPENDED"?"success":"danger"} /></div> },
  ], [openUserDetail, suspendOrActivate]);

  const familyCols = useMemo<Col<FamilyMemberListItem>[]>(() => [
    { key:"name",         header:"Name",         render:(r) => <div style={{ display:"flex", alignItems:"center", gap:"8px" }}><AvatarBubble name={r.name} /><span style={{ fontSize:"13px", fontWeight:600, color:"#111827" }}>{r.name}</span></div> },
    { key:"owner",        header:"Owner",        render:(r) => r.primaryOwnerName },
    { key:"unit",         header:"Unit",         render:(r) => r.unitNumber||"—" },
    { key:"relationship", header:"Relationship", render:(r) => r.relationshipType },
    { key:"status",       header:"Status",       render:(r) => <StatusBadge value={r.status} /> },
    { key:"activated",    header:"Activated",    render:(r) => formatDate(r.activatedAt), mono:true },
    { key:"actions",      header:"Actions",      render:(r) => <div style={{ display:"flex",gap:"4px" }}><ActionBtn label="View" onClick={() => void openUserDetail(r.userId)} /><ActionBtn label={r.status==="SUSPENDED"?"Activate":"Suspend"} onClick={() => void suspendOrActivate(r.userId,r.status)} variant={r.status==="SUSPENDED"?"success":"danger"} /></div> },
  ], [openUserDetail, suspendOrActivate]);

  const tenantCols = useMemo<Col<TenantListItem>[]>(() => [
    { key:"name",         header:"Name",         render:(r) => <div style={{ display:"flex", alignItems:"center", gap:"8px" }}><AvatarBubble name={r.name} /><span style={{ fontSize:"13px", fontWeight:600, color:"#111827" }}>{r.name}</span></div> },
    { key:"unit",         header:"Unit",         render:(r) => r.unitNumber||"—" },
    { key:"lease",        header:"Lease Period", render:(r) => `${formatDate(r.leaseStart)} – ${formatDate(r.leaseEnd)}`, mono:true },
    { key:"rent",         header:"Monthly Rent", render:(r) => formatCurrency(r.monthlyRent), mono:true },
    { key:"lease-status", header:"Lease Status", render:(r) => <StatusBadge value={r.leaseStatus??"N/A"} /> },
    { key:"actions",      header:"Actions",      render:(r) => <ActionBtn label="View" onClick={() => void openUserDetail(r.userId)} /> },
  ], [openUserDetail]);

  const homeStaffCols = useMemo<Col<HomeStaffListItem>[]>(() => [
    { key:"name",   header:"Name",         render:(r) => r.fullName },
    { key:"type",   header:"Type",         render:(r) => <StatusBadge value={r.staffType} /> },
    { key:"owner",  header:"Owner",        render:(r) => r.ownerName },
    { key:"unit",   header:"Unit",         render:(r) => r.unitNumber||"—" },
    { key:"until",  header:"Access Until", render:(r) => formatDate(r.accessValidTo), mono:true },
    { key:"livein", header:"Live-In",      render:(r) => r.isLiveIn?"Yes":"No" },
    { key:"status", header:"Status",       render:(r) => <StatusBadge value={r.status} /> },
    { key:"actions",header:"Actions",      render:() => "—" },
  ], []);

  const delegateCols = useMemo<Col<DelegateListItem>[]>(() => [
    { key:"name",    header:"Name",       render:(r) => r.fullName },
    { key:"owner",   header:"Owner",      render:(r) => r.ownerName },
    { key:"unit",    header:"Unit",       render:(r) => r.unitNumber||"—" },
    { key:"type",    header:"Type",       render:(r) => r.delegateType },
    { key:"valid",   header:"Valid",      render:(r) => `${formatDate(r.validFrom)} – ${formatDate(r.validTo)}`, mono:true },
    { key:"scopes",  header:"QR Scopes",  render:(r) => r.qrScopes.length?r.qrScopes.join(", "):"—" },
    { key:"feemode", header:"Fee Mode",   render:(r) => r.feeMode },
    { key:"actions", header:"Actions",    render:() => "—" },
  ], []);

  const brokerCols = useMemo<Col<Broker>[]>(() => [
    { key:"name",    header:"Name",    render:(r) => r.name },
    { key:"agency",  header:"Agency",  render:(r) => r.agencyName||"—" },
    { key:"license", header:"License", render:(r) => r.licenseNumber||"—", mono:true },
    { key:"email",   header:"Email",   render:(r) => r.email||"—", mono:true },
    { key:"phone",   header:"Phone",   render:(r) => r.phone||"—", mono:true },
    { key:"status",  header:"Status",  render:(r) => <StatusBadge value={r.status} /> },
    { key:"created", header:"Created", render:(r) => formatDate(r.createdAt), mono:true },
    { key:"actions", header:"Actions", render:(r) => <div style={{ display:"flex",gap:"4px" }}><ActionBtn label="Edit" onClick={() => openBrokerEdit(r)} /><ActionBtn label="View" onClick={() => void openUserDetail(r.userId)} /></div> },
  ], [openUserDetail]);

  const systemUserCols = useMemo<Col<SystemUserListItem>[]>(() => [
    { key:"name",   header:"Name",       render:(r) => r.name },
    { key:"email",  header:"Email",      render:(r) => r.email||"—", mono:true },
    { key:"roles",  header:"Roles",      render:(r) => r.roles.length?r.roles.join(", "):"—" },
    { key:"status", header:"Status",     render:(r) => <StatusBadge value={r.status} /> },
    { key:"login",  header:"Last Login", render:(r) => formatDateTime(r.lastLoginAt), mono:true },
    { key:"actions",header:"Actions",    render:(r) => <div style={{ display:"flex",gap:"4px" }}><ActionBtn label="View" onClick={() => void openUserDetail(r.userId)} /><ActionBtn label={r.status==="SUSPENDED"?"Activate":"Suspend"} onClick={() => void suspendOrActivate(r.userId,r.status)} variant={r.status==="SUSPENDED"?"success":"danger"} /></div> },
  ], [openUserDetail, suspendOrActivate]);

  const commercialCols = useMemo<Col<CommercialDirectoryUser>[]>(() => [
    { key:"name",      header:"User",      render:(r) => r.userLabel },
    { key:"role",      header:"Role",      render:(r) => <StatusBadge value={r.role} /> },
    { key:"entity",    header:"Entity",    render:(r) => r.entityName },
    { key:"community", header:"Community", render:(r) => r.communityName },
    { key:"unit",      header:"Unit",      render:(r) => r.unitLabel },
    { key:"status",    header:"Status",    render:(r) => <StatusBadge value={r.status} /> },
    { key:"actions",   header:"Actions",   render:(r) => <ActionBtn label="View" onClick={() => void openUserDetail(r.userId)} /> },
  ], [openUserDetail]);

  const compoundStaffCols = useMemo<Col<CompoundStaff>[]>(() => [
    { key:"name",       header:"Name",        render:(r) => r.fullName },
    { key:"profession", header:"Profession",  render:(r) => r.profession },
    { key:"phone",      header:"Phone",       render:(r) => r.phone, mono:true },
    { key:"community",  header:"Community",   render:(r) => r.communityId||"—" },
    { key:"status",     header:"Status",      render:(r) => <StatusBadge value={r.status} /> },
    { key:"contract",   header:"Contract To", render:(r) => formatDate(r.contractTo), mono:true },
    { key:"actions",    header:"Actions",     render:() => "—" },
  ], []);

  const kpiCards = [
    { title:"Total Users",         value:stats?.totalUsers,        icon:"active-users"     as const },
    { title:"Owners",              value:stats?.totalOwners,       icon:"active-users"     as const },
    { title:"Family Members",      value:stats?.totalFamilyMembers,icon:"visitors"         as const },
    { title:"Tenants",             value:stats?.totalTenants,      icon:"occupancy"        as const },
    { title:"Home Staff",          value:stats?.totalHomeStaff,    icon:"workers"          as const },
    { title:"Delegates",           value:stats?.totalDelegates,    icon:"devices"          as const },
    { title:"Brokers",             value:stats?.totalBrokers,      icon:"tickets"          as const },
    { title:"Suspended",           value:stats?.suspendedUsers,    icon:"complaints-closed"as const },
  ];

  const onTabChange = (key: UsersTabKey) => {
    setActiveTab(key); setStatusFilter("all"); setSecondaryFilter("all");
  };

  const statusOptions =
    activeTab==="delegates"||activeTab==="home-staff" ? HOUSEHOLD_STATUS_OPTIONS
    : activeTab==="commercial" ? COMMERCIAL_STATUS_OPTIONS
    : USER_STATUS_OPTIONS;

  const activeFilterCount = [statusFilter!=="all", secondaryFilter!=="all"].filter(Boolean).length;

  const detailBroker = useMemo(() => brokers.find((r) => r.userId === userDetail?.id) ?? null, [brokers, userDetail?.id]);

  const renderTable = () => {
    if (activeTab==="owners")         return <DataGrid cols={ownerCols}        rows={owners}          rowKey={(r)=>r.userId}   loading={tableLoading} />;
    if (activeTab==="family-members") return <DataGrid cols={familyCols}       rows={familyMembers}   rowKey={(r)=>r.userId}   loading={tableLoading} />;
    if (activeTab==="tenants")        return <DataGrid cols={tenantCols}       rows={tenants}         rowKey={(r)=>r.userId}   loading={tableLoading} />;
    if (activeTab==="home-staff")     return <DataGrid cols={homeStaffCols}    rows={homeStaff}       rowKey={(r)=>r.id}       loading={tableLoading} />;
    if (activeTab==="delegates")      return <DataGrid cols={delegateCols}     rows={delegates}       rowKey={(r)=>r.id}       loading={tableLoading} />;
    if (activeTab==="brokers")        return <DataGrid cols={brokerCols}       rows={brokers}         rowKey={(r)=>r.id}       loading={tableLoading} />;
    if (activeTab==="system-users")   return <DataGrid cols={systemUserCols}   rows={systemUsers}     rowKey={(r)=>r.userId}   loading={tableLoading} />;
    if (activeTab==="commercial")     return <DataGrid cols={commercialCols}   rows={commercialUsers} rowKey={(r)=>r.memberId} loading={tableLoading} />;
    if (activeTab==="compound-staff") return <DataGrid cols={compoundStaffCols}rows={compoundStaff}   rowKey={(r)=>r.id}       loading={tableLoading} />;
    return <EmptyState title="No tab selected" />;
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ fontFamily:ff }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"20px", flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontSize:"18px", fontWeight:900, color:"#111827", letterSpacing:"-0.02em", margin:0 }}>Users Hub</h1>
          <p style={{ marginTop:"4px", fontSize:"13px", color:"#6B7280" }}>
            Unified directory across all user types. Total:{" "}
            <span style={{ fontWeight:700, color:"#111827", fontFamily:ffMono }}>{statsLoading ? "…" : stats ? String(stats.totalUsers) : "—"}</span>
          </p>
        </div>
        <button type="button" onClick={() => void Promise.all([refreshStats(), loadTabData()])}
          style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px", background:"#111827", color:"#FFF", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:700, fontFamily:ff }}>
          <RefreshCw style={{ width:"13px", height:"13px" }} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"8px", marginBottom:"16px" }}>
        {kpiCards.map((c) => (
          <StatCard key={c.title} title={c.title} value={statsLoading?"…":stats?String(c.value??0):"—"} icon={c.icon} />
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:"2px", flexWrap:"wrap", marginBottom:"12px", padding:"4px", borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FAFAFA", width:"fit-content" }}>
        {ALL_TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button key={key} type="button" onClick={() => onTabChange(key)}
              style={{ padding:"5px 12px", borderRadius:"6px", fontSize:"12px", fontWeight:700, fontFamily:ff, cursor:"pointer", border:"none", background:isActive?"#FFF":"transparent", color:isActive?"#111827":"#6B7280", boxShadow:isActive?"0 1px 3px rgba(0,0,0,0.1)":"none", transition:"all 120ms ease", whiteSpace:"nowrap" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden", marginBottom:"14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"9px 12px", borderBottom:filtersOpen?"1px solid #F3F4F6":"none" }}>
          <Search style={{ width:"13px", height:"13px", color:"#9CA3AF", flexShrink:0 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone…"
            style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:"13px", color:"#111827", fontFamily:ff }} />
          {activeTab==="brokers" && (
            <button type="button" onClick={openBrokerCreate}
              style={{ display:"flex", alignItems:"center", gap:"5px", padding:"5px 11px", borderRadius:"6px", border:"none", background:"#111827", color:"#FFF", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:ff, whiteSpace:"nowrap" }}>
              <Plus style={{ width:"11px", height:"11px" }} /> Add Broker
            </button>
          )}
          <button type="button" onClick={() => setFiltersOpen((p)=>!p)}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"5px 10px", borderRadius:"6px", border:`1px solid ${activeFilterCount>0?"#2563EB40":"#E5E7EB"}`, background:activeFilterCount>0?"#EFF6FF":"#FAFAFA", color:activeFilterCount>0?"#2563EB":"#6B7280", fontSize:"11.5px", fontWeight:600, cursor:"pointer", fontFamily:ff, transition:"all 120ms" }}>
            <SlidersHorizontal style={{ width:"11px", height:"11px" }} />
            Filters
            {activeFilterCount>0 && <span style={{ width:"16px", height:"16px", borderRadius:"50%", background:"#2563EB", color:"#FFF", fontSize:"9px", fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{activeFilterCount}</span>}
            <ChevronDown style={{ width:"10px", height:"10px", transform:filtersOpen?"rotate(180deg)":"none", transition:"transform 150ms" }} />
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding:"10px 12px", display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
              <span style={{ fontSize:"10px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>Status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...selectStyle, width:"160px" }}>
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {activeTab==="tenants" && (
              <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                <span style={{ fontSize:"10px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>Lease Status</span>
                <select value={secondaryFilter} onChange={(e) => setSecondaryFilter(e.target.value)} style={{ ...selectStyle, width:"160px" }}>
                  {LEASE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            {activeTab==="home-staff" && (
              <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                <span style={{ fontSize:"10px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>Staff Type</span>
                <select value={secondaryFilter} onChange={(e) => setSecondaryFilter(e.target.value)} style={{ ...selectStyle, width:"160px" }}>
                  {STAFF_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {renderTable()}

      {/* ── User detail drawer ───────────────────────────────── */}
      <DrawerForm open={detailOpen} onOpenChange={setDetailOpen} title="User Profile" description="Profile, activity, and linked records">
        {detailLoading || !userDetail ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {Array.from({length:6}).map((_,i) => <div key={i} style={{ height:"16px", borderRadius:"5px", background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite" }} />)}
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            {/* Profile header */}
            <div style={{ borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FAFAFA", padding:"12px", display:"flex", alignItems:"center", gap:"12px" }}>
              <AvatarBubble name={userDetail.name} src={userDetail.profilePhotoUrl} />
              <div style={{ minWidth:0 }}>
                <p style={{ fontSize:"14px", fontWeight:800, color:"#111827", margin:"0 0 4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{userDetail.name}</p>
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  <StatusBadge value={userDetail.userType} />
                  <StatusBadge value={userDetail.status} />
                </div>
              </div>
            </div>

            {/* Detail tab switcher */}
            <div style={{ display:"flex", gap:"3px", padding:"3px", borderRadius:"8px", border:"1px solid #EBEBEB", background:"#FAFAFA" }}>
              {(["profile","activity","linked"] as const).map((t) => {
                const isA = detailTab===t;
                const label = t==="profile"?"Profile":t==="activity"?"Activity":"Linked Records";
                return (
                  <button key={t} type="button" onClick={() => setDetailTab(t)}
                    style={{ flex:1, padding:"5px", borderRadius:"6px", fontSize:"11.5px", fontWeight:700, fontFamily:ff, cursor:"pointer", border:"none", background:isA?"#FFF":"transparent", color:isA?"#111827":"#6B7280", boxShadow:isA?"0 1px 3px rgba(0,0,0,0.1)":"none", transition:"all 120ms" }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Profile tab */}
            {detailTab==="profile" && (
              <div>
                <FieldRow label="Email"       value={<span style={{ fontFamily:ffMono }}>{userDetail.email||"—"}</span>} />
                <FieldRow label="Phone"       value={<span style={{ fontFamily:ffMono }}>{userDetail.phone||"—"}</span>} />
                <FieldRow label="Last Login"  value={<span style={{ fontFamily:ffMono }}>{formatDateTime(userDetail.lastLoginAt)}</span>} />
                <FieldRow label="Created"     value={<span style={{ fontFamily:ffMono }}>{formatDateTime(userDetail.createdAt)}</span>} />
                {userDetail.ownerData     && <FieldRow label="Owner Units"    value={userDetail.ownerData.units.map((u)=>u.unitNumber).join(", ")||"—"} />}
                {userDetail.tenantData    && <FieldRow label="Tenant Lease"   value={`${formatDate(userDetail.tenantData.lease.startDate)} – ${formatDate(userDetail.tenantData.lease.endDate)}`} />}
                {userDetail.familyData    && <FieldRow label="Relationship"   value={userDetail.familyData.relationship} />}
                {userDetail.delegateData  && <FieldRow label="Delegate Scopes"value={userDetail.delegateData.permissions.join(", ")||"—"} />}
                {userDetail.homeStaffData && <FieldRow label="Staff Type"     value={userDetail.homeStaffData.staffType} />}
                {userDetail.brokerData    && <FieldRow label="Broker Agency"  value={userDetail.brokerData.agencyName||"—"} />}
              </div>
            )}

            {/* Activity tab */}
            {detailTab==="activity" && (
              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {!userDetail.activity.length
                  ? <EmptyState title="No activity logs" description="No status log entries found." />
                  : userDetail.activity.map((a) => (
                    <div key={a.id} style={{ borderRadius:"7px", border:"1px solid #EBEBEB", padding:"9px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px" }}>
                      <div>
                        <StatusBadge value={a.newStatus} />
                        <p style={{ fontSize:"11.5px", color:"#6B7280", margin:"4px 0 0", fontFamily:ff }}>{a.note||"No note"}</p>
                      </div>
                      <span style={{ fontSize:"10.5px", color:"#9CA3AF", fontFamily:ffMono, flexShrink:0 }}>{formatDateTime(a.createdAt)}</span>
                    </div>
                  ))
                }
              </div>
            )}

            {/* Linked tab */}
            {detailTab==="linked" && (
              <div>
                <FieldRow label="Units"      value={userDetail.linkedRecords.units.map((u)=>u.unitNumber).join(", ")||"—"} />
                <FieldRow label="Leases"     value={String(userDetail.linkedRecords.leases.length)} />
                <FieldRow label="Complaints" value={String(userDetail.linkedRecords.complaints)} />
                <FieldRow label="Violations" value={String(userDetail.linkedRecords.violations)} />
              </div>
            )}

            {/* Drawer footer actions */}
            <div style={{ display:"flex", gap:"6px", justifyContent:"flex-end", paddingTop:"4px" }}>
              {detailBroker && (
                <button type="button" onClick={() => openBrokerEdit(detailBroker)}
                  style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", color:"#374151", fontSize:"12.5px", fontWeight:600, fontFamily:ff, cursor:"pointer" }}>
                  Edit Broker
                </button>
              )}
              <button type="button" onClick={() => void suspendOrActivate(userDetail.id, userDetail.status)}
                style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"7px", border:`1px solid ${userDetail.status==="SUSPENDED"?"#A7F3D0":"#FECACA"}`, background:userDetail.status==="SUSPENDED"?"#ECFDF5":"#FEF2F2", color:userDetail.status==="SUSPENDED"?"#059669":"#B91C1C", fontSize:"12.5px", fontWeight:700, fontFamily:ff, cursor:"pointer" }}>
                {userDetail.status==="SUSPENDED"
                  ? <><UserCheck style={{ width:"12px", height:"12px" }} /> Activate</>
                  : <><User style={{ width:"12px", height:"12px" }} /> Suspend</>
                }
              </button>
            </div>
          </div>
        )}
      </DrawerForm>

      {/* ── Broker drawer ────────────────────────────────────── */}
      <DrawerForm
        open={brokerDrawerOpen}
        onOpenChange={setBrokerDrawerOpen}
        title={editingBroker ? "Edit Broker" : "Add Broker"}
        description="Create or update broker profile details."
        footer={
          <>
            <button type="button" onClick={() => setBrokerDrawerOpen(false)} disabled={brokerSaving}
              style={{ padding:"7px 16px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", color:"#6B7280", fontSize:"12.5px", fontWeight:600, fontFamily:ff, cursor:brokerSaving?"not-allowed":"pointer", opacity:brokerSaving?0.5:1 }}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveBroker()} disabled={brokerSaving}
              style={{ padding:"7px 18px", borderRadius:"7px", border:"none", background:"#111827", color:"#FFF", fontSize:"12.5px", fontWeight:700, fontFamily:ff, cursor:brokerSaving?"not-allowed":"pointer", opacity:brokerSaving?0.7:1 }}>
              {brokerSaving?"Saving…":editingBroker?"Update Broker":"Create Broker"}
            </button>
          </>
        }
      >
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <DrawerField label="Name"           value={brokerForm.name}          onChange={(v) => setBrokerForm((p)=>({...p,name:v}))}          placeholder="Broker full name" />
          <DrawerField label="Email"          value={brokerForm.email}         onChange={(v) => setBrokerForm((p)=>({...p,email:v}))}         placeholder="broker@email.com" type="email" />
          <DrawerField label="Phone"          value={brokerForm.phone}         onChange={(v) => setBrokerForm((p)=>({...p,phone:v}))}         placeholder="+1 …" />
          <DrawerField label="Agency"         value={brokerForm.agencyName}    onChange={(v) => setBrokerForm((p)=>({...p,agencyName:v}))}    placeholder="Agency name" />
          <DrawerField label="License Number" value={brokerForm.licenseNumber} onChange={(v) => setBrokerForm((p)=>({...p,licenseNumber:v}))} placeholder="License number" />
        </div>
      </DrawerForm>

      <style>{`
        @keyframes shimmer { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}