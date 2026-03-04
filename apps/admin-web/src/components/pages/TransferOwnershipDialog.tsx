import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";

type ResidentUserOption = {
  id: string;
  label: string;
};

type TransferOwnershipDialogProps = {
  unitId: string;
  fromUserId: string;
  residentOptions: ResidentUserOption[];
  onTransferred: () => Promise<void> | void;
};

export function TransferOwnershipDialog({
  unitId,
  fromUserId,
  residentOptions,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [mode, setMode] = useState<"MOVE_EXISTING_PLAN" | "CREATE_NEW_PLAN">("MOVE_EXISTING_PLAN");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "INSTALLMENT">("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableTargets = useMemo(
    () => residentOptions.filter((row) => row.id !== fromUserId),
    [fromUserId, residentOptions],
  );

  const submit = async () => {
    if (!toUserId) {
      toast.error("Target resident is required");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/users/residents/units/${unitId}/transfer-ownership`, {
        fromUserId,
        toUserId,
        mode,
        notes: notes.trim() || undefined,
        ...(mode === "CREATE_NEW_PLAN"
          ? {
              newPlan: {
                paymentMode,
                notes: notes.trim() || undefined,
              },
            }
          : {}),
      });
      toast.success("Ownership transferred");
      setOpen(false);
      setToUserId("");
      setMode("MOVE_EXISTING_PLAN");
      setPaymentMode("CASH");
      setNotes("");
      await onTransferred();
    } catch (error) {
      toast.error("Failed to transfer ownership", { description: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Transfer Ownership
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Transfer Unit Ownership</DialogTitle>
          <DialogDescription>
            Move existing owner plan or create a new plan for the target owner.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Target Resident</Label>
            <Select value={toUserId} onValueChange={setToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select resident" />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Transfer Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "MOVE_EXISTING_PLAN" | "CREATE_NEW_PLAN")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MOVE_EXISTING_PLAN">Move Existing Plan</SelectItem>
                <SelectItem value="CREATE_NEW_PLAN">Create New Plan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "CREATE_NEW_PLAN" ? (
            <div className="space-y-2">
              <Label>New Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as "CASH" | "INSTALLMENT")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="INSTALLMENT">Installment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Transfer reason / audit note..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

