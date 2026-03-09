import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, Check, ChevronDown, Clock,
  Eye, Filter, MessageSquare, RefreshCw, RotateCcw,
  Search, Send, SlidersHorizontal, UserX, X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { StatCard } from "../StatCard";
import apiClient from "../../lib/api-client";
import {
  errorMessage, extractRows, formatDateTime,
  getPriorityColorClass, getStatusColorClass, humanizeEnum,
} from "../../lib/live-data";
import { adminPriorityLabel, adminTicketStatusLabel } from "../../lib/status-labels";

// ─── Types ────────────────────────────────────────────────────

type TicketTab    = "all" | "services" | "requests" | "complaints";
type TicketPreset = "all" | "pending"  | "overdue"  | "closed";
type PendingFocusEntity = {
  section?: string; entityType?: string | null;
  entityId?: string | null; serviceCategory?: string | null;
};

const SERVICE_STATUSES   = ["NEW","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED"] as const;
const COMPLAINT_STATUSES = ["NEW","IN_PROGRESS","PENDING_RESIDENT","RESOLVED","CLOSED"] as const;
const STATUS_FILTERS     = ["all","NEW","IN_PROGRESS","PENDING_RESIDENT","RESOLVED","CLOSED","CANCELLED"] as const;

// ─── Helpers ──────────────────────────────────────────────────

function isRequestCategory(v?: string | null) {
  const x = String(v ?? "").toUpperCase();
  return x === "REQUESTS" || x === "ADMIN";
}

function kindMeta(kind: string) {
  if (kind === "COMPLAINT") return { bg:"#FEF2F2", color:"#B91C1C", border:"#FECACA", label:"Complaint" };
  if (kind === "REQUEST")   return { bg:"#F5F3FF", color:"#6D28D9", border:"#DDD6FE", label:"Request"   };
  return                           { bg:"#EFF6FF", color:"#1D4ED8", border:"#BFDBFE", label:"Service"   };
}

// ─── Style tokens ─────────────────────────────────────────────

const ff     = "'Work Sans', sans-serif";
const ffMono = "'DM Mono', monospace";

const inputBase: React.CSSProperties = {
  height:"36px", borderRadius:"7px", border:"1px solid #E5E7EB",
  background:"#FFF", fontFamily:ff, fontSize:"12.5px", color:"#111827",
  outline:"none", padding:"0 10px", boxSizing:"border-box", width:"100%",
};
const selectBase: React.CSSProperties  = { ...inputBase, cursor:"pointer" };
const textareaBase: React.CSSProperties = { ...inputBase, height:"auto", resize:"vertical", padding:"8px 10px" };

// ─── Primitives ───────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"12px", paddingBottom:"8px", borderBottom:"1px solid #F3F4F6" }}>
      <span style={{ color:"#9CA3AF", display:"flex" }}>{icon}</span>
      <span style={{ fontSize:"10.5px", fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>{label}</span>
    </div>
  );
}

function KindPill({ kind }: { kind: string }) {
  const m = kindMeta(kind);
  return (
    <span style={{ fontSize:"10.5px", fontWeight:700, padding:"2px 7px", borderRadius:"4px", background:m.bg, color:m.color, border:`1px solid ${m.border}`, fontFamily:ff, whiteSpace:"nowrap" }}>
      {m.label}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width:"34px", height:"20px", borderRadius:"10px", border:"none", outline:"none", cursor:"pointer", background:checked?"#111827":"#E5E7EB", position:"relative", transition:"background 180ms", flexShrink:0 }}>
      <span style={{ position:"absolute", top:"2px", left:checked?"16px":"2px", width:"16px", height:"16px", borderRadius:"50%", background:"#FFF", transition:"left 180ms", boxShadow:"0 1px 3px rgba(0,0,0,0.18)" }} />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display:"flex", gap:"12px", padding:"12px 14px", borderBottom:"1px solid #F9FAFB" }}>
      {[80,220,140,70,60,80,100].map((w,i) => (
        <div key={i} style={{ height:"14px", borderRadius:"4px", width:w, background:"linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize:"400% 100%", animation:"shimmer 1.4s ease infinite" }} />
      ))}
    </div>
  );
}

// ─── Ticket row ───────────────────────────────────────────────

function TicketRow({ row, onOpen }: { row: any; onOpen: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{ display:"grid", gridTemplateColumns:"112px 1fr 160px 80px 90px 96px 120px 38px", alignItems:"center", gap:"10px", padding:"10px 14px", borderBottom:"1px solid #F9FAFB", background:hov?"#FAFAFA":"#FFF", transition:"background 100ms" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
        <KindPill kind={row.kind} />
        {row.isUrgent && (
          <span style={{ fontSize:"10px", fontWeight:700, padding:"1px 6px", borderRadius:"3px", background:"#FEF2F2", color:"#B91C1C", border:"1px solid #FECACA", textAlign:"center", fontFamily:ff }}>Urgent</span>
        )}
      </div>

      <div style={{ minWidth:0 }}>
        <p style={{ fontSize:"13px", fontWeight:600, color:"#111827", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.title}</p>
        <p style={{ fontSize:"11px", color:"#9CA3AF", margin:"2px 0 0", fontFamily:ffMono, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {row.kind === "COMPLAINT" ? (row.raw?.complaintNumber || row.id.slice(0,8)) : row.id.slice(0,8)}
          {row.kind === "COMPLAINT" && row.team ? ` · ${row.team}` : ""}
        </p>
      </div>

      <div style={{ minWidth:0 }}>
        <p style={{ fontSize:"12.5px", color:"#374151", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.residentName}</p>
        <p style={{ fontSize:"11px",   color:"#9CA3AF", margin:"2px 0 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.residentSub}</p>
      </div>

      <span style={{ fontSize:"12px", color:"#6B7280", fontFamily:ffMono, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.unitLabel}</span>

      <span className={getPriorityColorClass(row.priority||"MEDIUM")} style={{ fontSize:"11px", fontWeight:700, padding:"2px 7px", borderRadius:"5px", whiteSpace:"nowrap", width:"fit-content" }}>
        {adminPriorityLabel(row.priority||"MEDIUM")}
      </span>

      <span className={getStatusColorClass(row.status)} style={{ fontSize:"11px", fontWeight:700, padding:"2px 7px", borderRadius:"5px", whiteSpace:"nowrap", width:"fit-content" }}>
        {adminTicketStatusLabel(row.kind, row.status)}
      </span>

      <span style={{ fontSize:"10.5px", color:"#9CA3AF", fontFamily:ffMono, whiteSpace:"nowrap" }}>{formatDateTime(row.updatedAt||row.createdAt)}</span>

      <button type="button" onClick={onOpen}
        style={{ width:"32px", height:"32px", borderRadius:"7px", border:"1px solid #E5E7EB", background:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#6B7280", transition:"all 120ms", flexShrink:0 }}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style,{ background:"#111827", color:"#FFF", borderColor:"#111827" })}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style,{ background:"#FFF",    color:"#6B7280", borderColor:"#E5E7EB" })}>
        <Eye style={{ width:"12px", height:"12px" }} />
      </button>
    </div>
  );
}

// ─── Comment bubble ───────────────────────────────────────────

function CommentBubble({ c, isAdmin }: { c: any; isAdmin?: boolean }) {
  const alignRight = isAdmin;
  return (
    <div style={{ display:"flex", justifyContent:alignRight?"flex-end":"flex-start" }}>
      <div style={{
        borderRadius:"10px",
        borderBottomRightRadius:alignRight?"2px":"10px",
        borderBottomLeftRadius:alignRight?"10px":"2px",
        border:`1px solid ${c.isInternal?"#FDE68A":alignRight?"#BFDBFE":"#EBEBEB"}`,
        background:c.isInternal?"#FFFBEB":alignRight?"#EFF6FF":"#FAFAFA",
        padding:"10px 12px",
        maxWidth:"85%",
        minWidth:"180px",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", marginBottom:"5px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
            <span style={{ fontSize:"12.5px", fontWeight:700, color:"#111827", fontFamily:ff }}>{c?.createdBy?.nameEN||c?.createdBy?.email||"User"}</span>
            <span style={{ fontSize:"10px", fontWeight:700, padding:"1px 6px", borderRadius:"3px", background:c.isInternal?"#FEF3C7":alignRight?"#DBEAFE":"#ECFDF5", color:c.isInternal?"#B45309":alignRight?"#1D4ED8":"#059669", border:`1px solid ${c.isInternal?"#FDE68A":alignRight?"#93C5FD":"#A7F3D0"}`, fontFamily:ff }}>
              {c.isInternal?"Internal":alignRight?"Admin":"Resident"}
            </span>
          </div>
          <span style={{ fontSize:"10.5px", color:"#9CA3AF", fontFamily:ffMono }}>{formatDateTime(c.createdAt)}</span>
        </div>
        <p style={{ fontSize:"12.5px", color:"#374151", margin:0, whiteSpace:"pre-wrap", lineHeight:1.55, fontFamily:ff }}>{c.body}</p>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────

const SERVICE_LIFECYCLE  = ["NEW","IN_PROGRESS","RESOLVED","CLOSED"] as const;
const COMPLAINT_LIFECYCLE = ["NEW","IN_PROGRESS","RESOLVED","CLOSED"] as const;

function TicketProgressBar({ kind, status }: { kind: string; status: string }) {
  const stages = kind === "COMPLAINT" ? COMPLAINT_LIFECYCLE : SERVICE_LIFECYCLE;
  const normalizedStatus = String(status||"NEW").toUpperCase();

  // Map PENDING_RESIDENT / CANCELLED to nearest stage
  let currentIdx: number;
  if (normalizedStatus === "CANCELLED") {
    currentIdx = -1; // special: show as terminated
  } else if (normalizedStatus === "PENDING_RESIDENT") {
    currentIdx = stages.indexOf("IN_PROGRESS");
  } else {
    currentIdx = stages.indexOf(normalizedStatus as any);
    if (currentIdx < 0) currentIdx = 0;
  }

  const isCancelled = normalizedStatus === "CANCELLED";

  const stageColors: Record<string, { active: string; label: string }> = {
    NEW:         { active:"#6B7280", label:"New" },
    IN_PROGRESS: { active:"#2563EB", label:"In Progress" },
    RESOLVED:    { active:"#059669", label:"Resolved" },
    CLOSED:      { active:"#111827", label:"Closed" },
  };

  return (
    <div style={{ padding:"14px 0 4px" }}>
      {isCancelled ? (
        <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"8px", background:"#FEF2F2", border:"1px solid #FECACA" }}>
          <X style={{ width:"14px", height:"14px", color:"#DC2626" }} />
          <span style={{ fontSize:"12.5px", fontWeight:700, color:"#DC2626", fontFamily:ff }}>Ticket Cancelled</span>
        </div>
      ) : (
        <div style={{ position:"relative" }}>
          {/* Track line */}
          <div style={{ position:"absolute", top:"14px", left:"16px", right:"16px", height:"3px", background:"#E5E7EB", borderRadius:"2px", zIndex:0 }} />
          {/* Filled track */}
          <div style={{
            position:"absolute", top:"14px", left:"16px", height:"3px", borderRadius:"2px", zIndex:1,
            width: currentIdx <= 0 ? "0%" : `${(currentIdx / (stages.length - 1)) * 100}%`,
            maxWidth:"calc(100% - 32px)",
            background: stageColors[stages[currentIdx]]?.active || "#2563EB",
            transition:"width 400ms ease",
          }} />
          {/* Stage dots */}
          <div style={{ display:"flex", justifyContent:"space-between", position:"relative", zIndex:2 }}>
            {stages.map((s, i) => {
              const isPast = i < currentIdx;
              const isCurrent = i === currentIdx;
              const sc = stageColors[s];
              const dotColor = isCurrent ? sc.active : isPast ? sc.active : "#D1D5DB";
              const isPendingResident = normalizedStatus === "PENDING_RESIDENT" && s === "IN_PROGRESS";
              return (
                <div key={s} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", minWidth:"60px" }}>
                  <div style={{
                    width: isCurrent ? "28px" : "20px",
                    height: isCurrent ? "28px" : "20px",
                    borderRadius:"50%",
                    background: (isPast || isCurrent) ? dotColor : "#FFF",
                    border: `2.5px solid ${dotColor}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    transition:"all 300ms ease",
                    boxShadow: isCurrent ? `0 0 0 4px ${dotColor}20` : "none",
                  }}>
                    {isPast && <Check style={{ width:"10px", height:"10px", color:"#FFF" }} />}
                    {isCurrent && !isPast && (
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#FFF" }} />
                    )}
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <span style={{
                      fontSize: isCurrent ? "11px" : "10px",
                      fontWeight: isCurrent ? 800 : isPast ? 600 : 500,
                      color: isCurrent ? dotColor : isPast ? "#374151" : "#9CA3AF",
                      fontFamily: ff,
                    }}>
                      {sc.label}
                    </span>
                    {isPendingResident && (
                      <p style={{ fontSize:"9px", color:"#D97706", fontWeight:700, margin:"2px 0 0", fontFamily:ff }}>Awaiting Resident</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline item ────────────────────────────────────────────

function TimelineItem({ item }: { item: any }) {
  const isStatus = item.type === "status";
  return (
    <div style={{ borderRadius:"7px", border:"1px solid #EBEBEB", background:"#FFF", padding:"9px 12px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"8px" }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:item.body?"5px":0 }}>
            <span style={{ fontSize:"10px", fontWeight:700, padding:"1px 6px", borderRadius:"3px", background:isStatus?"#EFF6FF":item.isInternal?"#FEF3C7":"#ECFDF5", color:isStatus?"#1D4ED8":item.isInternal?"#B45309":"#059669", fontFamily:ff, whiteSpace:"nowrap" }}>
              {isStatus?"Status":item.isInternal?"Internal":"Reply"}
            </span>
            <span style={{ fontSize:"12.5px", fontWeight:600, color:"#374151", fontFamily:ff, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
          </div>
          {item.body && <p style={{ fontSize:"12px", color:"#6B7280", margin:0, whiteSpace:"pre-wrap", lineHeight:1.4, fontFamily:ff }}>{item.body}</p>}
        </div>
        <span style={{ fontSize:"10px", color:"#9CA3AF", fontFamily:ffMono, flexShrink:0 }}>{formatDateTime(item.at)}</span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function TicketsInbox() {
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<TicketTab>("all");
  const [search,   setSearch]   = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [ticketPreset,   setTicketPreset]   = useState<TicketPreset>("all");
  const [unitFilter,     setUnitFilter]     = useState("all");
  const [residentFilter, setResidentFilter] = useState("all");
  const [fromDate,   setFromDate]   = useState("");
  const [toDate,     setToDate]     = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [filtersOpen,setFiltersOpen]= useState(false);

  const [serviceRows,  setServiceRows]  = useState<any[]>([]);
  const [complaintRows,setComplaintRows]= useState<any[]>([]);
  const [units,     setUnits]     = useState<Array<{id:string;label:string}>>([]);
  const [residents, setResidents] = useState<Array<{id:string;label:string}>>([]);

  const [dialogOpen,        setDialogOpen]        = useState(false);
  const [active,            setActive]            = useState<any>(null);
  const [replyText,         setReplyText]         = useState("");
  const [replyInternal,     setReplyInternal]     = useState(false);
  const [replySubmitting,   setReplySubmitting]   = useState(false);
  const [statusSubmitting,  setStatusSubmitting]  = useState(false);
  const [returnOpen,        setReturnOpen]        = useState(false);
  const [returnMsg,         setReturnMsg]         = useState("");
  const [returnSubmitting,  setReturnSubmitting]  = useState(false);

  // persist filters
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("admin.ticketsInbox.filters");
      if (!raw) return;
      const p = JSON.parse(raw);
      setSearch(String(p.search??""));
      setStatusFilter(String(p.statusFilter??"all"));
      if (["services","requests","complaints"].includes(p.tab)) setTab(p.tab);
      if (["pending","overdue","closed"].includes(p.preset))   setTicketPreset(p.preset);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("admin.ticketsInbox.filters", JSON.stringify({ search, statusFilter, tab, preset:ticketPreset })); }
    catch { /* ignore */ }
  }, [search, statusFilter, tab, ticketPreset]);

  const resetFilters = useCallback(() => {
    setTab("all"); setTicketPreset("all"); setSearch(""); setStatusFilter("all");
    setUnitFilter("all"); setResidentFilter("all"); setFromDate(""); setToDate(""); setUrgentOnly(false);
    try { window.localStorage.removeItem("admin.ticketsInbox.filters"); } catch { /* ignore */ }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [srRes, cRes, userRes, unitRes] = await Promise.all([
        apiClient.get("/service-requests"),
        apiClient.get("/complaints", { params:{ page:1, limit:100 } }),
        apiClient.get("/admin/users", { params:{ userType:"resident", take:500, skip:0 } }),
        apiClient.get("/units", { params:{ page:1, limit:100 } }),
      ]);
      setServiceRows(Array.isArray(srRes.data) ? srRes.data : []);
      setComplaintRows(extractRows(cRes.data));
      setResidents(extractRows<any>(userRes.data).map((u) => ({ id:String(u.id), label:u.nameEN??u.nameAR??u.email??u.phone??String(u.id) })));
      setUnits(extractRows<any>(unitRes.data).map((u) => ({ id:String(u.id), label:[u.projectName, u.block?`Block ${u.block}`:null, u.unitNumber?`Unit ${u.unitNumber}`:null].filter(Boolean).join(" - ")||String(u.id) })));
    } catch (e) { toast.error("Failed to load tickets", { description:errorMessage(e) }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const rows = useMemo(() => {
    const services = serviceRows.map((r:any) => {
      const kind = isRequestCategory(r?.service?.category) ? "REQUEST" : "SERVICE";
      return { key:`${kind}:${r.id}`, id:r.id, kind, title:r?.service?.name||(kind==="REQUEST"?"Request Ticket":"Service Ticket"), status:String(r.status||"NEW").toUpperCase(), priority:r.priority||"MEDIUM", updatedAt:r.updatedAt||r.requestedAt, createdAt:r.requestedAt||r.updatedAt, isUrgent:Boolean(r?.service?.isUrgent)||String(r?.priority||"").toUpperCase()==="CRITICAL", residentId:r?.createdBy?.id||"", residentName:r?.createdBy?.nameEN||r?.createdBy?.email||"—", residentSub:r?.createdBy?.email||r?.createdBy?.phone||"—", unitId:r?.unit?.id||"", unitLabel:`${r?.unit?.block?`${r.unit.block} · `:""}${r?.unit?.unitNumber||"—"}`, raw:r };
    });
    const complaints = complaintRows.map((c:any) => ({ key:`COMPLAINT:${c.id}`, id:c.id, kind:"COMPLAINT", title:String(c?.title||"").trim()||(c?.category?`${humanizeEnum(c.category)} Complaint`:"Complaint"), team:String(c?.team||"").trim()||null, status:String(c.status||"NEW").toUpperCase(), priority:c.priority||"MEDIUM", updatedAt:c.updatedAt||c.createdAt, createdAt:c.createdAt, residentId:c.reporterId||c?.reporter?.id||"", residentName:c?.reporter?.nameEN||c?.reporter?.email||"—", residentSub:c?.reporter?.email||c?.reporter?.phone||"—", unitId:c.unitId||c?.unit?.id||"", unitLabel:`${c?.unit?.block?`${c.unit.block} · `:""}${c?.unit?.unitNumber||"—"}`, raw:c }));
    return [...services,...complaints].sort((a,b)=>(b.updatedAt?new Date(b.updatedAt).getTime():0)-(a.updatedAt?new Date(a.updatedAt).getTime():0));
  }, [serviceRows, complaintRows]);

  const counts = useMemo(() => ({
    all:       rows.length,
    services:  rows.filter((r)=>r.kind==="SERVICE").length,
    requests:  rows.filter((r)=>r.kind==="REQUEST").length,
    complaints:rows.filter((r)=>r.kind==="COMPLAINT").length,
    urgent:    rows.filter((r)=>(r.kind==="SERVICE"||r.kind==="REQUEST")&&r.isUrgent).length,
  }), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toTs   = toDate   ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    const now = Date.now();
    return rows.filter((r) => {
      if (tab==="services"   && r.kind!=="SERVICE")   return false;
      if (tab==="requests"   && r.kind!=="REQUEST")   return false;
      if (tab==="complaints" && r.kind!=="COMPLAINT") return false;
      if (statusFilter!=="all" && r.status!==statusFilter) return false;
      if (ticketPreset==="pending" && !["NEW","IN_PROGRESS","PENDING_RESIDENT"].includes(r.status)) return false;
      if (ticketPreset==="closed"  && !["RESOLVED","CLOSED","CANCELLED"].includes(r.status))       return false;
      if (ticketPreset==="overdue") {
        if (!["NEW","IN_PROGRESS","PENDING_RESIDENT"].includes(r.status)) return false;
        const ts = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
        if (!Number.isFinite(ts)||now-ts<86_400_000) return false;
      }
      if (unitFilter!=="all"     && String(r.unitId||"")!==unitFilter)     return false;
      if (residentFilter!=="all" && String(r.residentId||"")!==residentFilter) return false;
      if (urgentOnly && (r.kind==="COMPLAINT"||!r.isUrgent)) return false;
      const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
      if (fromTs!=null && ts<fromTs) return false;
      if (toTs  !=null && ts>toTs)   return false;
      if (q) { const blob=[r.id,r.title,r.team,r.kind,r.status,r.priority,r.residentName,r.residentSub,r.unitLabel].filter(Boolean).join(" ").toLowerCase(); if(!blob.includes(q)) return false; }
      return true;
    });
  }, [rows, search, tab, statusFilter, ticketPreset, unitFilter, residentFilter, fromDate, toDate, urgentOnly]);

  const activeFilterCount = [statusFilter!=="all", unitFilter!=="all", residentFilter!=="all", fromDate, toDate, urgentOnly].filter(Boolean).length;

  // deep-link
  useEffect(() => {
    if (!rows.length) return;
    try {
      const raw = window.sessionStorage.getItem("admin.focusEntity");
      if (!raw) return;
      const p: PendingFocusEntity = JSON.parse(raw);
      const section = String(p?.section??"").trim().toLowerCase();
      const id      = String(p?.entityId??"").trim();
      const type    = String(p?.entityType??"").trim().toUpperCase();
      if (!id||section!=="tickets") return;
      const found = rows.find((r)=>String(r.id)===id&&(type==="COMPLAINT"?r.kind==="COMPLAINT":type==="SERVICE_REQUEST"?r.kind==="SERVICE"||r.kind==="REQUEST":true));
      if (!found) return;
      if (found.kind==="COMPLAINT") setTab("complaints");
      else if (found.kind==="REQUEST") setTab("requests");
      else setTab("services");
      window.sessionStorage.removeItem("admin.focusEntity");
      void loadTicketDetail(found);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const loadTicketDetail = useCallback(async (row: any) => {
    const base = { kind:row.kind, id:row.id, detail:row.raw, comments:[], statusDraft:row.status, resolutionNotesDraft:row.kind==="COMPLAINT"?String(row.raw?.resolutionNotes||""):"", loading:true };
    setActive(base); setDialogOpen(true); setReplyText(""); setReplyInternal(false); setReturnOpen(false); setReturnMsg("");
    try {
      if (row.kind==="COMPLAINT") {
        // GET /complaints/:id already includes comments in the response - no separate comments endpoint
        const d = await apiClient.get(`/complaints/${row.id}`);
        const comments = Array.isArray(d.data?.comments) ? d.data.comments : [];
        setActive({ ...base, detail:d.data, comments, statusDraft:String(d.data?.status||"NEW").toUpperCase(), resolutionNotesDraft:String(d.data?.resolutionNotes||""), loading:false });
      } else {
        // Service requests have a separate GET /service-requests/:id/comments endpoint
        const [d,c] = await Promise.all([apiClient.get(`/service-requests/${row.id}`), apiClient.get(`/service-requests/${row.id}/comments`)]);
        setActive({ ...base, detail:d.data, comments:Array.isArray(c.data)?c.data:[], statusDraft:String(d.data?.status||"NEW").toUpperCase(), loading:false });
      }
    } catch (e) {
      toast.error("Failed to load ticket", { description:errorMessage(e) });
      setActive((p:any) => p?{...p,loading:false}:p);
    }
  }, []);

  const refreshActive = useCallback(async () => {
    if (!active) return;
    const row = rows.find((r)=>r.id===active.id&&r.kind===active.kind);
    await loadTicketDetail(row||{ id:active.id, kind:active.kind, status:active.statusDraft||active.detail?.status||"NEW", raw:active.detail });
  }, [active, loadTicketDetail, rows]);

  const submitReply = useCallback(async () => {
    if (!active) return;
    const body = replyText.trim();
    if (!body) { toast.error("Reply message is required"); return; }
    setReplySubmitting(true);
    try {
      if (active.kind==="COMPLAINT") await apiClient.post(`/complaints/${active.id}/comments`, { body, isInternal:replyInternal });
      else                           await apiClient.post(`/service-requests/${active.id}/comments`, { body, isInternal:replyInternal });
      toast.success(replyInternal?"Internal note posted":"Reply posted");
      setReplyText(""); setReplyInternal(false);
      await Promise.all([loadAll(), refreshActive()]);
    } catch (e) { toast.error("Failed to post reply", { description:errorMessage(e) }); }
    finally { setReplySubmitting(false); }
  }, [active, loadAll, refreshActive, replyInternal, replyText]);

  const applyStatus = useCallback(async () => {
    if (!active?.statusDraft) return;
    setStatusSubmitting(true);
    try {
      if (active.kind==="COMPLAINT") {
        const s = String(active.statusDraft).toUpperCase();
        if ((s==="RESOLVED"||s==="CLOSED")&&!String(active.resolutionNotesDraft||"").trim()) { toast.error("Resolution notes required"); setStatusSubmitting(false); return; }
        await apiClient.patch(`/complaints/${active.id}/status`, { status:s, resolutionNotes:String(active.resolutionNotesDraft||"").trim()||undefined });
      } else {
        await apiClient.patch(`/service-requests/${active.id}`, { status:active.statusDraft });
      }
      toast.success("Status updated");
      await Promise.all([loadAll(), refreshActive()]);
    } catch (e) { toast.error("Failed to update", { description:errorMessage(e) }); }
    finally { setStatusSubmitting(false); }
  }, [active, loadAll, refreshActive]);

  const submitReturn = useCallback(async () => {
    if (!active||active.kind!=="COMPLAINT") return;
    const msg = returnMsg.trim();
    if (!msg) { toast.error("Message required"); return; }
    setReturnSubmitting(true);
    try {
      await apiClient.patch(`/complaints/${active.id}/return-to-resident`, { message:msg });
      toast.success("Complaint returned to resident");
      setReturnOpen(false); setReturnMsg("");
      await Promise.all([loadAll(), refreshActive()]);
    } catch (e) { toast.error("Failed to return", { description:errorMessage(e) }); }
    finally { setReturnSubmitting(false); }
  }, [active, loadAll, refreshActive, returnMsg]);

  const activityRows = useMemo(() => {
    if (!active?.detail) return [];
    const createdAt = active.kind==="COMPLAINT" ? active.detail.createdAt : active.detail.requestedAt||active.detail.createdAt;
    const items: any[] = [
      { id:"created", type:"status", title:`${humanizeEnum(active.kind)} submitted`, at:createdAt },
      { id:"current", type:"status", title:`Status: ${adminTicketStatusLabel(active.kind, active.detail.status)}`, at:active.detail.updatedAt||createdAt },
    ];
    for (const c of active.comments||[]) items.push({ id:`c-${c.id}`, type:"comment", title:c?.createdBy?.nameEN||c?.createdBy?.email||"User", body:c.body, at:c.createdAt, isInternal:!!c.isInternal });
    return items.sort((a,b)=>new Date(b.at||0).getTime()-new Date(a.at||0).getTime());
  }, [active]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div style={{ fontFamily:ff }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"20px", flexWrap:"wrap" }}>
        <div>
          <h1 style={{ fontSize:"18px", fontWeight:900, color:"#111827", letterSpacing:"-0.02em", margin:0 }}>Tickets Inbox</h1>
          <p style={{ marginTop:"4px", fontSize:"13px", color:"#6B7280" }}>Unified view for resident service tickets, requests, and complaints.</p>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button type="button" onClick={resetFilters}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px", background:"#FFF", color:"#6B7280", border:"1px solid #E5E7EB", cursor:"pointer", fontSize:"12.5px", fontWeight:600, fontFamily:ff }}>
            <RotateCcw style={{ width:"12px", height:"12px" }} /> Reset Filters
          </button>
          <button type="button" onClick={() => void loadAll()} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px", background:"#111827", color:"#FFF", border:"none", cursor:loading?"not-allowed":"pointer", fontSize:"13px", fontWeight:700, fontFamily:ff, opacity:loading?0.7:1 }}>
            <RefreshCw style={{ width:"13px", height:"13px", animation:loading?"spin 1s linear infinite":"none" }} />
            {loading?"Refreshing…":"Refresh"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px", marginBottom:"16px" }}>
        <StatCard icon="tickets"          title="Total"      value={String(counts.all)}        onClick={() => { setTab("all"); setTicketPreset("all"); }} />
        <StatCard icon="active-users"     title="Services"   value={String(counts.services)}   onClick={() => setTab("services")} />
        <StatCard icon="devices"          title="Requests"   value={String(counts.requests)}   onClick={() => setTab("requests")} />
        <StatCard icon="complaints-total" title="Complaints" value={String(counts.complaints)} onClick={() => setTab("complaints")} />
        <StatCard icon="complaints-open"  title="Urgent"     value={String(counts.urgent)}     onClick={() => { setTab("all"); setTicketPreset("pending"); }} />
      </div>

      {/* Tab switcher */}
      <div style={{ display:"flex", alignItems:"center", gap:"4px", marginBottom:"12px", padding:"4px", borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FAFAFA" }}>
        {(["all","services","requests","complaints"] as TicketTab[]).map((t) => {
          const isActive = tab===t;
          const label = t==="all"?`All (${counts.all})`:t==="services"?`Services (${counts.services})`:t==="requests"?`Requests (${counts.requests})`:`Complaints (${counts.complaints})`;
          return (
            <button key={t} type="button" onClick={() => setTab(t)}
              style={{ padding:"5px 14px", borderRadius:"6px", fontSize:"12px", fontWeight:700, fontFamily:ff, cursor:"pointer", border:"none", background:isActive?"#FFF":"transparent", color:isActive?"#111827":"#6B7280", boxShadow:isActive?"0 1px 3px rgba(0,0,0,0.1)":"none", transition:"all 120ms ease" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Preset chips */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"12px", flexWrap:"wrap" }}>
        {([
          { id:"all",     label:"All",     color:"#374151" },
          { id:"pending", label:"Pending", color:"#D97706" },
          { id:"overdue", label:"Overdue", color:"#DC2626" },
          { id:"closed",  label:"Closed",  color:"#059669" },
        ] as { id:TicketPreset; label:string; color:string }[]).map(({ id, label, color }) => {
          const isActive = ticketPreset===id;
          return (
            <button key={id} type="button"
              onClick={() => { setTicketPreset(id); if (id!=="all") setStatusFilter("all"); }}
              style={{ padding:"5px 14px", borderRadius:"20px", fontSize:"12px", fontWeight:700, fontFamily:ff, cursor:"pointer", border:`1px solid ${isActive?color+"50":"#E5E7EB"}`, background:isActive?color+"12":"#FFF", color:isActive?color:"#6B7280", transition:"all 120ms ease" }}>
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
            placeholder="Search by title, resident, unit, status…"
            style={{ flex:1, border:"none", background:"transparent", outline:"none", fontSize:"13px", color:"#111827", fontFamily:ff }} />
          <button type="button" onClick={() => setFiltersOpen((p)=>!p)}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"5px 10px", borderRadius:"6px", border:`1px solid ${activeFilterCount>0?"#2563EB40":"#E5E7EB"}`, background:activeFilterCount>0?"#EFF6FF":"#FAFAFA", color:activeFilterCount>0?"#2563EB":"#6B7280", fontSize:"11.5px", fontWeight:600, cursor:"pointer", fontFamily:ff, transition:"all 120ms" }}>
            <SlidersHorizontal style={{ width:"11px", height:"11px" }} />
            Filters
            {activeFilterCount>0 && (
              <span style={{ width:"16px", height:"16px", borderRadius:"50%", background:"#2563EB", color:"#FFF", fontSize:"9px", fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                {activeFilterCount}
              </span>
            )}
            <ChevronDown style={{ width:"10px", height:"10px", transform:filtersOpen?"rotate(180deg)":"none", transition:"transform 150ms" }} />
          </button>
        </div>

        {filtersOpen && (
          <div style={{ padding:"10px 12px", display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"flex-end", borderTop:"1px solid #F9FAFB" }}>
            {[
              { label:"Status",   el:<select value={statusFilter}   onChange={(e)=>setStatusFilter(e.target.value)}   style={{ ...selectBase, width:"148px" }}><option value="all">All statuses</option>{STATUS_FILTERS.filter(s=>s!=="all").map((s)=><option key={s} value={s}>{adminTicketStatusLabel("SERVICE",s)}</option>)}</select> },
              { label:"Unit",     el:<select value={unitFilter}     onChange={(e)=>setUnitFilter(e.target.value)}     style={{ ...selectBase, width:"148px" }}><option value="all">All units</option>{units.map((u)=><option key={u.id} value={u.id}>{u.label}</option>)}</select> },
              { label:"Resident", el:<select value={residentFilter} onChange={(e)=>setResidentFilter(e.target.value)} style={{ ...selectBase, width:"148px" }}><option value="all">All residents</option>{residents.map((u)=><option key={u.id} value={u.id}>{u.label}</option>)}</select> },
              { label:"From", el:<input type="date" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} style={{ ...inputBase, width:"136px" }} /> },
              { label:"To",   el:<input type="date" value={toDate}   onChange={(e)=>setToDate(e.target.value)}   style={{ ...inputBase, width:"136px" }} /> },
            ].map(({ label, el }) => (
              <div key={label} style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                <span style={{ fontSize:"10px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>{label}</span>
                {el}
              </div>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:"6px", paddingBottom:"1px" }}>
              <Toggle checked={urgentOnly} onChange={setUrgentOnly} />
              <span style={{ fontSize:"12px", fontWeight:600, color:urgentOnly?"#DC2626":"#6B7280", fontFamily:ff, cursor:"pointer", display:"flex", alignItems:"center", gap:"3px" }}
                onClick={() => setUrgentOnly((p)=>!p)}>
                <AlertTriangle style={{ width:"11px", height:"11px" }} /> Urgent only
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ borderRadius:"10px", border:"1px solid #EBEBEB", background:"#FFF", overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"112px 1fr 160px 80px 90px 96px 120px 38px", gap:"10px", padding:"9px 14px", background:"#FAFAFA", borderBottom:"1px solid #F3F4F6" }}>
          {["Type","Ticket","Resident","Unit","Priority","Status","Updated",""].map((h) => (
            <span key={h} style={{ fontSize:"10.5px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>{h}</span>
          ))}
        </div>

        {loading
          ? Array.from({length:8}).map((_,i)=><SkeletonRow key={i}/>)
          : filteredRows.length===0
            ? (
              <div style={{ padding:"48px", textAlign:"center" }}>
                <Filter style={{ width:"28px", height:"28px", color:"#E5E7EB", margin:"0 auto 8px" }} />
                <p style={{ fontSize:"13px", color:"#9CA3AF", fontFamily:ff }}>No tickets match the current filters</p>
              </div>
            )
            : filteredRows.map((row) => (
              <TicketRow key={row.key} row={row} onOpen={() => void loadTicketDetail(row)} />
            ))
        }
      </div>

      {/* ── Detail dialog ─────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if(!open){setDialogOpen(false);setActive(null);setReturnOpen(false);setReturnMsg("");} }}>
        <DialogContent style={{ maxWidth:"980px", padding:0, borderRadius:"12px", overflow:"hidden", border:"1px solid #EBEBEB", fontFamily:ff, maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
          <div style={{ height:"3px", flexShrink:0, background:active?.kind==="COMPLAINT"?"linear-gradient(90deg,#DC2626,#F97316)":active?.kind==="REQUEST"?"linear-gradient(90deg,#6D28D9,#2563EB)":"linear-gradient(90deg,#111827,#374151)" }} />
          <div style={{ padding:"14px 20px 12px", flexShrink:0, borderBottom:"1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize:"15px", fontWeight:800, color:"#111827", fontFamily:ff }}>Ticket Details</DialogTitle>
              <p style={{ fontSize:"12px", color:"#9CA3AF", marginTop:"2px", fontFamily:ff }}>Review, reply, and update workflow status.</p>
            </DialogHeader>
          </div>

          {!active||active.loading ? (
            <div style={{ padding:"48px", textAlign:"center", color:"#9CA3AF", fontSize:"13px", fontFamily:ff }}>
              {active?.loading?"Loading ticket…":"Select a ticket to open it here."}
            </div>
          ) : (
            <div style={{ overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:"14px" }}>

              {/* Progress bar */}
              <div style={{ borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FFF", padding:"6px 14px 10px" }}>
                <TicketProgressBar kind={active.kind} status={active.detail?.status||active.statusDraft||"NEW"} />
              </div>

              {/* Top row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 284px", gap:"12px", alignItems:"start" }}>

                {/* Info card */}
                <div style={{ borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FFF", padding:"14px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px", marginBottom:"14px" }}>
                    <div>
                      <p style={{ fontSize:"10.5px", color:"#9CA3AF", margin:"0 0 3px", textTransform:"uppercase", letterSpacing:"0.06em" }}>{humanizeEnum(active.kind)}</p>
                      <h3 style={{ fontSize:"15px", fontWeight:800, color:"#111827", margin:0 }}>
                        {active.kind==="COMPLAINT"?active.detail?.title||`${humanizeEnum(active.detail?.category||"Complaint")} Complaint`:active.detail?.service?.name||"Ticket"}
                      </h3>
                      <p style={{ fontSize:"11px", color:"#9CA3AF", margin:"3px 0 0", fontFamily:ffMono }}>
                        {active.kind==="COMPLAINT"?(active.detail?.complaintNumber||active.id):active.id}
                      </p>
                    </div>
                    <span className={getStatusColorClass(active.detail?.status)} style={{ fontSize:"11.5px", fontWeight:700, padding:"3px 9px", borderRadius:"5px", flexShrink:0 }}>
                      {adminTicketStatusLabel(active.kind, active.detail?.status)}
                    </span>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
                    {[
                      { label:"Resident", value:active.kind==="COMPLAINT"?(active.detail?.reporter?.nameEN||active.detail?.reporter?.email||"—"):(active.detail?.createdBy?.nameEN||active.detail?.createdBy?.email||"—") },
                      { label:"Unit",     value:`${active.detail?.unit?.block?`${active.detail.unit.block} · `:""}${active.detail?.unit?.unitNumber||"—"}` },
                      { label:"Priority", value:adminPriorityLabel(active.detail?.priority||"MEDIUM") },
                      { label:"Updated",  value:formatDateTime(active.detail?.updatedAt||active.detail?.requestedAt||active.detail?.createdAt) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p style={{ fontSize:"10.5px", color:"#9CA3AF", margin:"0 0 2px", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</p>
                        <p style={{ fontSize:"12.5px", color:"#374151", margin:0, fontWeight:500 }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {active.detail?.description && (
                    <div style={{ borderTop:"1px solid #F3F4F6", paddingTop:"10px" }}>
                      <p style={{ fontSize:"10.5px", color:"#9CA3AF", margin:"0 0 5px", textTransform:"uppercase", letterSpacing:"0.06em" }}>Description</p>
                      <p style={{ fontSize:"12.5px", color:"#374151", margin:0, lineHeight:1.55, whiteSpace:"pre-wrap" }}>{active.detail.description}</p>
                    </div>
                  )}

                  {active.kind!=="COMPLAINT" && Array.isArray(active.detail?.fieldValues) && active.detail.fieldValues.length>0 && (
                    <div style={{ borderTop:"1px solid #F3F4F6", paddingTop:"10px", marginTop:"10px" }}>
                      <p style={{ fontSize:"10.5px", color:"#9CA3AF", margin:"0 0 8px", textTransform:"uppercase", letterSpacing:"0.06em" }}>Submitted Details</p>
                      <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                        {active.detail.fieldValues.map((fv:any, i:number) => (
                          <div key={fv.id||i} style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:"8px", fontSize:"12px" }}>
                            <span style={{ color:"#9CA3AF" }}>{fv?.field?.label||"Field"}</span>
                            <span style={{ color:"#374151", wordBreak:"break-word" }}>{fv.valueText??(fv.valueNumber!=null?String(fv.valueNumber):null)??(fv.valueBool!=null?(fv.valueBool?"Yes":"No"):null)??(fv.valueDate?formatDateTime(fv.valueDate):null)??(fv.fileAttachmentId?"File attached":"—")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status panel */}
                <div style={{ borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FFF", padding:"14px", display:"flex", flexDirection:"column", gap:"12px" }}>
                  <SectionLabel icon={<Clock style={{ width:"11px", height:"11px" }} />} label="Update Status" />

                  <select value={active.statusDraft} onChange={(e)=>setActive((p:any)=>p?{...p,statusDraft:e.target.value}:p)} style={selectBase}>
                    {(active.kind==="COMPLAINT"?COMPLAINT_STATUSES:SERVICE_STATUSES).map((s)=>(
                      <option key={s} value={s}>{adminTicketStatusLabel(active.kind,s)}</option>
                    ))}
                  </select>

                  {active.kind==="COMPLAINT"&&(active.statusDraft==="RESOLVED"||active.statusDraft==="CLOSED")&&(
                    <div style={{ display:"flex", flexDirection:"column", gap:"4px" }}>
                      <label style={{ fontSize:"10.5px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em" }}>Resolution Notes <span style={{ color:"#DC2626" }}>*</span></label>
                      <textarea rows={3} value={active.resolutionNotesDraft||""} onChange={(e)=>setActive((p:any)=>p?{...p,resolutionNotesDraft:e.target.value}:p)} placeholder="Describe how this was resolved…" style={{ ...textareaBase, fontSize:"12px" }} />
                    </div>
                  )}

                  <button type="button" onClick={() => void applyStatus()}
                    disabled={statusSubmitting||!active.statusDraft||active.statusDraft===String(active.detail?.status||"").toUpperCase()}
                    style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", padding:"8px", borderRadius:"7px", background:"#111827", color:"#FFF", border:"none", cursor:statusSubmitting?"not-allowed":"pointer", fontSize:"12.5px", fontWeight:700, fontFamily:ff, opacity:!active.statusDraft||active.statusDraft===String(active.detail?.status||"").toUpperCase()?0.4:1 }}>
                    <Check style={{ width:"12px", height:"12px" }} />
                    {statusSubmitting?"Updating…":"Apply Status Change"}
                  </button>

                  {/* Quick actions */}
                  <div style={{ borderTop:"1px solid #F3F4F6", paddingTop:"10px" }}>
                    <p style={{ fontSize:"10.5px", fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.06em", margin:"0 0 7px", fontFamily:ff }}>Quick Actions</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px" }}>
                      {[
                        { label:"In Progress", value:"IN_PROGRESS", icon:<Clock style={{ width:"10px", height:"10px" }} /> },
                        { label:"Resolved",    value:"RESOLVED",    icon:<Check style={{ width:"10px", height:"10px" }} /> },
                        { label:"Closed",      value:"CLOSED",      icon:<X    style={{ width:"10px", height:"10px" }} /> },
                        ...(active.kind!=="COMPLAINT"?[{ label:"Cancel", value:"CANCELLED", icon:<X style={{ width:"10px", height:"10px" }} /> }]:[]),
                      ].map(({ label, value, icon }) => (
                        <button key={value} type="button"
                          onClick={() => setActive((p:any)=>p?{...p,statusDraft:value}:p)}
                          style={{ display:"flex", alignItems:"center", gap:"4px", padding:"5px 8px", borderRadius:"6px", border:`1px solid ${active.statusDraft===value?"#111827":"#E5E7EB"}`, background:active.statusDraft===value?"#F3F4F6":"#FFF", color:active.statusDraft===value?"#111827":"#6B7280", fontSize:"11.5px", fontWeight:600, cursor:"pointer", fontFamily:ff, transition:"all 120ms" }}>
                          {icon}{label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Return to resident */}
                  {active.kind==="COMPLAINT"&&String(active.detail?.status||"").toUpperCase()==="IN_PROGRESS"&&(
                    <div style={{ borderTop:"1px solid #F3F4F6", paddingTop:"10px" }}>
                      {!returnOpen ? (
                        <button type="button" onClick={() => setReturnOpen(true)}
                          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", width:"100%", padding:"7px", borderRadius:"7px", border:"1px solid #DDD6FE", background:"#F5F3FF", color:"#6D28D9", fontSize:"11.5px", fontWeight:700, cursor:"pointer", fontFamily:ff }}>
                          <ArrowLeft style={{ width:"11px", height:"11px" }} /> Return to Resident
                        </button>
                      ) : (
                        <div style={{ borderRadius:"8px", border:"1px solid #DDD6FE", background:"#F5F3FF", padding:"10px", display:"flex", flexDirection:"column", gap:"8px" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <span style={{ fontSize:"11px", fontWeight:700, color:"#6D28D9", display:"flex", alignItems:"center", gap:"5px" }}>
                              <UserX style={{ width:"11px", height:"11px" }} /> Return to Resident
                            </span>
                            <button type="button" onClick={() => { setReturnOpen(false); setReturnMsg(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", padding:0, display:"flex" }}><X style={{ width:"13px", height:"13px" }} /></button>
                          </div>
                          <textarea value={returnMsg} onChange={(e)=>setReturnMsg(e.target.value)} rows={3}
                            placeholder="E.g. We need you to confirm the issue still persists…"
                            style={{ ...textareaBase, background:"#FFF", fontSize:"12px" }} />
                          <button type="button" onClick={() => void submitReturn()} disabled={returnSubmitting||!returnMsg.trim()}
                            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"5px", padding:"7px", borderRadius:"6px", background:"#6D28D9", color:"#FFF", border:"none", cursor:returnSubmitting||!returnMsg.trim()?"not-allowed":"pointer", fontSize:"12px", fontWeight:700, fontFamily:ff, opacity:!returnMsg.trim()?0.5:1 }}>
                            <Send style={{ width:"11px", height:"11px" }} />
                            {returnSubmitting?"Sending…":"Send & Update Status"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Awaiting resident */}
                  {active.kind==="COMPLAINT"&&String(active.detail?.status||"").toUpperCase()==="PENDING_RESIDENT"&&(
                    <div style={{ borderTop:"1px solid #F3F4F6", paddingTop:"10px" }}>
                      <div style={{ borderRadius:"8px", border:"1px solid #DDD6FE", background:"#F5F3FF", padding:"10px", display:"flex", gap:"8px" }}>
                        <MessageSquare style={{ width:"14px", height:"14px", color:"#6D28D9", flexShrink:0, marginTop:"1px" }} />
                        <div>
                          <p style={{ fontSize:"11.5px", fontWeight:700, color:"#6D28D9", margin:"0 0 3px" }}>Awaiting Resident Response</p>
                          <p style={{ fontSize:"11.5px", color:"#6B7280", margin:0, lineHeight:1.4 }}>Returned to resident. Set to "In Progress" once they reply.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Conversation + Timeline */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>

                {/* Conversation */}
                <div style={{ borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FFF", padding:"14px" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                    <SectionLabel icon={<MessageSquare style={{ width:"11px", height:"11px" }} />} label="Conversation" />
                    <button type="button" onClick={() => void refreshActive()}
                      style={{ fontSize:"11.5px", color:"#6B7280", background:"none", border:"none", cursor:"pointer", fontFamily:ff, fontWeight:600, display:"flex", alignItems:"center", gap:"4px", marginBottom:"12px" }}>
                      <RefreshCw style={{ width:"10px", height:"10px" }} /> Refresh
                    </button>
                  </div>

                  <div style={{ maxHeight:"320px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"8px", marginBottom:"12px", padding:"4px 0" }}>
                    {active.comments?.length
                      ? [...active.comments]
                          .sort((a:any,b:any) => new Date(a.createdAt||0).getTime() - new Date(b.createdAt||0).getTime())
                          .map((c:any) => {
                            // Determine if the comment author is the resident who created the ticket
                            const residentId = active.kind==="COMPLAINT"
                              ? (active.detail?.reporterId || active.detail?.reporter?.id)
                              : (active.detail?.createdById || active.detail?.createdBy?.id);
                            const isFromResident = c?.createdBy?.id === residentId;
                            return <CommentBubble key={c.id} c={c} isAdmin={!isFromResident} />;
                          })
                      : <div style={{ padding:"20px", textAlign:"center", fontSize:"12.5px", color:"#9CA3AF", border:"1.5px dashed #E5E7EB", borderRadius:"8px", fontFamily:ff }}>No messages yet. Start the conversation by posting a reply below.</div>
                    }
                  </div>

                  <div style={{ borderTop:"1px solid #F3F4F6", paddingTop:"12px" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
                      <span style={{ fontSize:"11px", fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:ff }}>Reply / Note</span>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                        <span style={{ fontSize:"12px", color:replyInternal?"#B45309":"#6B7280", fontWeight:600, fontFamily:ff }}>Internal note</span>
                        <Toggle checked={replyInternal} onChange={setReplyInternal} />
                      </div>
                    </div>
                    <textarea value={replyText} onChange={(e)=>setReplyText(e.target.value)} rows={3}
                      placeholder={replyInternal?"Visible to staff only…":"Reply to resident…"}
                      style={{ ...textareaBase, marginBottom:"8px", border:replyInternal?"1px solid #FDE68A":"1px solid #E5E7EB", background:replyInternal?"#FFFBEB":"#FFF" }} />
                    <div style={{ display:"flex", justifyContent:"flex-end" }}>
                      <button type="button" onClick={() => void submitReply()} disabled={replySubmitting||!replyText.trim()}
                        style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 16px", borderRadius:"7px", background:"#111827", color:"#FFF", border:"none", cursor:replySubmitting||!replyText.trim()?"not-allowed":"pointer", fontSize:"12.5px", fontWeight:700, fontFamily:ff, opacity:!replyText.trim()?0.4:1 }}>
                        <Send style={{ width:"11px", height:"11px" }} />
                        {replySubmitting?"Sending…":"Post Reply"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div style={{ borderRadius:"9px", border:"1px solid #EBEBEB", background:"#FFF", padding:"14px" }}>
                  <SectionLabel icon={<Clock style={{ width:"11px", height:"11px" }} />} label="Activity Timeline" />
                  <div style={{ maxHeight:"440px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"5px" }}>
                    {activityRows.length
                      ? activityRows.map((item)=><TimelineItem key={item.id} item={item}/>)
                      : <div style={{ padding:"20px", textAlign:"center", fontSize:"12.5px", color:"#9CA3AF", border:"1.5px dashed #E5E7EB", borderRadius:"8px", fontFamily:ff }}>No activity yet.</div>
                    }
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }
      `}</style>
    </div>
  );
}