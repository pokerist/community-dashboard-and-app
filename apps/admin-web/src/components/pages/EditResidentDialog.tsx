import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";

type EditResidentDialogProps = {
  overview: ResidentOverview;
  onUpdated: () => Promise<void> | void;
};

export function EditResidentDialog({ overview, onUpdated }: EditResidentDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nameEN: "",
    nameAR: "",
    email: "",
    phone: "",
    nationalId: "",
    dateOfBirth: "",
    userStatus: "ACTIVE",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nameEN: overview.resident.user.nameEN || "",
      nameAR: overview.resident.user.nameAR || "",
      email: overview.resident.user.email || "",
      phone: overview.resident.user.phone || "",
      nationalId: overview.resident.nationalId || "",
      dateOfBirth: overview.resident.dateOfBirth ? String(overview.resident.dateOfBirth).slice(0, 10) : "",
      userStatus: overview.resident.user.userStatus || "ACTIVE",
    });
  }, [open, overview]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiClient.patch(`/admin/users/residents/${overview.resident.user.id}/profile`, {
        nameEN: form.nameEN.trim() || undefined,
        nameAR: form.nameAR.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        userStatus: form.userStatus,
      });
      toast.success("Resident profile updated");
      setOpen(false);
      await onUpdated();
    } catch (error) {
      toast.error("Failed to update resident profile", { description: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Edit Resident</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Resident Profile</DialogTitle>
          <DialogDescription>Update account and resident details.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Name (EN)</Label>
            <Input value={form.nameEN} onChange={(e) => setForm((p) => ({ ...p, nameEN: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Name (AR)</Label>
            <Input value={form.nameAR} onChange={(e) => setForm((p) => ({ ...p, nameAR: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>National ID</Label>
            <Input value={form.nationalId} onChange={(e) => setForm((p) => ({ ...p, nationalId: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Status</Label>
            <Select value={form.userStatus} onValueChange={(v) => setForm((p) => ({ ...p, userStatus: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="DISABLED">Disabled</SelectItem>
                <SelectItem value="INVITED">Invited</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

