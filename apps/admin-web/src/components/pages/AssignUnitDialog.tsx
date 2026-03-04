import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";

type UnitOption = { id: string; label: string };

type AssignUnitDialogProps = {
  residentUserId: string;
  unitOptions: UnitOption[];
  onAssigned: () => Promise<void> | void;
};

export function AssignUnitDialog({ residentUserId, unitOptions, onAssigned }: AssignUnitDialogProps) {
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [role, setRole] = useState<"OWNER" | "TENANT" | "FAMILY">("FAMILY");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!unitId) {
      toast.error("Unit is required");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/users/residents/${residentUserId}/units/assign`, {
        unitId,
        role,
      });
      toast.success("Unit assigned");
      setOpen(false);
      setUnitId("");
      setRole("FAMILY");
      await onAssigned();
    } catch (error) {
      toast.error("Failed to assign unit", { description: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Assign Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Unit</DialogTitle>
          <DialogDescription>Link a unit to this resident and set access role.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "OWNER" | "TENANT" | "FAMILY")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">Owner</SelectItem>
                <SelectItem value="TENANT">Tenant</SelectItem>
                <SelectItem value="FAMILY">Family</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

