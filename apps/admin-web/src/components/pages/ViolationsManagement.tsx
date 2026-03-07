import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { ViolationActionStatus, ViolationActionType, ViolationStatus } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { DataTable, type DataTableColumn } from "../DataTable";
import { useEffect, useMemo, useState } from "react";
import { Eye, Edit2, Plus, Search } from "lucide-react";
import { SkeletonTable } from "../SkeletonTable";
import { StatusBadge } from "../StatusBadge";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";
import { StatCard } from "../StatCard";
import { toast } from "sonner";
import { cn } from "../ui/utils";
import violationsService, {
  type ViolationActionRequestItem,
  type ViolationAppealQueueItem,
  type ViolationCategoryItem,
  type ViolationDetail,
  type ViolationInvoice,
  type ViolationListItem,
  type ViolationStats,
} from "../../lib/violationsService";

const colors = ["bg-blue-400", "bg-emerald-400", "bg-amber-400", "bg-red-400"];
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : "—");
const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");
const money = (v: number) => `EGP ${v.toLocaleString()}`;

export function ViolationsManagement() {
  const [tab, setTab] = useState<"violations" | "appeals" | "settings">("violations");
  const [stats, setStats] = useState<ViolationStats | null>(null);
  const [categories, setCategories] = useState<ViolationCategoryItem[]>([]);
  const [rows, setRows] = useState<ViolationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [hasAppeal, setHasAppeal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [appealRows, setAppealRows] = useState<ViolationAppealQueueItem[]>([]);
  const [appealsLoading, setAppealsLoading] = useState(true);
  const [appealSearch, setAppealSearch] = useState("");
  const [appealStatus, setAppealStatus] = useState("ALL");
  const [appealDateFrom, setAppealDateFrom] = useState("");
  const [appealDateTo, setAppealDateTo] = useState("");
  const [appealPage, setAppealPage] = useState(1);
  const [appealTotalPages, setAppealTotalPages] = useState(1);
  const [appealTotal, setAppealTotal] = useState(0);
  const [detail, setDetail] = useState<ViolationDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"details" | "evidence" | "appeals" | "invoices">("details");
  const [cancelInput, setCancelInput] = useState("");
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [rejectByAction, setRejectByAction] = useState<Record<string, string>>({});
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ViolationCategoryItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", defaultFineAmount: "500", description: "" });

  const loadViolations = async () => {
    setLoading(true);
    try {
      const [st, cats, list] = await Promise.all([
        violationsService.getViolationStats(),
        violationsService.listCategories(true),
        violationsService.listViolations({
          page,
          limit: 25,
          search: search || undefined,
          status: status === "ALL" ? undefined : (status as ViolationStatus),
          categoryId: categoryId === "ALL" ? undefined : categoryId,
          hasAppeal: hasAppeal || undefined,
          dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
          dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
        }),
      ]);
      setStats(st);
      setCategories(cats);
      setRows(list.data);
      setTotal(list.total);
      setTotalPages(list.totalPages);
    } catch {
      toast.error("Failed to load violations");
    } finally {
      setLoading(false);
    }
  };

  const loadAppeals = async () => {
    setAppealsLoading(true);
    try {
      const res = await violationsService.listAppealRequests({
        page: appealPage,
        limit: 25,
        search: appealSearch || undefined,
        status: appealStatus === "ALL" ? undefined : (appealStatus as ViolationActionStatus),
        dateFrom: appealDateFrom ? new Date(appealDateFrom).toISOString() : undefined,
        dateTo: appealDateTo ? new Date(`${appealDateTo}T23:59:59`).toISOString() : undefined,
      });
      setAppealRows(res.data);
      setAppealTotal(res.total);
      setAppealTotalPages(res.totalPages);
    } catch {
      toast.error("Failed to load appeals");
    } finally {
      setAppealsLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "violations" || tab === "settings") void loadViolations();
  }, [tab, page, search, status, categoryId, dateFrom, dateTo, hasAppeal]);

  useEffect(() => {
    if (tab === "appeals") void loadAppeals();
  }, [tab, appealPage, appealSearch, appealStatus, appealDateFrom, appealDateTo]);

  const openDetail = async (id: string, active: "details" | "evidence" | "appeals" | "invoices" = "details") => {
    try {
      const d = await violationsService.getViolationDetail(id);
      setDetail(d);
      setDetailTab(active);
      setDetailOpen(true);
      setShowCancelInput(false);
      setCancelInput("");
    } catch {
      toast.error("Failed to load detail");
    }
  };

  const violationCols = useMemo<DataTableColumn<ViolationListItem>[]>(() => [
    { key: "n", header: "#", className: "w-[130px]", render: (r) => <span className="font-['DM_Mono']">{r.violationNumber}</span> },
    { key: "c", header: "Category", className: "w-[160px]", render: (r) => <span>{r.categoryName ?? "—"}</span> },
    { key: "u", header: "Unit", className: "w-[100px]", render: (r) => <span>{r.unitNumber}</span> },
    { key: "r", header: "Resident", className: "w-[150px]", render: (r) => <span>{r.residentName ?? "—"}</span> },
    { key: "i", header: "Issuer", className: "w-[150px]", render: (r) => <span>{r.issuerName ?? "—"}</span> },
    { key: "f", header: "Fine Amount", className: "w-[150px] text-right", render: (r) => <span className="block text-right font-['DM_Mono'] text-[#1E293B]">{money(r.fineAmount)}</span> },
    { key: "s", header: "Status", className: "w-[120px]", render: (r) => <StatusBadge value={r.status} /> },
    { key: "a", header: "Appeal", className: "w-[120px]", render: (r) => r.hasAppeal ? <span className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">Appealed</span> : <span className="text-[#475569]">—</span> },
    { key: "x", header: "Actions", className: "w-[80px] text-right", render: (r) => <button type="button" onClick={() => void openDetail(r.id)} className="inline-flex p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Eye className="w-4 h-4" /></button> },
  ], []);

  const appealCols = useMemo<DataTableColumn<ViolationAppealQueueItem>[]>(() => [
    { key: "n", header: "Violation #", className: "w-[130px]", render: (r) => <span className="font-['DM_Mono']">{r.violationNumber}</span> },
    { key: "c", header: "Category", className: "w-[150px]", render: (r) => <span>{r.categoryName ?? "—"}</span> },
    { key: "u", header: "Unit", className: "w-[100px]", render: (r) => <span>{r.unitNumber}</span> },
    { key: "r", header: "Resident", className: "w-[150px]", render: (r) => <span>{r.residentName ?? "—"}</span> },
    { key: "f", header: "Fine", className: "w-[120px] text-right", render: (r) => <span className="block text-right font-['DM_Mono']">{money(r.fineAmount)}</span> },
    { key: "note", header: "Appeal Note", render: (r) => <span>{(r.appealNote ?? "—").slice(0, 70)}{(r.appealNote ?? "").length > 70 ? "..." : ""}</span> },
    { key: "d", header: "Submitted", className: "w-[150px]", render: (r) => <span>{fmtDateTime(r.submittedAt)}</span> },
    { key: "s", header: "Status", className: "w-[120px]", render: (r) => <StatusBadge value={r.status} /> },
    { key: "x", header: "Actions", className: "w-[80px] text-right", render: (r) => <button type="button" onClick={() => void openDetail(r.violationId, "appeals")} className="inline-flex p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Eye className="w-4 h-4" /></button> },
  ], []);

  const invoiceCols = useMemo<DataTableColumn<ViolationInvoice>[]>(() => [
    { key: "n", header: "Invoice #", render: (r) => <span className="font-['DM_Mono']">{r.invoiceNumber}</span> },
    { key: "a", header: "Amount", render: (r) => <span className="font-['DM_Mono']">{money(r.amount)}</span> },
    { key: "t", header: "Type", render: (r) => <span>{r.type}</span> },
    { key: "s", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "d", header: "Due Date", render: (r) => <span>{fmtDate(r.dueDate)}</span> },
  ], []);

  const detailAppeals = detail?.actionRequests.filter((a) => a.type === ViolationActionType.APPEAL) ?? [];
  const detailFixes = detail?.actionRequests.filter((a) => a.type === ViolationActionType.FIX_SUBMISSION) ?? [];

  const reviewAction = async (row: ViolationActionRequestItem, approved: boolean) => {
    if (!detail) return;
    const reason = rejectByAction[row.id]?.trim();
    if (!approved && !reason) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      if (row.type === ViolationActionType.APPEAL) {
        await violationsService.reviewAppeal(row.id, approved, reason || undefined);
      } else {
        await violationsService.reviewFixSubmission(row.id, approved, reason || undefined);
      }
      const refreshed = await violationsService.getViolationDetail(detail.id);
      setDetail(refreshed);
      await Promise.all([loadViolations(), loadAppeals()]);
      toast.success("Review saved");
    } catch {
      toast.error("Failed to save review");
    }
  };

  const saveCategory = async () => {
    const name = categoryForm.name.trim();
    const defaultFineAmount = Number(categoryForm.defaultFineAmount);
    if (!name || !Number.isFinite(defaultFineAmount) || defaultFineAmount <= 0) {
      toast.error("Provide valid category name and default fine");
      return;
    }
    try {
      if (editingCategory) {
        await violationsService.updateCategory(editingCategory.id, {
          name,
          defaultFineAmount,
          description: categoryForm.description.trim() || undefined,
        });
      } else {
        await violationsService.createCategory({
          name,
          defaultFineAmount,
          description: categoryForm.description.trim() || undefined,
        });
      }
      setCategoryOpen(false);
      await loadViolations();
      toast.success("Category saved");
    } catch {
      toast.error("Failed to save category");
    }
  };

  const saveCancel = async () => {
    if (!detail) return;
    if (!cancelInput.trim()) {
      toast.error("Cancellation reason is required");
      return;
    }
    try {
      const d = await violationsService.cancelViolation(detail.id);
      setDetail(d);
      setShowCancelInput(false);
      setCancelInput("");
      await loadViolations();
      toast.success("Violation cancelled");
    } catch {
      toast.error("Failed to cancel violation");
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] bg-[#F8FAFC] rounded-2xl p-8 space-y-6">
      <PageHeader variant="light" title="Violations" description="Manage violations, appeals queue, and categories." />
      <Tabs value={tab} onValueChange={(v: string) => setTab(v as "violations" | "appeals" | "settings")} className="space-y-6">
        <TabsList className="bg-white border border-[#E2E8F0] p-1 rounded-lg">
          <TabsTrigger value="violations" className="text-[#334155]">Violations</TabsTrigger>
          <TabsTrigger value="appeals" className="text-[#334155]">Appeals</TabsTrigger>
          <TabsTrigger value="settings" className="text-[#334155]">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="violations" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard variant="light" title="Total Violations" value={String(stats?.total ?? 0)} subtitle="All records" icon="complaints-total" />
            <StatCard variant="light" title="Pending Payment" value={String(stats?.pending ?? 0)} subtitle="Awaiting payment" icon="complaints-open" />
            <StatCard variant="light" title="Fines Collected" value={money(stats?.totalFinesCollected ?? 0)} subtitle="Status = PAID" icon="revenue" />
            <StatCard variant="light" title="Pending Appeals" value={String(stats?.pendingAppeals ?? 0)} subtitle="Appeal queue" icon="tickets" />
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0]">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1E293B] placeholder:text-[#475569] focus:outline-none focus:border-blue-500/50" placeholder="Search..." />
              </div>
              <select value={status} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setStatus(e.target.value); setPage(1); }} className="w-40 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none"><option value="ALL">All Statuses</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="APPEALED">Appealed</option><option value="CANCELLED">Cancelled</option></select>
              <select value={categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setCategoryId(e.target.value); setPage(1); }} className="w-44 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none"><option value="ALL">All Categories</option>{categories.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateFrom(e.target.value); setPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50" />
              <input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDateTo(e.target.value); setPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50" />
              <button type="button" onClick={() => { setHasAppeal((p: boolean) => !p); setPage(1); }} className={cn("text-xs px-3 py-1.5 rounded-full border", hasAppeal ? "bg-violet-500/10 text-violet-400 border-violet-500/20" : "bg-[#F8FAFC] text-slate-400 border-transparent")}>Has Appeal</button>
            </div>
            <div className="p-6">{loading ? <SkeletonTable columns={9} variant="light" /> : <DataTable variant="light" columns={violationCols} rows={rows} rowKey={(r) => r.id} rowClassName={(r) => r.status === ViolationStatus.APPEALED ? "border-l-2 border-violet-500/30" : ""} emptyTitle="No violations found" emptyDescription="Try adjusting filters." />}</div>
            <div className="px-6 pb-6 flex items-center justify-between"><p className="text-xs text-slate-500">Page {page} of {totalPages} ({total} records)</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((p: number) => Math.max(1, p - 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Next</button></div></div>
          </div>
        </TabsContent>
        <TabsContent value="appeals" className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E2E8F0]">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input value={appealSearch} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAppealSearch(e.target.value); setAppealPage(1); }} className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1E293B] placeholder:text-[#475569] focus:outline-none focus:border-blue-500/50" placeholder="Search..." /></div>
              <select value={appealStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setAppealStatus(e.target.value); setAppealPage(1); }} className="w-40 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50 appearance-none"><option value="ALL">All Statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="CLOSED">Closed</option></select>
              <input type="date" value={appealDateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAppealDateFrom(e.target.value); setAppealPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50" />
              <input type="date" value={appealDateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setAppealDateTo(e.target.value); setAppealPage(1); }} className="w-36 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#334155] focus:outline-none focus:border-blue-500/50" />
            </div>
            <div className="p-6">{appealsLoading ? <SkeletonTable columns={9} variant="light" /> : <DataTable variant="light" columns={appealCols} rows={appealRows} rowKey={(r) => r.actionRequestId} emptyTitle="No appeals submitted" emptyDescription="Appeal queue is empty." />}</div>
            <div className="px-6 pb-6 flex items-center justify-between"><p className="text-xs text-slate-500">Page {appealPage} of {appealTotalPages} ({appealTotal} records)</p><div className="flex items-center gap-2"><button type="button" disabled={appealPage <= 1} onClick={() => setAppealPage((p: number) => Math.max(1, p - 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Previous</button><button type="button" disabled={appealPage >= appealTotalPages} onClick={() => setAppealPage((p: number) => Math.min(appealTotalPages, p + 1))} className="bg-[#F8FAFC] hover:bg-[#E2E8F0] border border-[#CBD5E1] text-[#334155] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Next</button></div></div>
          </div>
        </TabsContent>
        <TabsContent value="settings">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
            <PageHeader variant="light" title="Violation Categories" description="Define category names and default fine amounts" actions={<button type="button" onClick={() => { setEditingCategory(null); setCategoryForm({ name: "", defaultFineAmount: "500", description: "" }); setCategoryOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><Plus className="w-4 h-4" />Add Category</button>} />
            <div className="mt-6">{categories.length === 0 ? <EmptyState variant="light" title="No violation categories" description="Create categories and default fines." /> : categories.map((c) => <div key={c.id} className="p-4 rounded-lg bg-[#F8FAFC] mb-2 flex items-center justify-between"><div className="flex items-center gap-3"><span className={cn("w-2.5 h-2.5 rounded-full", colors[Math.abs(c.displayOrder) % colors.length])} /><div className="space-y-1"><p className="text-sm font-medium text-[#1E293B]">{c.name}</p><span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-['DM_Mono']">{money(c.defaultFineAmount)}</span></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => void violationsService.toggleCategory(c.id).then(() => loadViolations())} className={cn("relative w-11 h-6 rounded-full border", c.isActive ? "bg-emerald-500/20 border-emerald-500/30" : "bg-[#F8FAFC] border-[#CBD5E1]")}><span className={cn("absolute top-0.5 w-5 h-5 rounded-full", c.isActive ? "left-5 bg-emerald-400" : "left-0.5 bg-slate-500")} /></button><button type="button" onClick={() => { setEditingCategory(c); setCategoryForm({ name: c.name, defaultFineAmount: String(c.defaultFineAmount), description: c.description ?? "" }); setCategoryOpen(true); }} className="p-2 rounded-lg hover:bg-[#F8FAFC] text-slate-400 hover:text-[#1E293B]"><Edit2 className="w-4 h-4" /></button></div></div>)}</div>
          </div>
        </TabsContent>
      </Tabs>
            <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="w-full max-w-[480px] bg-white border border-slate-200 p-0 overflow-hidden">
          <DialogHeader className="px-6 py-5 border-b border-slate-200">
            <DialogTitle className="text-base font-semibold text-slate-900">{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-6 space-y-4">
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Name</label>
              <input value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Default Fine Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">EGP</span>
                <input type="number" min={0} value={categoryForm.defaultFineAmount} onChange={(e) => setCategoryForm((p) => ({ ...p, defaultFineAmount: e.target.value }))} className="w-full bg-white border border-slate-300 rounded-lg pl-12 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-[#475569] mb-1.5">Description</label>
              <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} className="w-full min-h-[90px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button type="button" onClick={() => setCategoryOpen(false)} className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 rounded-lg">Cancel</button>
            <button type="button" onClick={() => void saveCategory()} className="bg-black hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog><DrawerForm open={detailOpen} onOpenChange={setDetailOpen} title="Violation Detail" description="Review violation details, appeals and actions" widthClassName="w-full sm:max-w-[560px]" variant="light">
        {!detail ? <EmptyState variant="light" compact title="No violation selected" description="Select a violation from the list." /> : (
          <div className="space-y-4">
            <div><p className="font-['DM_Mono'] text-2xl text-[#0F172A]">{detail.violationNumber}</p><div className="mt-3 flex items-center gap-2 flex-wrap"><StatusBadge value={detail.status} />{detail.categoryName ? <span className="text-xs px-2 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-400">{detail.categoryName}</span> : null}</div></div>
            <Tabs value={detailTab} onValueChange={(v: string) => setDetailTab(v as "details" | "evidence" | "appeals" | "invoices")} className="space-y-4">
              <TabsList className="bg-[#F8FAFC] border border-[#E2E8F0] p-1 rounded-lg"><TabsTrigger value="details" className="text-[#334155]">Details</TabsTrigger><TabsTrigger value="evidence" className="text-[#334155]">Evidence</TabsTrigger><TabsTrigger value="appeals" className="text-[#334155]">Appeals</TabsTrigger><TabsTrigger value="invoices" className="text-[#334155]">Invoices</TabsTrigger></TabsList>
              <TabsContent value="details" className="space-y-4">
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Unit & Resident</p><p className="text-sm text-[#334155]">Unit: <span className="text-[#0F172A]">{detail.unitNumber}</span></p><p className="text-sm text-[#334155]">Resident: <span className="text-[#0F172A]">{detail.residentName ?? "—"}</span></p><p className="text-sm text-[#334155]">Issuer: <span className="text-[#0F172A]">{detail.issuerName ?? "—"}</span></p><p className="text-xs text-slate-500">Appeal deadline: {fmtDate(detail.appealDeadline)}</p></div>
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Category & Fine</p><p className="text-sm text-[#334155]">{detail.description}</p><p className="text-2xl font-semibold text-[#0F172A] font-['DM_Mono']">{money(detail.fineAmount)}</p></div>
                {detail.status === ViolationStatus.PENDING ? <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Actions</p><div className="flex items-center gap-2"><button type="button" onClick={() => { if (!window.confirm("Mark as paid?")) return; void violationsService.markAsPaid(detail.id).then(async (d) => { setDetail(d); await loadViolations(); toast.success("Marked as paid"); }).catch(() => toast.error("Failed to update")); }} className="bg-black hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Mark as Paid</button><button type="button" onClick={() => setShowCancelInput((p) => !p)} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2 rounded-lg">Cancel Violation</button></div>{showCancelInput ? <div className="space-y-2"><textarea value={cancelInput} onChange={(e) => setCancelInput(e.target.value)} className="w-full min-h-[80px] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-red-500/50" placeholder="Cancellation reason" /><button type="button" onClick={() => void saveCancel()} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Confirm Cancel</button></div> : null}</div> : null}
              </TabsContent>
              <TabsContent value="evidence">{detail.photoEvidence.length === 0 ? <EmptyState variant="light" compact title="No photo evidence attached" description="Evidence files will appear here." /> : <div className="grid grid-cols-2 gap-4">{detail.photoEvidence.map((f) => <a key={f.id} href={f.url ?? "#"} target="_blank" rel="noreferrer" className="rounded-lg overflow-hidden border border-[#CBD5E1] bg-[#F8FAFC] hover:border-white/20 transition-colors"><img src={f.url ?? ""} alt={f.fileName ?? "Evidence"} className="w-full h-32 object-cover" /><div className="p-3"><p className="text-xs text-[#334155] truncate">{f.fileName ?? f.id}</p></div></a>)}</div>}</TabsContent>
              <TabsContent value="appeals" className="space-y-4">
                {detailAppeals.length === 0 && detailFixes.length === 0 ? <EmptyState variant="light" compact title="No appeals submitted" description="Appeals and fix submissions will appear here." /> : <>
                  {detailAppeals.map((a) => <div key={a.id} className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[#1E293B]">Appeal</p><StatusBadge value={a.status} /></div><p className="text-xs text-slate-500">Submitted by {a.requestedByName} on {fmtDateTime(a.createdAt)}</p><div className="bg-[#F8FAFC] rounded-lg p-4"><p className="text-sm text-[#334155] whitespace-pre-wrap">{a.note ?? "No note provided"}</p></div>{a.status === ViolationActionStatus.PENDING ? <div className="space-y-2"><p className="text-xs text-violet-400">Violation will be cancelled and fine waived.</p><div className="flex items-center gap-2"><button type="button" onClick={() => void reviewAction(a, true)} className="bg-black hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Approve Appeal</button><button type="button" onClick={() => setRejectByAction((p) => ({ ...p, [a.id]: p[a.id] ?? "" }))} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2 rounded-lg">Reject Appeal</button></div>{rejectByAction[a.id] !== undefined ? <div className="space-y-2"><textarea value={rejectByAction[a.id]} onChange={(e) => setRejectByAction((p) => ({ ...p, [a.id]: e.target.value }))} className="w-full min-h-[80px] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-sm text-[#1E293B] focus:outline-none focus:border-red-500/50" placeholder="Rejection reason" /><button type="button" onClick={() => void reviewAction(a, false)} className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg">Confirm Reject</button></div> : null}</div> : null}</div>)}
                  {detailFixes.map((a) => <div key={a.id} className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-3"><div className="flex items-center justify-between"><p className="text-sm font-medium text-[#1E293B]">Fix Submission</p><StatusBadge value={a.status} /></div><div className="bg-[#F8FAFC] rounded-lg p-4"><p className="text-sm text-[#334155] whitespace-pre-wrap">{a.note ?? "No note provided"}</p></div>{a.status === ViolationActionStatus.PENDING ? <div className="flex items-center gap-2"><button type="button" onClick={() => void reviewAction(a, true)} className="bg-black hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Approve Fix</button><button type="button" onClick={() => void reviewAction(a, false)} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2 rounded-lg">Reject Fix</button></div> : null}</div>)}
                </>}
              </TabsContent>
              <TabsContent value="invoices"><div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4"><div className="flex items-center justify-end"><button type="button" onClick={() => toast.info("Create invoice from Billing until inline invoice form is enabled.")} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"><Plus className="w-4 h-4" />Create Invoice</button></div><DataTable variant="light" columns={invoiceCols} rows={detail.invoices} rowKey={(r) => r.id} emptyTitle="No linked invoices" emptyDescription="No invoice records linked to this violation." /></div></TabsContent>
            </Tabs>
          </div>
        )}
      </DrawerForm>
    </div>
  );
}








