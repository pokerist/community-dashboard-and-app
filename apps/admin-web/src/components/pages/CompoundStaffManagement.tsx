import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import {
  COMPOUND_STAFF_PERMISSIONS,
  CompoundStaff,
  CompoundStaffPermission,
  CompoundStaffStatus,
  CreateCompoundStaffPayload,
  UpdateCompoundStaffPayload,
  default as compoundStaffService,
} from "../../lib/compound-staff-service";
import { errorMessage, formatDateTime, getStatusColorClass, humanizeEnum } from "../../lib/live-data";

type StaffFormState = {
  communityId: string;
  commercialEntityId: string;
  userId: string;
  fullName: string;
  phone: string;
  nationalId: string;
  photoFileId: string;
  profession: string;
  jobTitle: string;
  contractFrom: string;
  contractTo: string;
  workScheduleText: string;
  status: CompoundStaffStatus;
  permissions: CompoundStaffPermission[];
  gateIds: string[];
};

const INITIAL_FORM: StaffFormState = {
  communityId: "",
  commercialEntityId: "",
  userId: "",
  fullName: "",
  phone: "",
  nationalId: "",
  photoFileId: "",
  profession: "",
  jobTitle: "",
  contractFrom: "",
  contractTo: "",
  workScheduleText: "",
  status: "ACTIVE",
  permissions: [],
  gateIds: [],
};

function toDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseWorkSchedule(text: string): Record<string, unknown> | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const parsed: unknown = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Work schedule must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function CompoundStaffManagement() {
  const [rows, setRows] = useState<CompoundStaff[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CompoundStaff | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(INITIAL_FORM);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [nationalIdDocUploading, setNationalIdDocUploading] = useState(false);
  const [nationalIdDocFileId, setNationalIdDocFileId] = useState("");
  const [nationalIdDocFileName, setNationalIdDocFileName] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [professionFilter, setProfessionFilter] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [communityOptions, setCommunityOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [entityOptions, setEntityOptions] = useState<Array<{ id: string; label: string; communityId: string }>>([]);
  const [userOptions, setUserOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [gateOptions, setGateOptions] = useState<Array<{ id: string; label: string; communityId: string }>>([]);

  const filteredEntityOptions = useMemo(
    () => entityOptions.filter((it) => it.communityId === form.communityId),
    [entityOptions, form.communityId],
  );
  const filteredGateOptions = useMemo(
    () => gateOptions.filter((it) => it.communityId === form.communityId),
    [gateOptions, form.communityId],
  );

  const loadOptions = useCallback(async () => {
    const [communities, entities, users, gates] = await Promise.all([
      compoundStaffService.listCommunityOptions(),
      compoundStaffService.listCommercialEntityOptions(),
      compoundStaffService.listUserOptions(),
      compoundStaffService.listGateOptions(),
    ]);
    setCommunityOptions(communities);
    setEntityOptions(entities);
    setUserOptions(users);
    setGateOptions(gates);
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const staff = await compoundStaffService.list({
        status: statusFilter === "all" ? undefined : (statusFilter as CompoundStaffStatus),
        profession: professionFilter || undefined,
        contractExpiringSoon: expiringOnly || undefined,
      });
      setRows(staff);
      if (staff.length > 0) setSelectedId((id) => id ?? staff[0].id);
      if (staff.length === 0) {
        setSelectedId(null);
        setSelected(null);
      }
    } catch (error) {
      toast.error("Failed to load staff", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [expiringOnly, professionFilter, statusFilter]);

  useEffect(() => {
    void Promise.all([loadOptions(), loadRows()]);
  }, [loadOptions, loadRows]);

  useEffect(() => {
    if (!selectedId) return;
    void compoundStaffService
      .getById(selectedId)
      .then(setSelected)
      .catch((error) => toast.error("Failed to load detail", { description: errorMessage(error) }));
  }, [selectedId]);

  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setNationalIdDocFileId("");
    setNationalIdDocFileName("");
    setDialogOpen(true);
  };

  const openEdit = (row: CompoundStaff) => {
    setEditingId(row.id);
    setForm({
      communityId: row.communityId ?? "",
      commercialEntityId: row.commercialEntityId ?? "",
      userId: row.userId ?? "",
      fullName: row.fullName,
      phone: row.phone,
      nationalId: row.nationalId,
      photoFileId: row.photoFileId ?? "",
      profession: row.profession,
      jobTitle: row.jobTitle ?? "",
      contractFrom: toDateInput(row.contractFrom),
      contractTo: toDateInput(row.contractTo),
      workScheduleText: row.workSchedule ? JSON.stringify(row.workSchedule, null, 2) : "",
      status: row.status,
      permissions: row.accesses.map((a) => a.permission),
      gateIds: row.gateAccesses.map((g) => g.gateId),
    });
    setNationalIdDocFileId("");
    setNationalIdDocFileName("");
    setDialogOpen(true);
  };

  const togglePermission = (permission: CompoundStaffPermission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handlePhotoUpload = async (file: File | null) => {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const uploaded = await compoundStaffService.uploadProfilePhoto(file);
      setForm((prev) => ({ ...prev, photoFileId: uploaded.id }));
      toast.success("Profile photo uploaded");
    } catch (error) {
      toast.error("Failed to upload profile photo", { description: errorMessage(error) });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleNationalIdDocumentUpload = async (file: File | null) => {
    if (!file) return;
    setNationalIdDocUploading(true);
    try {
      const uploaded = await compoundStaffService.uploadNationalId(file);
      setNationalIdDocFileId(uploaded.id);
      setNationalIdDocFileName(uploaded.name);
      toast.success("National ID document uploaded");
    } catch (error) {
      toast.error("Failed to upload national ID document", { description: errorMessage(error) });
    } finally {
      setNationalIdDocUploading(false);
    }
  };

  const save = async () => {
    if (!form.communityId || !form.fullName.trim() || !form.phone.trim() || !form.nationalId.trim() || !form.profession.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    let workSchedule: Record<string, unknown> | null | undefined;
    try {
      workSchedule = parseWorkSchedule(form.workScheduleText);
    } catch (error) {
      toast.error("Invalid work schedule", { description: error instanceof Error ? error.message : "Invalid schedule" });
      return;
    }

    setSaving(true);
    try {
      const gateAccesses = form.gateIds.map((gateId) => ({ gateId, directions: ["ENTRY", "EXIT"] as Array<"ENTRY" | "EXIT"> }));
      if (editingId) {
        const payload: UpdateCompoundStaffPayload = {
          communityId: form.communityId,
          commercialEntityId: form.commercialEntityId || null,
          userId: form.userId || null,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          nationalId: form.nationalId.trim(),
          photoFileId: form.photoFileId || null,
          profession: form.profession.trim(),
          jobTitle: form.jobTitle || null,
          workSchedule: workSchedule === undefined ? null : workSchedule,
          contractFrom: form.contractFrom ? `${form.contractFrom}T00:00:00.000Z` : null,
          contractTo: form.contractTo ? `${form.contractTo}T00:00:00.000Z` : null,
          status: form.status,
          gateAccesses: form.status === "ACTIVE" ? gateAccesses : [],
        };
        await compoundStaffService.update(editingId, payload);
        await compoundStaffService.setAccess(editingId, {
          permissions: form.status === "ACTIVE" ? form.permissions : [],
        });
      } else {
        const payload: CreateCompoundStaffPayload = {
          communityId: form.communityId,
          commercialEntityId: form.commercialEntityId || undefined,
          userId: form.userId || undefined,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          nationalId: form.nationalId.trim(),
          photoFileId: form.photoFileId || undefined,
          profession: form.profession.trim(),
          jobTitle: form.jobTitle || undefined,
          workSchedule: workSchedule === undefined ? undefined : workSchedule,
          contractFrom: form.contractFrom ? `${form.contractFrom}T00:00:00.000Z` : undefined,
          contractTo: form.contractTo ? `${form.contractTo}T00:00:00.000Z` : undefined,
          status: form.status,
          permissions: form.status === "ACTIVE" ? form.permissions : [],
          gateAccesses: form.status === "ACTIVE" ? gateAccesses : [],
        };
        await compoundStaffService.create(payload);
      }
      setDialogOpen(false);
      await loadRows();
      toast.success("Staff saved");
    } catch (error) {
      toast.error("Failed to save staff", { description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[#1E293B]">Compound Staff Module</h1>
        <Button onClick={openCreate}>Add Staff</Button>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{(["ACTIVE","INACTIVE","SUSPENDED"] as CompoundStaffStatus[]).map((s)=><SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>)}</SelectContent></Select>
          <Input value={professionFilter} onChange={(e)=>setProfessionFilter(e.target.value)} placeholder="Profession" />
          <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={expiringOnly} onChange={(e)=>setExpiringOnly(e.target.checked)} />Expiring soon</label>
          <Button variant="outline" onClick={()=>void loadRows()}>Refresh</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 space-y-3">
          {loading ? <p className="text-sm text-[#64748B]">Loading...</p> : rows.map((row)=>(
            <button key={row.id} type="button" className={`w-full text-left border rounded p-3 ${selectedId===row.id ? "border-[#0B5FFF]" : "border-[#E2E8F0]"}`} onClick={()=>setSelectedId(row.id)}>
              <div className="flex justify-between"><p className="text-sm">{row.fullName}</p><Badge className={getStatusColorClass(row.status)}>{humanizeEnum(row.status)}</Badge></div>
              <p className="text-xs text-[#64748B]">{row.profession}{row.jobTitle ? ` • ${row.jobTitle}` : ""}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={()=>openEdit(row)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={()=>compoundStaffService.remove(row.id).then(()=>loadRows()).catch((error)=>toast.error("Failed to archive", { description: errorMessage(error) }))}>Archive</Button>
              </div>
            </button>
          ))}
        </Card>

        <Card className="p-4 space-y-3">
          {!selected ? <p className="text-sm text-[#64748B]">Select a staff member.</p> : <>
            <p className="text-sm">{selected.fullName}</p>
            <p className="text-xs text-[#64748B]">{selected.phone} • {selected.nationalId}</p>
            <p className="text-xs text-[#64748B]">Updated {formatDateTime(selected.updatedAt)}</p>
            <div><p className="text-sm">Assigned Gates</p>{selected.gateAccesses.length ? selected.gateAccesses.map((g)=><p className="text-xs text-[#64748B]" key={g.id}>{g.gateName}</p>) : <p className="text-xs text-[#94A3B8]">No gates assigned</p>}</div>
            <div><p className="text-sm">Activity Log</p>{selected.activityLogs.length ? selected.activityLogs.map((a)=><p className="text-xs text-[#64748B]" key={a.id}>{humanizeEnum(a.action)} • {formatDateTime(a.createdAt)}</p>) : <p className="text-xs text-[#94A3B8]">No activity</p>}</div>
          </>}
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Staff" : "Create Staff"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Community *</Label><Select value={form.communityId || "none"} onValueChange={(value)=>setForm((prev)=>({...prev, communityId: value==="none" ? "" : value, commercialEntityId: "", gateIds: []}))}><SelectTrigger><SelectValue placeholder="Community" /></SelectTrigger><SelectContent><SelectItem value="none">Select</SelectItem>{communityOptions.map((c)=><SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Entity</Label><Select value={form.commercialEntityId || "none"} onValueChange={(value)=>setForm((prev)=>({...prev, commercialEntityId: value==="none" ? "" : value}))}><SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{filteredEntityOptions.map((e)=><SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Linked User</Label><Select value={form.userId || "none"} onValueChange={(value)=>setForm((prev)=>({...prev, userId: value==="none" ? "" : value}))}><SelectTrigger><SelectValue placeholder="User" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{userOptions.map((u)=><SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={form.status} onValueChange={(value)=>setForm((prev)=>({...prev, status: value as CompoundStaffStatus}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["ACTIVE","INACTIVE","SUSPENDED"] as CompoundStaffStatus[]).map((s)=><SelectItem key={s} value={s}>{humanizeEnum(s)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Full Name *</Label><Input value={form.fullName} onChange={(e)=>setForm((prev)=>({...prev, fullName: e.target.value}))} /></div>
            <div><Label>Phone *</Label><Input value={form.phone} onChange={(e)=>setForm((prev)=>({...prev, phone: e.target.value}))} /></div>
            <div><Label>National ID *</Label><Input value={form.nationalId} onChange={(e)=>setForm((prev)=>({...prev, nationalId: e.target.value}))} /></div>
            <div className="space-y-1">
              <Label>National ID Document Upload</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={(event)=>void handleNationalIdDocumentUpload(event.target.files?.[0] ?? null)}
                disabled={nationalIdDocUploading}
              />
              <p className="text-xs text-[#64748B]">
                {nationalIdDocUploading
                  ? "Uploading national ID document..."
                  : nationalIdDocFileId
                    ? `Uploaded: ${nationalIdDocFileName || "document"} (file ID: ${nationalIdDocFileId})`
                    : "Optional verification upload for this session."}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Profile Photo Upload</Label>
              <Input
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={(event)=>void handlePhotoUpload(event.target.files?.[0] ?? null)}
                disabled={photoUploading}
              />
              <p className="text-xs text-[#64748B]">
                {photoUploading
                  ? "Uploading profile photo..."
                  : form.photoFileId
                    ? `Photo file ID: ${form.photoFileId}`
                    : "Upload a photo or paste an existing photo file ID below."}
              </p>
            </div>
            <div><Label>Photo File ID (manual override)</Label><Input value={form.photoFileId} onChange={(e)=>setForm((prev)=>({...prev, photoFileId: e.target.value}))} placeholder="Optional existing file ID" /></div>
            <div><Label>Profession *</Label><Input value={form.profession} onChange={(e)=>setForm((prev)=>({...prev, profession: e.target.value}))} /></div>
            <div><Label>Job Role</Label><Input value={form.jobTitle} onChange={(e)=>setForm((prev)=>({...prev, jobTitle: e.target.value}))} /></div>
            <div><Label>Contract Start</Label><Input type="date" value={form.contractFrom} onChange={(e)=>setForm((prev)=>({...prev, contractFrom: e.target.value}))} /></div>
            <div><Label>Contract End</Label><Input type="date" value={form.contractTo} onChange={(e)=>setForm((prev)=>({...prev, contractTo: e.target.value}))} /></div>
          </div>
          <div className="space-y-2"><Label>Work Schedule JSON</Label><Textarea value={form.workScheduleText} onChange={(e)=>setForm((prev)=>({...prev, workScheduleText: e.target.value}))} className="min-h-[90px] font-mono text-xs" /></div>
          <div className="space-y-2"><Label>Permissions</Label><div className="grid grid-cols-2 gap-2">{COMPOUND_STAFF_PERMISSIONS.map((permission)=><label key={permission} className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.permissions.includes(permission)} onChange={()=>togglePermission(permission)} disabled={form.status!=="ACTIVE"} />{humanizeEnum(permission)}</label>)}</div></div>
          <div className="space-y-2"><Label>Gate Access</Label><div className="grid grid-cols-2 gap-2">{filteredGateOptions.map((gate)=><label key={gate.id} className="text-sm flex items-center gap-2"><input type="checkbox" checked={form.gateIds.includes(gate.id)} onChange={()=>setForm((prev)=>({...prev, gateIds: prev.gateIds.includes(gate.id) ? prev.gateIds.filter((id)=>id!==gate.id) : [...prev.gateIds, gate.id]}))} disabled={form.status!=="ACTIVE"} />{gate.label}</label>)}</div></div>
          <DialogFooter><Button variant="outline" onClick={()=>setDialogOpen(false)} disabled={saving}>Cancel</Button><Button onClick={()=>void save()} disabled={saving}>{saving ? "Saving..." : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
