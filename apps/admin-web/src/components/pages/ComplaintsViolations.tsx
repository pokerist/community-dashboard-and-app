import { useEffect, useMemo, useState } from "react";
import { ComplaintStatus, Priority } from "@prisma/client";
import { Edit2, Eye, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "../DataTable";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";
import { SkeletonTable } from "../SkeletonTable";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { cn } from "../ui/utils";
import complaintsService, { type ComplaintCategoryItem, type ComplaintDetail, type ComplaintInvoice, type ComplaintListItem, type ComplaintStats } from "../../lib/complaintsService";

const PRIORITY_DOT: Record<Priority, string> = { CRITICAL: "bg-red-500", HIGH: "bg-orange-500", MEDIUM: "bg-amber-500", LOW: "bg-slate-500" };
const dot = ["bg-blue-400","bg-emerald-400","bg-amber-400","bg-red-400","bg-violet-400","bg-orange-400","bg-teal-400","bg-rose-400"];
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");

export function ComplaintsViolations() {
  const [tab, setTab] = useState<"complaints" | "settings">("complaints");
  const [stats, setStats] = useState<ComplaintStats | null>(null);
  const [resolvedMonth, setResolvedMonth] = useState(0);
  const [categories, setCategories] = useState<ComplaintCategoryItem[]>([]);
  const [rows, setRows] = useState<ComplaintListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [slaOnly, setSlaOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);
  const [detailTab, setDetailTab] = useState<"details" | "comments" | "invoices">("details");
  const [commentBody, setCommentBody] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ComplaintCategoryItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", slaHours: "24", description: "" });

  const load = async () => {
    setLoading(true);
    try {
      const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [st, cats, list, resolved] = await Promise.all([
        complaintsService.getComplaintStats(),
        complaintsService.listCategories(true),
        complaintsService.listComplaints({ page, limit: 25, search: search || undefined, status: status === "ALL" ? undefined : (status as ComplaintStatus), categoryId: categoryId === "ALL" ? undefined : categoryId, priority: priority === "ALL" ? undefined : (priority as Priority), slaBreached: slaOnly || undefined }),
        complaintsService.listComplaints({ page: 1, limit: 1, status: ComplaintStatus.RESOLVED, dateFrom: month }),
      ]);
      setStats(st); setCategories(cats); setRows(list.data); setTotal(list.total); setTotalPages(list.totalPages); setResolvedMonth(resolved.total);
    } catch { toast.error("Failed to load complaints"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [page, search, status, categoryId, priority, slaOnly]);

  const cols = useMemo<DataTableColumn<ComplaintListItem>[]>(() => [
    { key: "n", header: "#", className: "w-[130px]", render: (r) => <span className="font-['DM_Mono']">{r.complaintNumber}</span> },
    { key: "t", header: "Title", render: (r) => <span>{r.title ?? "Untitled complaint"}</span> },
    { key: "c", header: "Category", className: "w-[150px]", render: (r) => <span>{r.categoryName ?? "—"}</span> },
    { key: "u", header: "Unit", className: "w-[110px]", render: (r) => <span>{r.unitNumber ?? "—"}</span> },
    { key: "r", header: "Reporter", className: "w-[160px]", render: (r) => <span>{r.reporterName}</span> },
    { key: "a", header: "Assignee", className: "w-[160px]", render: (r) => <span>{r.assigneeName ?? "Unassigned"}</span> },
    { key: "p", header: "Priority", className: "w-[120px]", render: (r) => <span className="inline-flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", PRIORITY_DOT[r.priority])} />{r.priority}</span> },
    { key: "sla", header: "SLA", className: "w-[120px]", render: (r) => r.slaStatus === "ON_TRACK" ? <span className="text-emerald-400">{Math.max(r.hoursRemaining ?? 0, 0)}h left</span> : r.slaStatus === "BREACHED" ? <span className="text-red-400">{Math.abs(r.hoursRemaining ?? 0)}h overdue</span> : <span className="text-[#475569]">—</span> },
    { key: "s", header: "Status", className: "w-[120px]", render: (r) => <StatusBadge value={r.status} /> },
    { key: "x", header: "Actions", className: "w-[80px] text-right", render: (r) => <button type="button" onClick={() => void complaintsService.getComplaintDetail(r.id).then((d) => { setDetail(d); setDetailOpen(true); setDetailTab("details"); }).catch(() => toast.error("Failed to load detail"))} className="inline-flex p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Eye className="w-4 h-4" /></button> },
  ], []);

  const invoiceCols = useMemo<DataTableColumn<ComplaintInvoice>[]>(() => [
    { key: "n", header: "Invoice #", render: (r) => <span className="font-['DM_Mono']">{r.invoiceNumber}</span> },
    { key: "a", header: "Amount", render: (r) => <span className="font-['DM_Mono']">EGP {r.amount.toLocaleString()}</span> },
    { key: "t", header: "Type", render: (r) => <span>{r.type}</span> },
    { key: "s", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "d", header: "Due Date", render: (r) => <span>{fmt(r.dueDate)}</span> },
  ], []);

  return <div className="min-h-[calc(100vh-140px)] bg-[#F8FAFC] rounded-2xl p-8 space-y-6">
    <PageHeader variant="light" title="Complaints" description="Complaint operations and category SLA settings." />
    <Tabs value={tab} onValueChange={(v) => setTab(v as "complaints" | "settings")} className="space-y-6">
      <TabsList className="bg-white border border-[#E2E8F0] p-1 rounded-lg"><TabsTrigger value="complaints" className="text-[#334155]">Complaints</TabsTrigger><TabsTrigger value="settings" className="text-[#334155]">Settings</TabsTrigger></TabsList>
      <TabsContent value="complaints" className="space-y-6">
        <div className="grid grid-cols-4 gap-4"><StatCard variant="light" title="Open Complaints" value={String(stats?.open ?? 0)} subtitle="NEW + IN_PROGRESS" icon="complaints-open" /><StatCard variant="light" title="SLA Breached" value={String(stats?.slaBreached ?? 0)} subtitle="Open complaints only" icon="complaints-total" /><StatCard variant="light" title="Resolved This Month" value={String(resolvedMonth)} subtitle="Current month" icon="complaints-closed" /><StatCard variant="light" title="Avg Resolution Time" value={`${stats?.avgResolutionHours ?? 0}h`} subtitle="Resolved + closed" icon="revenue" /></div>
        <div className="bg-white rounded-xl border border-[#E2E8F0]">
          <div className="p-4 border-b border-[#E2E8F0] flex flex-row items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1E293B] placeholder:text-[#475569] focus:outline-none focus:border-blue-500/50" placeholder="Search..." /></div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none"><option value="ALL">All Statuses</option><option value="NEW">New</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select>
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="w-44 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none"><option value="ALL">All Categories</option>{categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none"><option value="ALL">Priority</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
            <button type="button" onClick={() => { setSlaOnly((p) => !p); setPage(1); }} className={cn("text-xs px-3 py-1.5 rounded-full border", slaOnly ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-[#F8FAFC] text-slate-400 border-transparent")}>SLA Breached</button>
            <div className="ml-auto flex items-center gap-2"><button type="button" onClick={() => void complaintsService.checkSlaBreaches().then(() => load()).then(() => toast.success("SLA checked")).catch(() => toast.error("SLA check failed"))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg">Check SLA</button></div>
          </div>
          <div className="p-6">{loading ? <SkeletonTable columns={10} variant="light" /> : <DataTable variant="light" columns={cols} rows={rows} rowKey={(r) => r.id} rowClassName={(r) => r.slaStatus === "BREACHED" ? "border-l-2 border-red-500/30" : ""} emptyTitle="No complaints found" emptyDescription="Try adjusting filters." />}</div>
          <div className="px-6 pb-6 flex items-center justify-between"><p className="text-xs text-slate-500">Page {page} of {totalPages} ({total} records)</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Next</button></div></div>
        </div>
      </TabsContent>
      <TabsContent value="settings"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6"><PageHeader variant="light" title="Complaint Categories" description="Define categories and SLA targets for complaints" actions={<button type="button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", slaHours: "24", description: "" }); setCategoryOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"><Plus className="w-4 h-4" />Add Category</button>} /><div className="mt-6">{categories.length === 0 ? <EmptyState variant="light" title="No complaint categories" description="Create categories and SLA targets." /> : categories.map((c) => <div key={c.id} className="p-4 rounded-lg bg-[#F8FAFC] mb-2 flex items-center justify-between"><div className="flex items-center gap-3"><span className={cn("w-2.5 h-2.5 rounded-full", dot[Math.abs(c.displayOrder) % dot.length])} /><div className="space-y-1"><p className="text-sm font-medium text-[#1E293B]">{c.name}</p><span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">{c.slaHours}h SLA</span></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => void complaintsService.toggleCategory(c.id).then(() => load())} className={cn("relative w-11 h-6 rounded-full border", c.isActive ? "bg-emerald-500/20 border-emerald-500/30" : "bg-[#F8FAFC] border-[#CBD5E1]")}><span className={cn("absolute top-0.5 w-5 h-5 rounded-full", c.isActive ? "left-5 bg-emerald-400" : "left-0.5 bg-slate-500")} /></button><button type="button" onClick={() => { setEditingCategory(c); setCategoryForm({ name: c.name, slaHours: String(c.slaHours), description: c.description ?? "" }); setCategoryOpen(true); }} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Edit2 className="w-4 h-4" /></button></div></div>)}</div></div></TabsContent>
    </Tabs>

        <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
      <DialogContent className="w-full max-w-[480px] bg-white border border-slate-200 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-slate-200">
          <DialogTitle className="text-base font-semibold text-slate-900">{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-xs text-[#475569] mb-1.5">Category name</label>
            <input value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-[#475569] mb-1.5">SLA hours</label>
            <div className="relative">
              <input type="number" min={1} max={720} value={categoryForm.slaHours} onChange={(e) => setCategoryForm((p) => ({ ...p, slaHours: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 pr-16 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">hours</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#475569] mb-1.5">Description</label>
            <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} className="w-full min-h-[90px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button type="button" onClick={() => setCategoryOpen(false)} className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg">Cancel</button>
          <button type="button" onClick={() => void (async () => { const name = categoryForm.name.trim(); const hrs = Number(categoryForm.slaHours); if (!name || !Number.isInteger(hrs) || hrs < 1 || hrs > 720) { toast.error("Provide valid category and SLA hours"); return; } try { if (editingCategory) await complaintsService.updateCategory(editingCategory.id, { name, slaHours: hrs, description: categoryForm.description.trim() || undefined }); else await complaintsService.createCategory({ name, slaHours: hrs, description: categoryForm.description.trim() || undefined }); setCategoryOpen(false); await load(); toast.success("Category saved"); } catch { toast.error("Failed to save category"); } })()} className="bg-black hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog><DrawerForm open={detailOpen} onOpenChange={setDetailOpen} title="Complaint Detail" description="View status, comments, invoices and updates" widthClassName="w-full sm:max-w-[560px]" variant="light">
      {!detail ? <EmptyState variant="light" compact title="No complaint selected" description="Select a complaint from the list." /> : <div className="space-y-4"><div><p className="font-['DM_Mono'] text-2xl text-[#0F172A]">{detail.complaintNumber}</p><div className="mt-3 flex items-center gap-2 flex-wrap"><StatusBadge value={detail.status} /><span className="text-xs px-2 py-1 rounded-full border border-[#CBD5E1] text-[#334155]">{detail.priority}</span>{detail.categoryName ? <span className="text-xs px-2 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">{detail.categoryName}</span> : null}</div></div><Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "details" | "comments" | "invoices")} className="space-y-4"><TabsList className="bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg"><TabsTrigger value="details" className="text-[#334155]">Details</TabsTrigger><TabsTrigger value="comments" className="text-[#334155]">Comments</TabsTrigger><TabsTrigger value="invoices" className="text-[#334155]">Invoices</TabsTrigger></TabsList><TabsContent value="details" className="space-y-4"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Unit & Reporter</p><p className="text-sm text-[#334155]">Unit: <span className="text-[#0F172A]">{detail.unitNumber ?? "—"}</span></p><p className="text-sm text-[#334155]">Reporter: <span className="text-[#0F172A]">{detail.reporterName}</span></p><p className="text-sm text-[#334155]">Submitted: <span className="text-[#0F172A]">{fmt(detail.createdAt)}</span></p></div><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</p><StatusBadge value={detail.status} />{detail.status === ComplaintStatus.NEW ? <button type="button" disabled={!detail.assigneeId} onClick={() => void complaintsService.updateComplaintStatus(detail.id, ComplaintStatus.IN_PROGRESS).then((d) => { setDetail(d); load(); }).catch(() => toast.error("Failed status update"))} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Mark In Progress</button> : null}{detail.status === ComplaintStatus.RESOLVED ? <button type="button" onClick={() => void complaintsService.updateComplaintStatus(detail.id, ComplaintStatus.CLOSED).then((d) => { setDetail(d); load(); }).catch(() => toast.error("Failed status update"))} className="bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Close Complaint</button> : null}</div></TabsContent><TabsContent value="comments" className="space-y-4"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4">{detail.comments.length === 0 ? <EmptyState variant="light" compact title="No comments yet" description="Post the first comment or note." /> : detail.comments.map((c) => <div key={c.id} className={cn("pl-3 py-2", c.isInternal ? "border-l-2 border-amber-500/40" : "border-l-2 border-transparent")}><div className="flex items-start gap-3"><div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-[#1E293B]">{initials(c.authorName)}</div><div className="space-y-1"><div className="flex items-center gap-2"><p className="text-sm text-[#1E293B]">{c.authorName}</p>{c.isInternal ? <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">Internal</span> : null}</div><p className="text-sm text-[#334155] whitespace-pre-wrap">{c.body}</p></div></div></div>)}<div className="pt-4 border-t border-[#E2E8F0] space-y-3"><textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} className="w-full min-h-[80px] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-blue-500/50" /><div className="flex items-center gap-2"><button type="button" disabled={!commentBody.trim()} onClick={() => void complaintsService.addComment(detail.id, { body: commentBody.trim() }).then(() => complaintsService.getComplaintDetail(detail.id)).then((d) => { setDetail(d); setCommentBody(""); }).catch(() => toast.error("Failed to post"))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Post Comment</button><button type="button" disabled={!commentBody.trim()} onClick={() => void complaintsService.addComment(detail.id, { body: commentBody.trim(), isInternal: true }).then(() => complaintsService.getComplaintDetail(detail.id)).then((d) => { setDetail(d); setCommentBody(""); }).catch(() => toast.error("Failed to post"))} className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Internal Note</button></div></div></div></TabsContent><TabsContent value="invoices"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><div className="flex items-center justify-end"><button type="button" onClick={() => toast.info("Use Billing for invoice creation until complaint-source invoice posting is enabled.")} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"><Plus className="w-4 h-4" />Create Invoice</button></div><DataTable variant="light" columns={invoiceCols} rows={detail.invoices} rowKey={(r) => r.id} emptyTitle="No linked invoices" emptyDescription="No invoice records linked to this complaint." /></div></TabsContent></Tabs></div>}
    </DrawerForm>
  </div>;
}








