import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Plus, RefreshCw, Search, Pencil, Trash2, Upload } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage, extractMeta, extractRows, formatDateTime, getPriorityColorClass, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

type Audience = "ALL" | "SPECIFIC_RESIDENCES" | "SPECIFIC_BLOCKS" | "SPECIFIC_UNITS";
type BannerStatus = "ACTIVE" | "INACTIVE" | "EXPIRED";
type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Banner = {
  id: string;
  titleEn: string;
  titleAr?: string | null;
  imageFileId?: string | null;
  description?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  targetAudience: Audience;
  audienceMeta?: Record<string, unknown> | null;
  startDate: string;
  endDate: string;
  status: BannerStatus;
  displayPriority: Priority;
  views: number;
  clicks: number;
  ctr?: number;
  createdAt?: string;
};

type FormState = {
  titleEn: string;
  titleAr: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  targetAudience: Audience;
  audienceValues: string;
  startDate: string;
  endDate: string;
  status: BannerStatus;
  displayPriority: Priority;
  imageFileId: string;
  views: string;
  clicks: string;
  imageFile: File | null;
};

const STATUS_OPTIONS: BannerStatus[] = ["ACTIVE", "INACTIVE", "EXPIRED"];
const PRIORITY_OPTIONS: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const AUDIENCE_OPTIONS: Audience[] = ["ALL", "SPECIFIC_RESIDENCES", "SPECIFIC_BLOCKS", "SPECIFIC_UNITS"];

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function csvArray(value: string) {
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function buildAudienceMeta(targetAudience: Audience, valuesCsv: string): Record<string, unknown> | undefined {
  if (targetAudience === "ALL") return {};
  const values = csvArray(valuesCsv);
  if (values.length === 0) return undefined;
  if (targetAudience === "SPECIFIC_RESIDENCES") return { userIds: values };
  if (targetAudience === "SPECIFIC_UNITS") return { unitIds: values };
  return { blocks: values };
}

function readAudienceValues(targetAudience: Audience, audienceMeta: unknown): string {
  if (!audienceMeta || typeof audienceMeta !== "object") return "";
  const data = audienceMeta as Record<string, unknown>;
  const arr = (k: string) => Array.isArray(data[k]) ? (data[k] as unknown[]).map(String).join(", ") : "";
  if (targetAudience === "SPECIFIC_RESIDENCES") return arr("userIds");
  if (targetAudience === "SPECIFIC_UNITS") return arr("unitIds");
  if (targetAudience === "SPECIFIC_BLOCKS") return arr("blocks");
  return "";
}

function emptyForm(): FormState {
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    titleEn: "",
    titleAr: "",
    description: "",
    ctaText: "",
    ctaUrl: "",
    targetAudience: "ALL",
    audienceValues: "",
    startDate: toLocalDateTime(now.toISOString()),
    endDate: toLocalDateTime(end.toISOString()),
    status: "ACTIVE",
    displayPriority: "MEDIUM",
    imageFileId: "",
    views: "0",
    clicks: "0",
    imageFile: null,
  };
}

export function BannerManagement() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [metaTotal, setMetaTotal] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | BannerStatus>("ALL");
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const res = await apiClient.get("/banners", { params: { page: 1, limit: 200, q: search.trim() || undefined, status: statusFilter === "ALL" ? undefined : statusFilter } });
      setRows(extractRows<Banner>(res.data));
      setMetaTotal(extractMeta(res.data).total);
    } catch (e) {
      const msg = errorMessage(e);
      setLoadErr(msg);
      toast.error("Failed to load banners", { description: msg });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setEditingId(null); setForm(emptyForm()); };
  const closeDialog = (open: boolean) => { setDialogOpen(open); if (!open) resetForm(); };
  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (b: Banner) => {
    setEditingId(b.id);
    setForm({
      titleEn: b.titleEn ?? "",
      titleAr: b.titleAr ?? "",
      description: b.description ?? "",
      ctaText: b.ctaText ?? "",
      ctaUrl: b.ctaUrl ?? "",
      targetAudience: b.targetAudience,
      audienceValues: readAudienceValues(b.targetAudience, b.audienceMeta),
      startDate: toLocalDateTime(b.startDate),
      endDate: toLocalDateTime(b.endDate),
      status: b.status,
      displayPriority: b.displayPriority,
      imageFileId: b.imageFileId ?? "",
      views: String(Number(b.views ?? 0)),
      clicks: String(Number(b.clicks ?? 0)),
      imageFile: null,
    });
    setDialogOpen(true);
  };

  const uploadImageIfNeeded = async (): Promise<string | undefined> => {
    if (!form.imageFile) return form.imageFileId.trim() || undefined;
    const fd = new FormData();
    fd.append("file", form.imageFile);
    const res = await apiClient.post("/files/upload/service-attachment", fd, { headers: { "Content-Type": "multipart/form-data" } });
    if (!res.data?.id) throw new Error("Image uploaded but no file ID returned");
    return String(res.data.id);
  };

  const saveBanner = async () => {
    if (!form.titleEn.trim()) return toast.error("Title is required");
    if (!form.startDate || !form.endDate) return toast.error("Start and end dates are required");
    const views = Number(form.views || 0);
    const clicks = Number(form.clicks || 0);
    if ([views, clicks].some((n) => Number.isNaN(n) || n < 0)) return toast.error("Views/clicks must be non-negative numbers");
    const audienceMeta = buildAudienceMeta(form.targetAudience, form.audienceValues);
    if (form.targetAudience !== "ALL" && !audienceMeta) return toast.error("Audience values are required for selected audience");

    setSaving(true);
    try {
      const imageFileId = await uploadImageIfNeeded();
      const payload = {
        titleEn: form.titleEn.trim(),
        titleAr: form.titleAr.trim() || undefined,
        description: form.description.trim() || undefined,
        ctaText: form.ctaText.trim() || undefined,
        ctaUrl: form.ctaUrl.trim() || undefined,
        targetAudience: form.targetAudience,
        audienceMeta,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: form.status,
        displayPriority: form.displayPriority,
        imageFileId,
        views,
        clicks,
      };
      if (editingId) {
        await apiClient.patch(`/banners/${editingId}`, payload);
        toast.success("Banner updated");
      } else {
        await apiClient.post("/banners", payload);
        toast.success("Banner created");
      }
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (e) {
      toast.error("Failed to save banner", { description: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async (b: Banner) => {
    if (!window.confirm(`Delete banner \"${b.titleEn}\"?`)) return;
    try {
      await apiClient.delete(`/banners/${b.id}`);
      toast.success("Banner deleted");
      await load();
    } catch (e) {
      toast.error("Failed to delete banner", { description: errorMessage(e) });
    }
  };

  const updateStatus = async (b: Banner, status: BannerStatus) => {
    try {
      await apiClient.patch(`/banners/${b.id}/status`, { status });
      toast.success(`Banner ${status.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error("Failed to update status", { description: errorMessage(e) });
    }
  };

  const stats = useMemo(() => {
    const total = Number(metaTotal ?? rows.length);
    const active = rows.filter((r) => r.status === "ACTIVE").length;
    const liveNow = rows.filter((r) => {
      if (r.status !== "ACTIVE") return false;
      const now = Date.now();
      return new Date(r.startDate).getTime() <= now && now <= new Date(r.endDate).getTime();
    }).length;
    const views = rows.reduce((s, r) => s + Number(r.views ?? 0), 0);
    const clicks = rows.reduce((s, r) => s + Number(r.clicks ?? 0), 0);
    return { total, active, liveNow, views, clicks };
  }, [rows, metaTotal]);

  const audienceHint = form.targetAudience === "ALL" ? "No audience values required" : (form.targetAudience === "SPECIFIC_BLOCKS" ? "Comma-separated blocks" : form.targetAudience === "SPECIFIC_UNITS" ? "Comma-separated unit IDs" : "Comma-separated user IDs");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Banner Management</h1>
          <p className="mt-1 text-[#64748B]">Live banner CRUD with targeting, scheduling, image upload, and status controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> {loading ? "Refreshing..." : "Refresh"}</Button>
          <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={openCreate}><Plus className="w-4 h-4" />Create Banner</Button>
        </div>
      </div>

      {loadErr ? <Card className="p-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]">{loadErr}</Card> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl"><p className="text-xs text-[#64748B]">Total</p><h3 className="text-[#1E293B]">{stats.total}</h3></Card>
        <Card className="p-4 rounded-xl"><p className="text-xs text-[#64748B]">Active</p><h3 className="text-[#1E293B]">{stats.active}</h3></Card>
        <Card className="p-4 rounded-xl"><p className="text-xs text-[#64748B]">Live Now</p><h3 className="text-[#1E293B]">{stats.liveNow}</h3></Card>
        <Card className="p-4 rounded-xl"><p className="text-xs text-[#64748B]">Views / Clicks</p><h3 className="text-[#1E293B]">{stats.views} / {stats.clicks}</h3></Card>
      </div>

      <Card className="p-4 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void load(); } }} className="pl-9" placeholder="Search banners" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "ALL" | BannerStatus)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>Apply</Button>
        </div>
      </Card>

      <Card className="rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB]"><h3 className="text-[#1E293B]">Banners</h3></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              <TableHead>Banner</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Metrics</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => {
              const audienceValues = readAudienceValues(b.targetAudience, b.audienceMeta);
              const ctr = Number(b.ctr ?? (b.views ? (Number(b.clicks || 0) / Number(b.views || 1)) * 100 : 0));
              return (
                <TableRow key={b.id} className="hover:bg-[#F9FAFB]">
                  <TableCell className="align-top">
                    <div className="space-y-1 max-w-sm">
                      <div className="font-medium text-[#1E293B]">{b.titleEn}</div>
                      {b.titleAr ? <div className="text-xs text-[#64748B]">{b.titleAr}</div> : null}
                      {b.description ? <div className="text-xs text-[#64748B] truncate">{b.description}</div> : null}
                      <div className="flex flex-wrap gap-1">
                        {b.ctaText ? <Badge variant="secondary" className="bg-[#EEF2FF] text-[#4338CA]">CTA: {b.ctaText}</Badge> : null}
                        {b.imageFileId ? <Badge variant="secondary" className="bg-[#F3F4F6] text-[#334155]">Image</Badge> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="secondary" className="bg-[#F3F4F6] text-[#334155]">{humanizeEnum(b.targetAudience)}</Badge>
                    <div className="text-xs text-[#64748B] mt-1">{audienceValues || (b.targetAudience === "ALL" ? "All" : "No values")}</div>
                  </TableCell>
                  <TableCell className="align-top text-xs text-[#334155]">
                    <div>{formatDateTime(b.startDate)}</div>
                    <div>{formatDateTime(b.endDate)}</div>
                    <div className="text-[#64748B]">Created: {formatDateTime(b.createdAt)}</div>
                  </TableCell>
                  <TableCell className="align-top"><Badge className={getPriorityColorClass(b.displayPriority)}>{humanizeEnum(b.displayPriority)}</Badge></TableCell>
                  <TableCell className="align-top"><Badge className={getStatusColorClass(b.status)}>{humanizeEnum(b.status)}</Badge></TableCell>
                  <TableCell className="align-top text-xs text-[#334155]">
                    <div>Views: {Number(b.views || 0)}</div>
                    <div>Clicks: {Number(b.clicks || 0)}</div>
                    <div>CTR: {Number.isFinite(ctr) ? ctr.toFixed(2) : "0.00"}%</div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" />Edit</Button>
                      {b.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" onClick={() => void updateStatus(b, "INACTIVE")}>Deactivate</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void updateStatus(b, "ACTIVE")}>Activate</Button>
                      )}
                      {b.status !== "EXPIRED" ? <Button size="sm" variant="outline" onClick={() => void updateStatus(b, "EXPIRED")}>Expire</Button> : null}
                      <Button size="sm" variant="destructive" onClick={() => void removeBanner(b)}><Trash2 className="w-4 h-4" />Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-[#64748B]">No banners found.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Banner" : "Create Banner"}</DialogTitle>
            <DialogDescription>Connected to backend `/banners` endpoints with optional image upload via `/files/upload/service-attachment`.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Title (EN)</Label><Input value={form.titleEn} onChange={(e) => setForm((p) => ({ ...p, titleEn: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Title (AR)</Label><Input value={form.titleAr} onChange={(e) => setForm((p) => ({ ...p, titleAr: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>CTA Text</Label><Input value={form.ctaText} onChange={(e) => setForm((p) => ({ ...p, ctaText: e.target.value }))} /></div>
              <div className="space-y-2"><Label>CTA URL</Label><Input value={form.ctaUrl} onChange={(e) => setForm((p) => ({ ...p, ctaUrl: e.target.value }))} placeholder="https://..." /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Audience</Label>
                <Select value={form.targetAudience} onValueChange={(v) => setForm((p) => ({ ...p, targetAudience: v as Audience, audienceValues: "" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AUDIENCE_OPTIONS.map((a) => <SelectItem key={a} value={a}>{humanizeEnum(a)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as BannerStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.displayPriority} onValueChange={(v) => setForm((p) => ({ ...p, displayPriority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Audience Values</Label>
              <Input value={form.audienceValues} disabled={form.targetAudience === "ALL"} onChange={(e) => setForm((p) => ({ ...p, audienceValues: e.target.value }))} placeholder={form.targetAudience === "ALL" ? "Not required" : "comma-separated values"} />
              <p className="text-xs text-[#64748B]">{audienceHint}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start</Label><Input type="datetime-local" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
              <div className="space-y-2"><Label>End</Label><Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Views</Label><Input type="number" min={0} value={form.views} onChange={(e) => setForm((p) => ({ ...p, views: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Clicks</Label><Input type="number" min={0} value={form.clicks} onChange={(e) => setForm((p) => ({ ...p, clicks: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-2"><Label>Existing Image File ID</Label><Input value={form.imageFileId} onChange={(e) => setForm((p) => ({ ...p, imageFileId: e.target.value }))} placeholder="Optional file UUID" /></div>
              <div className="space-y-2">
                <Label>Upload Image</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" accept="image/*" className="max-w-[260px]" onChange={(e) => setForm((p) => ({ ...p, imageFile: e.target.files?.[0] ?? null }))} />
                  <Upload className="w-4 h-4 text-[#64748B]" />
                </div>
                <p className="text-xs text-[#64748B]">{form.imageFile ? form.imageFile.name : "Optional"}</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void saveBanner()} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Create Banner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
