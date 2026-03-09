import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown, RefreshCw, Search, SlidersHorizontal,
  User, UserCheck, Plus, Building2, Users, Home,
  Shield, Briefcase, Store, HardHat,
  ArrowUpRight, MoreHorizontal, Mail, Phone, Clock,
  Link, AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import usersService, {
  Broker, DelegateListItem, FamilyMemberListItem, HomeStaffListItem,
  HouseholdRequestStatus, OwnerListItem, TenantListItem,
  UserDetailResponse, UserStatus, UserStats,
} from "../../lib/users-service";
import commercialService, { CommercialDirectoryUser } from "../../lib/commercial-service";
import compoundStaffService, { CompoundStaff, CompoundStaffStatus } from "../../lib/compound-staff-service";
import { errorMessage } from "../../lib/live-data";

// ─── Tab config ────────────────────────────────────────────────

type UsersTabKey =
  | "owners" | "family-members" | "tenants" | "home-staff"
  | "delegates" | "brokers" | "commercial" | "compound-staff";

const ALL_TABS: Array<{ key: UsersTabKey; label: string; icon: React.ReactNode; color: string }> = [
  { key: "owners",         label: "Owners",        icon: <Building2 size={12} />,  color: "#1D4ED8" },
  { key: "family-members", label: "Family",         icon: <Users size={12} />,      color: "#7C3AED" },
  { key: "tenants",        label: "Tenants",        icon: <Home size={12} />,       color: "#059669" },
  { key: "home-staff",     label: "Home Staff",     icon: <Home size={12} />,       color: "#D97706" },
  { key: "delegates",      label: "Delegates",      icon: <Shield size={12} />,     color: "#DC2626" },
  { key: "brokers",        label: "Brokers",        icon: <Briefcase size={12} />,  color: "#0891B2" },
  { key: "commercial",     label: "Commercial",     icon: <Store size={12} />,      color: "#EA580C" },
  { key: "compound-staff", label: "Compound Staff", icon: <HardHat size={12} />,    color: "#4F46E5" },
];

const USER_STATUS_OPTIONS       = [{ value:"all",label:"All statuses" },{ value:"ACTIVE",label:"Active" },{ value:"SUSPENDED",label:"Suspended" },{ value:"PENDING",label:"Pending" },{ value:"INVITED",label:"Invited" },{ value:"DISABLED",label:"Disabled" }];
const HOUSEHOLD_STATUS_OPTIONS  = [{ value:"all",label:"All statuses" },{ value:"APPROVED",label:"Approved" },{ value:"PENDING",label:"Pending" },{ value:"REJECTED",label:"Rejected" },{ value:"CANCELLED",label:"Cancelled" }];
const LEASE_STATUS_OPTIONS      = [{ value:"all",label:"All lease statuses" },{ value:"ACTIVE",label:"Active" },{ value:"EXPIRING_SOON",label:"Expiring Soon" },{ value:"EXPIRED",label:"Expired" },{ value:"TERMINATED",label:"Terminated" }];
const STAFF_TYPE_OPTIONS        = [{ value:"all",label:"All staff types" },{ value:"DRIVER",label:"Driver" },{ value:"NANNY",label:"Nanny" },{ value:"SERVANT",label:"Servant" },{ value:"GARDENER",label:"Gardener" },{ value:"OTHER",label:"Other" }];
const COMMERCIAL_STATUS_OPTIONS = [{ value:"all",label:"All statuses" },{ value:"ACTIVE",label:"Active" },{ value:"INACTIVE",label:"Inactive" }];

// ─── Tokens ────────────────────────────────────────────────────

const ff     = "'Work Sans', sans-serif";
const ffMono = "'DM Mono', monospace";

const inputBase: React.CSSProperties = {
  height: "34px", borderRadius: "8px", border: "1px solid #E5E7EB",
  background: "#FFF", fontFamily: ff, fontSize: "12.5px", color: "#111827",
  outline: "none", padding: "0 10px", boxSizing: "border-box", width: "100%",
  transition: "border-color 150ms, box-shadow 150ms",
};
const selectStyle: React.CSSProperties = { ...inputBase, cursor: "pointer" };

// ─── Helpers ───────────────────────────────────────────────────

const formatDate     = (v: string | null) => { if (!v) return "—"; const d = new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(); };
const formatDateTime = (v: string | null) => { if (!v) return "—"; const d = new Date(v); return isNaN(d.getTime()) ? "—" : d.toLocaleString(); };
const formatCurrency = (v: number | null) => { if (v == null || isNaN(v)) return "—"; return new Intl.NumberFormat(undefined, { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(v); };
const avatarFallback = (name: string) => name.split(/\s+/).filter(Boolean).slice(0,2).map((p) => p[0]?.toUpperCase()).join("") || "NA";

// ─── Avatar ─────────────────────────────────────────────────────

const PALETTES = [
  { bg:"#EFF6FF", color:"#1D4ED8" },
  { bg:"#F5F3FF", color:"#6D28D9" },
  { bg:"#ECFDF5", color:"#059669" },
  { bg:"#FFF7ED", color:"#C2410C" },
  { bg:"#FEF2F2", color:"#B91C1C" },
  { bg:"#F0F9FF", color:"#0369A1" },
];

function AvatarBubble({ name, src, size = 34 }: { name: string; src?: string | null; size?: number }) {
  const p = PALETTES[(name.charCodeAt(0)||65) % PALETTES.length];
  return src
    ? <img src={src} alt={name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:"2px solid #FFF", boxShadow:"0 0 0 1px #E5E7EB" }} />
    : <div style={{ width:size, height:size, borderRadius:"50%", background:p.bg, color:p.color, fontSize:size*0.33, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:ff, border:"2px solid #FFF", boxShadow:`0 0 0 1px ${p.color}30`, letterSpacing:"-0.03em" }}>{avatarFallback(name)}</div>;
}

// ─── DataGrid ──────────────────────────────────────────────────

type Col<T> = { key: string; header: string; render: (row: T) => React.ReactNode; mono?: boolean; width?: string };

function DataGrid<T>({ cols, rows, rowKey, loading, onRowClick }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string;
  loading: boolean; onRowClick?: (r: T) => void;
}) {
  const gridCols = cols.map((c) => c.width || "minmax(80px,1fr)").join(" ");

  if (loading) return (
    <div style={{ borderRadius:"12px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ padding:"10px 16px", background:"linear-gradient(180deg,#FAFAFA,#F5F6F7)", borderBottom:"1px solid #EBEBEB", display:"flex", gap:"16px" }}>
        {[120,160,120,90,70,70,110].map((w,i) => <div key={i} style={{ height:"10px", borderRadius:"4px", width:w, background:"#EBEBEB" }} />)}
      </div>
      {Array.from({length:6}).map((_,i) => (
        <div key={i} style={{ display:"flex", gap:"16px", padding:"13px 16px", borderBottom:"1px solid #F9FAFB", alignItems:"center" }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)`, backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite", flexShrink:0 }} />
          {[140,110,90,70,70,100].map((w,j) => (
            <div key={j} style={{ height:"13px", borderRadius:"4px", width:w, background:`linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)`, backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite", animationDelay:`${i*60}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );

  if (!rows.length) return (
    <div style={{ borderRadius:"12px", border:"2px dashed #E5E7EB", padding:"52px 24px", textAlign:"center", background:"#FAFAFA" }}>
      <div style={{ width:"44px", height:"44px", borderRadius:"12px", background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
        <Search size={20} color="#D1D5DB" />
      </div>
      <p style={{ fontSize:"14px", fontWeight:800, color:"#9CA3AF", margin:"0 0 4px", fontFamily:ff }}>No results found</p>
      <p style={{ fontSize:"12px", color:"#D1D5DB", margin:0, fontFamily:ff }}>Try adjusting your filters or search term.</p>
    </div>
  );

  return (
    <div style={{ borderRadius:"12px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:"10px", padding:"10px 16px", background:"linear-gradient(180deg,#FAFAFA,#F5F6F7)", borderBottom:"1px solid #EBEBEB" }}>
        {cols.map((c) => (
          <span key={c.key} style={{ fontSize:"10px", fontWeight:800, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:ff }}>{c.header}</span>
        ))}
      </div>
      {rows.map((row, idx) => (
        <div key={rowKey(row)}
          onClick={() => onRowClick?.(row)}
          style={{ display:"grid", gridTemplateColumns:gridCols, gap:"10px", padding:"11px 16px", borderBottom:idx < rows.length-1 ? "1px solid #F5F6F7" : "none", transition:"background 100ms", alignItems:"center", cursor:onRowClick?"pointer":"default" }}
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

// ─── Action button ─────────────────────────────────────────────

function ActionBtn({ label, onClick, variant = "default", icon }: { label: string; onClick: (e: React.MouseEvent) => void; variant?: "default"|"danger"|"success"; icon?: React.ReactNode }) {
  const c = variant==="danger"  ? { bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA", hbg:"#FEE2E2" }
          : variant==="success" ? { bg:"#F0FDF4", color:"#16A34A", border:"#BBF7D0", hbg:"#DCFCE7" }
          :                       { bg:"#F9FAFB", color:"#374151", border:"#E5E7EB", hbg:"#F3F4F6" };
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(e); }}
      style={{ display:"inline-flex", alignItems:"center", gap:"4px", padding:"4px 10px", borderRadius:"6px", border:`1px solid ${c.border}`, background:c.bg, color:c.color, fontSize:"11.5px", fontWeight:700, cursor:"pointer", fontFamily:ff, whiteSpace:"nowrap", transition:"background 100ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = c.hbg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = c.bg; }}>
      {icon}{label}
    </button>
  );
}

// ─── Drawer field ──────────────────────────────────────────────

function DrawerField({ label, value, onChange, placeholder, type = "text", icon }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
      <label style={{ fontSize:"10.5px", fontWeight:800, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:ff }}>{label}</label>
      <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
        {icon && <div style={{ position:"absolute", left:"10px", color:"#9CA3AF", display:"flex", pointerEvents:"none" }}>{icon}</div>}
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ ...inputBase, paddingLeft:icon?"32px":"10px", borderColor:focused?"#111827":"#E5E7EB", boxShadow:focused?"0 0 0 3px rgba(17,24,39,0.06)":"none" }} />
      </div>
    </div>
  );
}

// ─── Field row ─────────────────────────────────────────────────

function FieldRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"9px 0", borderBottom:"1px solid #F5F6F7" }}>
      {icon && <div style={{ color:"#D1D5DB", marginTop:"1px", flexShrink:0 }}>{icon}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"110px 1fr", gap:"8px", flex:1, fontSize:"12.5px" }}>
        <span style={{ color:"#9CA3AF", fontFamily:ff, fontWeight:700 }}>{label}</span>
        <span style={{ color:"#374151", fontFamily:ff }}>{value || "—"}</span>
      </div>
    </div>
  );
}

// ─── Mini stat (drawer) ────────────────────────────────────────

function MiniStat({ label, value, color = "#374151" }: { label: string; value: string|number; color?: string }) {
  return (
    <div style={{ flex:1, borderRadius:"10px", background:"#F9FAFB", border:"1px solid #F0F0F0", padding:"10px 12px" }}>
      <p style={{ fontSize:"20px", fontWeight:900, color, margin:0, fontFamily:ff, letterSpacing:"-0.03em" }}>{value}</p>
      <p style={{ fontSize:"10px", fontWeight:800, color:"#9CA3AF", margin:"2px 0 0", fontFamily:ff, textTransform:"uppercase", letterSpacing:"0.07em" }}>{label}</p>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────

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
  const [commercialUsers, setCommercialUsers] = useState<CommercialDirectoryUser[]>([]);
  const [compoundStaff,   setCompoundStaff]   = useState<CompoundStaff[]>([]);

  const [detailOpen,    setDetailOpen]    = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [userDetail,    setUserDetail]    = useState<UserDetailResponse | null>(null);
  const [detailTab,     setDetailTab]     = useState<"profile"|"activity"|"linked">("profile");

  const [brokerDrawerOpen, setBrokerDrawerOpen] = useState(false);
  const [brokerSaving,     setBrokerSaving]     = useState(false);
  const [editingBroker,    setEditingBroker]    = useState<Broker | null>(null);
  const [brokerForm,       setBrokerForm]       = useState({ name:"", email:"", phone:"", agencyName:"", licenseNumber:"" });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tab = p.get("tab");
    if (tab && ALL_TABS.some((t) => t.key===tab)) setActiveTab(tab as UsersTabKey);
    setSearch(p.get("q")??"");
    setStatusFilter(p.get("status")??"all");
    setSecondaryFilter(p.get("f1")??"all");
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    p.set("tab", activeTab);
    if (search.trim()) p.set("q", search.trim()); else p.delete("q");
    if (statusFilter!=="all") p.set("status", statusFilter); else p.delete("status");
    if (secondaryFilter!=="all") p.set("f1", secondaryFilter); else p.delete("f1");
    const q = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q?`?${q}`:""}${window.location.hash||""}`);
  }, [activeTab, search, secondaryFilter, statusFilter]);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await usersService.getStats()); }
    catch (e) { toast.error("Failed to load stats", { description:errorMessage(e) }); }
    finally { setStatsLoading(false); }
  }, []);

  const loadTabData = useCallback(async () => {
    setTableLoading(true);
    const q = search.trim()||undefined;
    const st = statusFilter==="all"?undefined:statusFilter;
    try {
      if (activeTab==="owners")           setOwners((await usersService.listOwners({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab==="family-members") setFamilyMembers((await usersService.listFamilyMembers({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab==="tenants")     setTenants((await usersService.listTenants({ page:1,limit:20,search:q,status:st as UserStatus,leaseStatus:secondaryFilter==="all"?undefined:secondaryFilter as any })).items);
      else if (activeTab==="home-staff")  setHomeStaff((await usersService.listHomeStaff({ page:1,limit:20,search:q,status:st as HouseholdRequestStatus,staffType:secondaryFilter==="all"?undefined:secondaryFilter as any })).items);
      else if (activeTab==="delegates")   setDelegates((await usersService.listDelegates({ page:1,limit:20,search:q,status:st as HouseholdRequestStatus })).items);
      else if (activeTab==="brokers")     setBrokers((await usersService.listBrokers({ page:1,limit:20,search:q,status:st as UserStatus })).items);
      else if (activeTab==="commercial") {
        const rows = await commercialService.listDirectoryUsers({ includeInactive:statusFilter==="all"||statusFilter==="INACTIVE" });
        const filtered = (statusFilter==="ACTIVE"||statusFilter==="INACTIVE"?rows.filter((r)=>r.status===statusFilter):rows).filter((r)=>!q||[r.userLabel,r.role,r.entityName,r.communityName,r.unitLabel].join(" ").toLowerCase().includes(q.toLowerCase()));
        setCommercialUsers(filtered.slice(0,20));
      } else if (activeTab==="compound-staff") {
        setCompoundStaff((await compoundStaffService.list({ status:st as CompoundStaffStatus,profession:q })).slice(0,20));
      }
    } catch (e) { toast.error("Failed to load data", { description:errorMessage(e) }); }
    finally { setTableLoading(false); }
  }, [activeTab, search, secondaryFilter, statusFilter]);

  useEffect(() => { void refreshStats(); }, [refreshStats]);
  useEffect(() => { void loadTabData(); },  [loadTabData]);

  const openUserDetail = useCallback(async (userId: string) => {
    setDetailOpen(true); setDetailLoading(true); setDetailTab("profile");
    try { setUserDetail(await usersService.getUserDetail(userId)); }
    catch (e) { toast.error("Failed to load profile", { description:errorMessage(e) }); setDetailOpen(false); }
    finally { setDetailLoading(false); }
  }, []);

  const applyStatusLocally = useCallback((userId: string, next: UserStatus) => {
    setOwners((p) => p.map((r) => r.userId===userId?{...r,status:next}:r));
    setFamilyMembers((p) => p.map((r) => r.userId===userId?{...r,status:next}:r));
    setTenants((p) => p.map((r) => r.userId===userId?{...r,status:next}:r));
    setBrokers((p) => p.map((r) => r.userId===userId?{...r,status:next}:r));
    setUserDetail((p) => p?.id===userId?{...p,status:next}:p);
  }, []);

  const suspendOrActivate = useCallback(async (userId: string, cur: UserStatus) => {
    try {
      if (cur==="SUSPENDED") { await usersService.activateUser(userId); applyStatusLocally(userId,"ACTIVE"); toast.success("User activated"); }
      else {
        const reason = window.prompt("Suspension reason");
        if (!reason?.trim()) return;
        await usersService.suspendUser(userId, { reason:reason.trim() });
        applyStatusLocally(userId,"SUSPENDED"); toast.success("User suspended");
      }
      void refreshStats();
    } catch (e) { toast.error("Failed to update status", { description:errorMessage(e) }); }
  }, [applyStatusLocally, refreshStats]);

  const openBrokerCreate = () => { setEditingBroker(null); setBrokerForm({ name:"",email:"",phone:"",agencyName:"",licenseNumber:"" }); setBrokerDrawerOpen(true); };
  const openBrokerEdit   = (b: Broker) => { setEditingBroker(b); setBrokerForm({ name:b.name,email:b.email??"",phone:b.phone??"",agencyName:b.agencyName??"",licenseNumber:b.licenseNumber??"" }); setBrokerDrawerOpen(true); };

  const saveBroker = async () => {
    if (!editingBroker&&!brokerForm.name.trim()) { toast.error("Name is required"); return; }
    setBrokerSaving(true);
    try {
      if (editingBroker) { await usersService.updateBroker(editingBroker.id, { name:brokerForm.name.trim()||undefined,email:brokerForm.email.trim()||null,phone:brokerForm.phone.trim()||null,agencyName:brokerForm.agencyName.trim()||null,licenseNumber:brokerForm.licenseNumber.trim()||null }); toast.success("Broker updated"); }
      else { await usersService.createBroker({ name:brokerForm.name.trim(),email:brokerForm.email.trim()||undefined,phone:brokerForm.phone.trim()||undefined,agencyName:brokerForm.agencyName.trim()||undefined,licenseNumber:brokerForm.licenseNumber.trim()||undefined }); toast.success("Broker created"); }
      setBrokerDrawerOpen(false);
      await Promise.all([loadTabData(), refreshStats()]);
    } catch (e) { toast.error("Failed to save broker", { description:errorMessage(e) }); }
    finally { setBrokerSaving(false); }
  };

  // ── Columns ──────────────────────────────────────────────────

  const nameCell = (name: string, src?: string|null) => (
    <div style={{ display:"flex", alignItems:"center", gap:"9px" }}>
      <AvatarBubble name={name} src={src} />
      <span style={{ fontSize:"13px", fontWeight:700, color:"#111827", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</span>
    </div>
  );

  const ownerCols = useMemo<Col<OwnerListItem>[]>(() => [
    { key:"name",   header:"Name",       render:(r)=>nameCell(r.name), width:"200px" },
    { key:"email",  header:"Email",      render:(r)=>r.email||"—", mono:true },
    { key:"phone",  header:"Phone",      render:(r)=>r.phone||"—", mono:true },
    { key:"units",  header:"Units",      render:(r)=>r.unitNumbers.length?r.unitNumbers.join(", "):"—", width:"80px" },
    { key:"family", header:"Family",     render:(r)=>String(r.familyMembersCount), width:"70px" },
    { key:"staff",  header:"Staff",      render:(r)=>String(r.homeStaffCount), width:"60px" },
    { key:"status", header:"Status",     render:(r)=><StatusBadge value={r.status} />, width:"90px" },
    { key:"actions",header:"",           render:(r)=><div style={{ display:"flex",gap:"4px" }}><ActionBtn label="View" onClick={()=>void openUserDetail(r.userId)} icon={<ArrowUpRight size={10}/>} /><ActionBtn label={r.status==="SUSPENDED"?"Activate":"Suspend"} onClick={()=>void suspendOrActivate(r.userId,r.status)} variant={r.status==="SUSPENDED"?"success":"danger"} /></div>, width:"170px" },
  ], [openUserDetail, suspendOrActivate]);

  const familyCols = useMemo<Col<FamilyMemberListItem>[]>(() => [
    { key:"name",         header:"Name",         render:(r)=>nameCell(r.name), width:"190px" },
    { key:"owner",        header:"Owner",        render:(r)=>r.primaryOwnerName },
    { key:"unit",         header:"Unit",         render:(r)=>r.unitNumber||"—", width:"70px" },
    { key:"relationship", header:"Relationship", render:(r)=>r.relationshipType },
    { key:"status",       header:"Status",       render:(r)=><StatusBadge value={r.status} />, width:"90px" },
    { key:"activated",    header:"Activated",    render:(r)=>formatDate(r.activatedAt), mono:true, width:"110px" },
    { key:"actions",      header:"",             render:(r)=><div style={{ display:"flex",gap:"4px" }}><ActionBtn label="View" onClick={()=>void openUserDetail(r.userId)} icon={<ArrowUpRight size={10}/>}/><ActionBtn label={r.status==="SUSPENDED"?"Activate":"Suspend"} onClick={()=>void suspendOrActivate(r.userId,r.status)} variant={r.status==="SUSPENDED"?"success":"danger"}/></div>, width:"170px" },
  ], [openUserDetail, suspendOrActivate]);

  const tenantCols = useMemo<Col<TenantListItem>[]>(() => [
    { key:"name",         header:"Name",         render:(r)=>nameCell(r.name), width:"200px" },
    { key:"unit",         header:"Unit",         render:(r)=>r.unitNumber||"—", width:"70px" },
    { key:"lease",        header:"Lease Period", render:(r)=>`${formatDate(r.leaseStart)} – ${formatDate(r.leaseEnd)}`, mono:true },
    { key:"rent",         header:"Monthly Rent", render:(r)=>formatCurrency(r.monthlyRent), mono:true, width:"120px" },
    { key:"lease-status", header:"Lease",        render:(r)=><StatusBadge value={r.leaseStatus??"N/A"} />, width:"110px" },
    { key:"actions",      header:"",             render:(r)=><ActionBtn label="View" onClick={()=>void openUserDetail(r.userId)} icon={<ArrowUpRight size={10}/>}/>, width:"80px" },
  ], [openUserDetail]);

  const homeStaffCols = useMemo<Col<HomeStaffListItem>[]>(() => [
    { key:"name",   header:"Name",         render:(r)=>r.fullName },
    { key:"type",   header:"Type",         render:(r)=><StatusBadge value={r.staffType}/> },
    { key:"owner",  header:"Owner",        render:(r)=>r.ownerName },
    { key:"unit",   header:"Unit",         render:(r)=>r.unitNumber||"—", width:"70px" },
    { key:"until",  header:"Access Until", render:(r)=>formatDate(r.accessValidTo), mono:true },
    { key:"livein", header:"Live-In",      render:(r)=>r.isLiveIn?"Yes":"No", width:"70px" },
    { key:"status", header:"Status",       render:(r)=><StatusBadge value={r.status}/> },
    { key:"actions",header:"",             render:()=>"—", width:"40px" },
  ], []);

  const delegateCols = useMemo<Col<DelegateListItem>[]>(() => [
    { key:"name",    header:"Name",      render:(r)=>r.fullName },
    { key:"owner",   header:"Owner",     render:(r)=>r.ownerName },
    { key:"unit",    header:"Unit",      render:(r)=>r.unitNumber||"—" },
    { key:"type",    header:"Type",      render:(r)=>r.delegateType },
    { key:"valid",   header:"Valid",     render:(r)=>`${formatDate(r.validFrom)} – ${formatDate(r.validTo)}`, mono:true },
    { key:"scopes",  header:"QR Scopes", render:(r)=>r.qrScopes.length?r.qrScopes.join(", "):"—" },
    { key:"feemode", header:"Fee Mode",  render:(r)=>r.feeMode },
    { key:"actions", header:"",          render:()=>"—", width:"40px" },
  ], []);

  const brokerCols = useMemo<Col<Broker>[]>(() => [
    { key:"name",    header:"Name",    render:(r)=>r.name, width:"140px" },
    { key:"agency",  header:"Agency",  render:(r)=>r.agencyName||"—" },
    { key:"license", header:"License", render:(r)=>r.licenseNumber||"—", mono:true },
    { key:"email",   header:"Email",   render:(r)=>r.email||"—", mono:true },
    { key:"phone",   header:"Phone",   render:(r)=>r.phone||"—", mono:true, width:"130px" },
    { key:"status",  header:"Status",  render:(r)=><StatusBadge value={r.status}/>, width:"90px" },
    { key:"created", header:"Created", render:(r)=>formatDate(r.createdAt), mono:true, width:"100px" },
    { key:"actions", header:"",        render:(r)=><div style={{ display:"flex",gap:"4px" }}><ActionBtn label="Edit" onClick={()=>openBrokerEdit(r)}/><ActionBtn label="View" onClick={()=>void openUserDetail(r.userId)} icon={<ArrowUpRight size={10}/>}/></div>, width:"130px" },
  ], [openUserDetail]);

  const commercialCols = useMemo<Col<CommercialDirectoryUser>[]>(() => [
    { key:"name",      header:"User",      render:(r)=>r.userLabel },
    { key:"role",      header:"Role",      render:(r)=><StatusBadge value={r.role}/> },
    { key:"entity",    header:"Entity",    render:(r)=>r.entityName },
    { key:"community", header:"Community", render:(r)=>r.communityName },
    { key:"unit",      header:"Unit",      render:(r)=>r.unitLabel },
    { key:"status",    header:"Status",    render:(r)=><StatusBadge value={r.status}/>, width:"90px" },
    { key:"actions",   header:"",          render:(r)=><ActionBtn label="View" onClick={()=>void openUserDetail(r.userId)} icon={<ArrowUpRight size={10}/>}/>, width:"80px" },
  ], [openUserDetail]);

  const compoundStaffCols = useMemo<Col<CompoundStaff>[]>(() => [
    { key:"name",       header:"Name",        render:(r)=>r.fullName },
    { key:"profession", header:"Profession",  render:(r)=>r.profession },
    { key:"phone",      header:"Phone",       render:(r)=>r.phone, mono:true },
    { key:"community",  header:"Community",   render:(r)=>r.communityId||"—" },
    { key:"status",     header:"Status",      render:(r)=><StatusBadge value={r.status}/>, width:"90px" },
    { key:"contract",   header:"Contract To", render:(r)=>formatDate(r.contractTo), mono:true },
    { key:"actions",    header:"",            render:()=>"—", width:"40px" },
  ], []);

  const kpiCards = [
    { title:"Total Users",   value:stats?.totalUsers,         color:"#111827" },
    { title:"Owners",        value:stats?.totalOwners,        color:"#1D4ED8" },
    { title:"Family",        value:stats?.totalFamilyMembers, color:"#7C3AED" },
    { title:"Tenants",       value:stats?.totalTenants,       color:"#059669" },
    { title:"Home Staff",    value:stats?.totalHomeStaff,     color:"#D97706" },
    { title:"Delegates",     value:stats?.totalDelegates,     color:"#DC2626" },
    { title:"Brokers",       value:stats?.totalBrokers,       color:"#0891B2" },
    { title:"Suspended",     value:stats?.suspendedUsers,     color:"#9CA3AF" },
  ];

  const onTabChange = (key: UsersTabKey) => { setActiveTab(key); setStatusFilter("all"); setSecondaryFilter("all"); };

  const statusOptions =
    activeTab==="delegates"||activeTab==="home-staff" ? HOUSEHOLD_STATUS_OPTIONS
    : activeTab==="commercial" ? COMMERCIAL_STATUS_OPTIONS
    : USER_STATUS_OPTIONS;

  const activeFilterCount = [statusFilter!=="all", secondaryFilter!=="all"].filter(Boolean).length;
  const detailBroker = useMemo(() => brokers.find((r) => r.userId===userDetail?.id)??null, [brokers, userDetail?.id]);
  const currentTab = ALL_TABS.find((t) => t.key===activeTab)!;

  const renderTable = () => {
    if (activeTab==="owners")         return <DataGrid cols={ownerCols}        rows={owners}          rowKey={(r)=>r.userId}   loading={tableLoading} onRowClick={(r)=>void openUserDetail(r.userId)} />;
    if (activeTab==="family-members") return <DataGrid cols={familyCols}       rows={familyMembers}   rowKey={(r)=>r.userId}   loading={tableLoading} onRowClick={(r)=>void openUserDetail(r.userId)} />;
    if (activeTab==="tenants")        return <DataGrid cols={tenantCols}       rows={tenants}         rowKey={(r)=>r.userId}   loading={tableLoading} onRowClick={(r)=>void openUserDetail(r.userId)} />;
    if (activeTab==="home-staff")     return <DataGrid cols={homeStaffCols}    rows={homeStaff}       rowKey={(r)=>r.id}       loading={tableLoading} />;
    if (activeTab==="delegates")      return <DataGrid cols={delegateCols}     rows={delegates}       rowKey={(r)=>r.id}       loading={tableLoading} />;
    if (activeTab==="brokers")        return <DataGrid cols={brokerCols}       rows={brokers}         rowKey={(r)=>r.id}       loading={tableLoading} />;
    if (activeTab==="commercial")     return <DataGrid cols={commercialCols}   rows={commercialUsers} rowKey={(r)=>r.memberId} loading={tableLoading} onRowClick={(r)=>void openUserDetail(r.userId)} />;
    if (activeTab==="compound-staff") return <DataGrid cols={compoundStaffCols}rows={compoundStaff}   rowKey={(r)=>r.id}       loading={tableLoading} />;
    return null;
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ fontFamily:ff }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontSize:"20px", fontWeight:900, color:"#111827", letterSpacing:"-0.03em", margin:0 }}>Users Hub</h1>
          <p style={{ marginTop:"3px", fontSize:"13px", color:"#9CA3AF", fontFamily:ff }}>
            Unified directory · <span style={{ fontFamily:ffMono, fontWeight:700, color:"#374151" }}>{statsLoading?"…":stats?String(stats.totalUsers):"—"}</span> total users
          </p>
        </div>
        <button type="button" onClick={() => void Promise.all([refreshStats(), loadTabData()])}
          style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"9px", background:"#111827", color:"#FFF", border:"none", cursor:"pointer", fontSize:"12.5px", fontWeight:700, fontFamily:ff, boxShadow:"0 1px 3px rgba(0,0,0,0.2)", transition:"opacity 120ms" }}
          onMouseEnter={(e)=>e.currentTarget.style.opacity="0.85"} onMouseLeave={(e)=>e.currentTarget.style.opacity="1"}>
          <RefreshCw size={12} style={{ animation:(statsLoading||tableLoading)?"spin 1s linear infinite":"none" }} /> Refresh
        </button>
      </div>

      {/* KPI cards — clickable to switch tab */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"6px", marginBottom:"20px" }}>
        {kpiCards.map((c, i) => (
          <div key={c.title}
            onClick={() => { if (i>0) onTabChange(ALL_TABS[i-1].key); }}
            style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", padding:"11px 12px", cursor:i>0?"pointer":"default", transition:"border-color 130ms, box-shadow 130ms", boxShadow:"0 1px 2px rgba(0,0,0,0.03)" }}
            onMouseEnter={(e) => { if(i>0) { (e.currentTarget as HTMLDivElement).style.borderColor=c.color+"60"; (e.currentTarget as HTMLDivElement).style.boxShadow=`0 2px 8px ${c.color}15`; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor="#EBEBEB"; (e.currentTarget as HTMLDivElement).style.boxShadow="0 1px 2px rgba(0,0,0,0.03)"; }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
              <span style={{ fontSize:"9.5px", fontWeight:800, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:ff }}>{c.title}</span>
              {i>0 && <div style={{ width:"18px",height:"18px",borderRadius:"5px",background:c.color+"15",display:"flex",alignItems:"center",justifyContent:"center",color:c.color }}>{ALL_TABS[i-1].icon}</div>}
            </div>
            <p style={{ fontSize:"22px", fontWeight:900, color:c.color, margin:0, letterSpacing:"-0.04em", fontFamily:ff }}>
              {statsLoading
                ? <span style={{ display:"inline-block",width:"36px",height:"20px",borderRadius:"5px",background:"linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)",backgroundSize:"400% 100%",animation:"shimmer 1.4s ease infinite",verticalAlign:"middle" }} />
                : stats ? String(c.value??0) : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display:"flex", gap:"2px", flexWrap:"wrap", marginBottom:"12px", padding:"3px", borderRadius:"11px", border:"1px solid #EBEBEB", background:"#F5F6F7", width:"fit-content" }}>
        {ALL_TABS.map(({ key, label, icon, color }) => {
          const isActive = activeTab===key;
          return (
            <button key={key} type="button" onClick={() => onTabChange(key)}
              style={{ display:"flex", alignItems:"center", gap:"5px", padding:"6px 12px", borderRadius:"8px", fontSize:"12px", fontWeight:700, fontFamily:ff, cursor:"pointer", border:"none", background:isActive?"#FFF":"transparent", color:isActive?color:"#6B7280", boxShadow:isActive?"0 1px 4px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.04)":"none", transition:"all 130ms ease", whiteSpace:"nowrap" }}
              onMouseEnter={(e) => { if(!isActive) e.currentTarget.style.color="#374151"; }}
              onMouseLeave={(e) => { if(!isActive) e.currentTarget.style.color="#6B7280"; }}>
              <span style={{ color:isActive?color:"#9CA3AF", display:"flex", transition:"color 130ms" }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden", marginBottom:"14px", boxShadow:"0 1px 3px rgba(0,0,0,0.03)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px" }}>
          <Search size={13} color="#C4C9D4" style={{ flexShrink:0 }} />
          <input value={search} onChange={(e)=>setSearch(e.target.value)}
            placeholder={`Search ${currentTab.label.toLowerCase()}…`}
            style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:"13px", color:"#111827", fontFamily:ff }} />
          {activeTab==="brokers" && (
            <button type="button" onClick={openBrokerCreate}
              style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 12px",borderRadius:"7px",border:"none",background:"#111827",color:"#FFF",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:ff,whiteSpace:"nowrap" }}>
              <Plus size={11}/> Add Broker
            </button>
          )}
          <div style={{ width:"1px",height:"20px",background:"#F0F0F0",flexShrink:0 }} />
          <button type="button" onClick={() => setFiltersOpen((p)=>!p)}
            style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 10px",borderRadius:"7px",border:`1px solid ${activeFilterCount>0?"#BFDBFE":"#E5E7EB"}`,background:activeFilterCount>0?"#EFF6FF":"#FAFAFA",color:activeFilterCount>0?"#2563EB":"#6B7280",fontSize:"11.5px",fontWeight:700,cursor:"pointer",fontFamily:ff,transition:"all 120ms",whiteSpace:"nowrap" }}>
            <SlidersHorizontal size={11}/>
            Filters
            {activeFilterCount>0 && <span style={{ minWidth:"16px",height:"16px",borderRadius:"8px",background:"#2563EB",color:"#FFF",fontSize:"9px",fontWeight:800,display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"0 4px" }}>{activeFilterCount}</span>}
            <ChevronDown size={10} style={{ transform:filtersOpen?"rotate(180deg)":"none",transition:"transform 150ms" }}/>
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding:"10px 12px",display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"flex-end",borderTop:"1px solid #F5F6F7",background:"#FAFAFA" }}>
            <div style={{ display:"flex",flexDirection:"column",gap:"3px" }}>
              <span style={{ fontSize:"10px",fontWeight:800,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:ff }}>Status</span>
              <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{ ...selectStyle,width:"160px" }}>
                {statusOptions.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {activeTab==="tenants" && (
              <div style={{ display:"flex",flexDirection:"column",gap:"3px" }}>
                <span style={{ fontSize:"10px",fontWeight:800,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:ff }}>Lease Status</span>
                <select value={secondaryFilter} onChange={(e)=>setSecondaryFilter(e.target.value)} style={{ ...selectStyle,width:"160px" }}>
                  {LEASE_STATUS_OPTIONS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            {activeTab==="home-staff" && (
              <div style={{ display:"flex",flexDirection:"column",gap:"3px" }}>
                <span style={{ fontSize:"10px",fontWeight:800,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:ff }}>Staff Type</span>
                <select value={secondaryFilter} onChange={(e)=>setSecondaryFilter(e.target.value)} style={{ ...selectStyle,width:"160px" }}>
                  {STAFF_TYPE_OPTIONS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            )}
            {activeFilterCount>0 && (
              <button type="button" onClick={()=>{setStatusFilter("all");setSecondaryFilter("all");}}
                style={{ padding:"5px 10px",borderRadius:"7px",border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:"11.5px",fontWeight:700,cursor:"pointer",fontFamily:ff,display:"flex",alignItems:"center",gap:"4px" }}>
                <XCircle size={11}/> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {renderTable()}

      {/* ── User detail drawer ── */}
      <DrawerForm open={detailOpen} onOpenChange={setDetailOpen} title="User Profile" description="Profile, activity, and linked records" width={500}>
        {detailLoading||!userDetail ? (
          <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
            <div style={{ display:"flex",gap:"12px",alignItems:"center",padding:"16px",borderRadius:"12px",background:"#F9FAFB",border:"1px solid #F0F0F0" }}>
              <div style={{ width:52,height:52,borderRadius:"50%",background:"linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)",backgroundSize:"400% 100%",animation:"shimmer 1.4s ease infinite",flexShrink:0 }} />
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:"8px" }}>
                <div style={{ height:"16px",borderRadius:"5px",width:"140px",background:"linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)",backgroundSize:"400% 100%",animation:"shimmer 1.4s ease infinite" }} />
                <div style={{ height:"12px",borderRadius:"5px",width:"90px",background:"linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)",backgroundSize:"400% 100%",animation:"shimmer 1.4s ease infinite" }} />
              </div>
            </div>
            {Array.from({length:5}).map((_,i) => (
              <div key={i} style={{ height:"14px",borderRadius:"5px",background:"linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)",backgroundSize:"400% 100%",animation:"shimmer 1.4s ease infinite",animationDelay:`${i*60}ms` }} />
            ))}
          </div>
        ) : (
          <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>

            {/* Profile hero card */}
            <div style={{ borderRadius:"12px",background:"linear-gradient(135deg,#111827 0%,#1F2937 100%)",padding:"16px",display:"flex",alignItems:"center",gap:"14px",position:"relative",overflow:"hidden" }}>
              <div style={{ position:"absolute",top:0,right:0,width:"120px",height:"120px",borderRadius:"50%",background:"radial-gradient(circle,rgba(255,255,255,0.05) 0%,transparent 70%)",pointerEvents:"none" }} />
              <AvatarBubble name={userDetail.name} src={userDetail.profilePhotoUrl} size={52} />
              <div style={{ minWidth:0,flex:1 }}>
                <p style={{ fontSize:"15px",fontWeight:900,color:"#FFF",margin:"0 0 6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",letterSpacing:"-0.02em" }}>{userDetail.name}</p>
                <div style={{ display:"flex",gap:"5px",flexWrap:"wrap" }}>
                  <StatusBadge value={userDetail.userType} />
                  <StatusBadge value={userDetail.status} />
                </div>
              </div>
            </div>

            {/* Quick stats row */}
            <div style={{ display:"flex",gap:"6px" }}>
              <MiniStat label="Complaints" value={userDetail.linkedRecords.complaints} color="#DC2626" />
              <MiniStat label="Violations"  value={userDetail.linkedRecords.violations}  color="#D97706" />
              <MiniStat label="Leases"      value={userDetail.linkedRecords.leases.length} color="#059669" />
            </div>

            {/* Sub-tabs */}
            <div style={{ display:"flex",gap:"2px",padding:"3px",borderRadius:"9px",border:"1px solid #EBEBEB",background:"#F5F6F7" }}>
              {(["profile","activity","linked"] as const).map((t) => {
                const isA = detailTab===t;
                const lbl = t==="profile"?"Profile":t==="activity"?"Activity":"Linked";
                return (
                  <button key={t} type="button" onClick={()=>setDetailTab(t)}
                    style={{ flex:1,padding:"6px",borderRadius:"7px",fontSize:"12px",fontWeight:700,fontFamily:ff,cursor:"pointer",border:"none",background:isA?"#FFF":"transparent",color:isA?"#111827":"#6B7280",boxShadow:isA?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 120ms" }}>
                    {lbl}
                  </button>
                );
              })}
            </div>

            {/* Profile */}
            {detailTab==="profile" && (
              <div>
                <FieldRow icon={<Mail size={13}/>}      label="Email"      value={<span style={{ fontFamily:ffMono,fontSize:"12px" }}>{userDetail.email||"—"}</span>} />
                <FieldRow icon={<Phone size={13}/>}     label="Phone"      value={<span style={{ fontFamily:ffMono,fontSize:"12px" }}>{userDetail.phone||"—"}</span>} />
                <FieldRow icon={<Clock size={13}/>}     label="Last Login" value={<span style={{ fontFamily:ffMono,fontSize:"12px" }}>{formatDateTime(userDetail.lastLoginAt)}</span>} />
                <FieldRow icon={<Clock size={13}/>}     label="Created"    value={<span style={{ fontFamily:ffMono,fontSize:"12px" }}>{formatDateTime(userDetail.createdAt)}</span>} />
                {userDetail.ownerData     && <FieldRow icon={<Building2 size={13}/>} label="Owner Units"     value={userDetail.ownerData.units.map((u)=>u.unitNumber).join(", ")||"—"} />}
                {userDetail.tenantData    && <FieldRow icon={<Home size={13}/>}      label="Tenant Lease"    value={`${formatDate(userDetail.tenantData.lease.startDate)} – ${formatDate(userDetail.tenantData.lease.endDate)}`} />}
                {userDetail.familyData    && <FieldRow icon={<Users size={13}/>}     label="Relationship"    value={userDetail.familyData.relationship} />}
                {userDetail.delegateData  && <FieldRow icon={<Shield size={13}/>}    label="Scopes"          value={userDetail.delegateData.permissions.join(", ")||"—"} />}
                {userDetail.homeStaffData && <FieldRow icon={<HardHat size={13}/>}   label="Staff Type"      value={userDetail.homeStaffData.staffType} />}
                {userDetail.brokerData    && <FieldRow icon={<Briefcase size={13}/>} label="Agency"          value={userDetail.brokerData.agencyName||"—"} />}
              </div>
            )}

            {/* Activity */}
            {detailTab==="activity" && (
              <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
                {!userDetail.activity.length ? (
                  <div style={{ textAlign:"center",padding:"32px 16px" }}>
                    <Clock size={28} color="#E5E7EB" style={{ margin:"0 auto 8px" }} />
                    <p style={{ fontSize:"13px",fontWeight:700,color:"#9CA3AF",margin:0,fontFamily:ff }}>No activity yet</p>
                  </div>
                ) : userDetail.activity.map((a) => (
                  <div key={a.id} style={{ borderRadius:"9px",border:"1px solid #F0F0F0",padding:"10px 12px",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"10px",background:"#FAFAFA" }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                      <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:a.newStatus==="ACTIVE"?"#22C55E":a.newStatus==="SUSPENDED"?"#EF4444":"#F59E0B",flexShrink:0,marginTop:"2px" }} />
                      <div>
                        <StatusBadge value={a.newStatus} />
                        <p style={{ fontSize:"11.5px",color:"#6B7280",margin:"3px 0 0",fontFamily:ff }}>{a.note||"No note"}</p>
                      </div>
                    </div>
                    <span style={{ fontSize:"10.5px",color:"#9CA3AF",fontFamily:ffMono,flexShrink:0,whiteSpace:"nowrap" }}>{formatDateTime(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Linked */}
            {detailTab==="linked" && (
              <div>
                <FieldRow icon={<Building2 size={13}/>}  label="Units"      value={userDetail.linkedRecords.units.map((u)=>u.unitNumber).join(", ")||"—"} />
                <FieldRow icon={<Link size={13}/>}        label="Leases"     value={String(userDetail.linkedRecords.leases.length)} />
                <FieldRow icon={<AlertCircle size={13}/>} label="Complaints" value={String(userDetail.linkedRecords.complaints)} />
                <FieldRow icon={<XCircle size={13}/>}     label="Violations" value={String(userDetail.linkedRecords.violations)} />
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display:"flex",gap:"6px",justifyContent:"flex-end",paddingTop:"4px",borderTop:"1px solid #F5F6F7",marginTop:"4px" }}>
              {detailBroker && (
                <button type="button" onClick={()=>openBrokerEdit(detailBroker)}
                  style={{ display:"flex",alignItems:"center",gap:"5px",padding:"8px 14px",borderRadius:"8px",border:"1px solid #E5E7EB",background:"#FFF",color:"#374151",fontSize:"12.5px",fontWeight:700,fontFamily:ff,cursor:"pointer" }}>
                  <MoreHorizontal size={13}/> Edit Broker
                </button>
              )}
              <button type="button" onClick={()=>void suspendOrActivate(userDetail.id,userDetail.status)}
                style={{ display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"8px",border:"none",background:userDetail.status==="SUSPENDED"?"#111827":"#FEF2F2",color:userDetail.status==="SUSPENDED"?"#FFF":"#B91C1C",fontSize:"12.5px",fontWeight:700,fontFamily:ff,cursor:"pointer",transition:"opacity 120ms" }}
                onMouseEnter={(e)=>e.currentTarget.style.opacity="0.85"} onMouseLeave={(e)=>e.currentTarget.style.opacity="1"}>
                {userDetail.status==="SUSPENDED"
                  ? <><CheckCircle2 size={13}/> Activate User</>
                  : <><XCircle size={13}/> Suspend User</>}
              </button>
            </div>
          </div>
        )}
      </DrawerForm>

      {/* ── Broker drawer ── */}
      <DrawerForm
        open={brokerDrawerOpen}
        onOpenChange={setBrokerDrawerOpen}
        title={editingBroker?"Edit Broker":"Add Broker"}
        description="Create or update broker profile details."
        width={440}
        footer={
          <>
            <button type="button" onClick={()=>setBrokerDrawerOpen(false)} disabled={brokerSaving}
              style={{ padding:"8px 16px",borderRadius:"8px",border:"1px solid #E5E7EB",background:"#FFF",color:"#6B7280",fontSize:"12.5px",fontWeight:700,fontFamily:ff,cursor:brokerSaving?"not-allowed":"pointer",opacity:brokerSaving?0.5:1 }}>
              Cancel
            </button>
            <button type="button" onClick={()=>void saveBroker()} disabled={brokerSaving}
              style={{ padding:"8px 20px",borderRadius:"8px",border:"none",background:"#111827",color:"#FFF",fontSize:"12.5px",fontWeight:700,fontFamily:ff,cursor:brokerSaving?"not-allowed":"pointer",opacity:brokerSaving?0.7:1,boxShadow:"0 1px 3px rgba(0,0,0,0.2)",transition:"opacity 120ms" }}>
              {brokerSaving?"Saving…":editingBroker?"Update Broker":"Create Broker"}
            </button>
          </>
        }
      >
        {/* Broker hero */}
        <div style={{ borderRadius:"10px",background:"#F9FAFB",border:"1px solid #F0F0F0",padding:"14px",marginBottom:"4px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
            <div style={{ width:"40px",height:"40px",borderRadius:"10px",background:"#111827",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <Briefcase size={18} color="#FFF" />
            </div>
            <div>
              <p style={{ fontSize:"13.5px",fontWeight:800,color:"#111827",margin:0,fontFamily:ff }}>{editingBroker?editingBroker.name:"New Broker"}</p>
              <p style={{ fontSize:"11.5px",color:"#9CA3AF",margin:"2px 0 0",fontFamily:ff }}>{editingBroker?"Editing existing profile":"Fill in the details below"}</p>
            </div>
          </div>
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:"11px" }}>
          <DrawerField label="Full Name"      value={brokerForm.name}          onChange={(v)=>setBrokerForm((p)=>({...p,name:v}))}          placeholder="Broker full name"  icon={<User size={13}/>} />
          <DrawerField label="Email"          value={brokerForm.email}         onChange={(v)=>setBrokerForm((p)=>({...p,email:v}))}         placeholder="broker@email.com" type="email" icon={<Mail size={13}/>} />
          <DrawerField label="Phone"          value={brokerForm.phone}         onChange={(v)=>setBrokerForm((p)=>({...p,phone:v}))}         placeholder="+1 …"             icon={<Phone size={13}/>} />
          <DrawerField label="Agency"         value={brokerForm.agencyName}    onChange={(v)=>setBrokerForm((p)=>({...p,agencyName:v}))}    placeholder="Agency name"      icon={<Building2 size={13}/>} />
          <DrawerField label="License Number" value={brokerForm.licenseNumber} onChange={(v)=>setBrokerForm((p)=>({...p,licenseNumber:v}))} placeholder="License #"        icon={<Shield size={13}/>} />
        </div>
      </DrawerForm>

      <style>{`
        @keyframes shimmer { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
