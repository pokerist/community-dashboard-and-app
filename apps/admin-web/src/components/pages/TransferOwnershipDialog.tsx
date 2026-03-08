import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";
import { ArrowLeftRight, X } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type ResidentUserOption = { id: string; label: string };

type TransferOwnershipDialogProps = {
  unitId: string;
  fromUserId: string;
  residentOptions: ResidentUserOption[];
  onTransferred: () => Promise<void> | void;
};

// ─── Style tokens ─────────────────────────────────────────────

const ff = "'Work Sans', sans-serif";
const ffMono = "'DM Mono', monospace";

const inputBase: React.CSSProperties = {
  height: "36px", borderRadius: "7px", border: "1px solid #E5E7EB",
  background: "#FFF", fontFamily: ff, fontSize: "12.5px", color: "#111827",
  outline: "none", padding: "0 10px", boxSizing: "border-box", width: "100%",
};
const selectStyle: React.CSSProperties = { ...inputBase, cursor: "pointer" };
const textareaStyle: React.CSSProperties = { ...inputBase, height: "auto", resize: "vertical", padding: "8px 10px" };

const TRANSFER_MODES = [
  {
    value: "MOVE_EXISTING_PLAN",
    label: "Move Existing Plan",
    desc: "Transfer the current payment plan to the new owner",
    icon: "→",
    color: "#1D4ED8",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    value: "CREATE_NEW_PLAN",
    label: "Create New Plan",
    desc: "Start a fresh payment plan for the new owner",
    icon: "+",
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
  },
];

// ─── Component ────────────────────────────────────────────────

export function TransferOwnershipDialog({ unitId, fromUserId, residentOptions, onTransferred }: TransferOwnershipDialogProps) {
  const [open, setOpen]         = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [mode, setMode]         = useState<"MOVE_EXISTING_PLAN" | "CREATE_NEW_PLAN">("MOVE_EXISTING_PLAN");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "INSTALLMENT">("CASH");
  const [notes, setNotes]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  const availableTargets = useMemo(
    () => residentOptions.filter((row) => row.id !== fromUserId),
    [fromUserId, residentOptions],
  );

  const submit = async () => {
    if (!toUserId) { toast.error("Target resident is required"); return; }
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/users/residents/units/${unitId}/transfer-ownership`, {
        fromUserId, toUserId, mode,
        notes: notes.trim() || undefined,
        ...(mode === "CREATE_NEW_PLAN" ? { newPlan: { paymentMode, notes: notes.trim() || undefined } } : {}),
      });
      toast.success("Ownership transferred");
      setOpen(false);
      setToUserId(""); setMode("MOVE_EXISTING_PLAN"); setPaymentMode("CASH"); setNotes("");
      await onTransferred();
    } catch (error) {
      toast.error("Failed to transfer ownership", { description: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTarget = availableTargets.find((r) => r.id === toUserId);
  const selectedMode   = TRANSFER_MODES.find((m) => m.value === mode)!;

  return (
    <>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", fontSize: "12.5px", fontWeight: 600, fontFamily: ff, cursor: "pointer", transition: "all 120ms" }}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: "#111827", color: "#FFF", borderColor: "#111827" })}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "#FFF", color: "#374151", borderColor: "#E5E7EB" })}>
        <ArrowLeftRight style={{ width: "12px", height: "12px" }} />
        Transfer Ownership
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ maxWidth: "480px", padding: 0, borderRadius: "12px", border: "1px solid #EBEBEB", overflow: "hidden", fontFamily: ff }}>
          {/* Accent bar */}
          <div style={{ height: "3px", background: "linear-gradient(90deg,#DC2626,#F97316)" }} />

          {/* Header */}
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ArrowLeftRight style={{ width: "14px", height: "14px", color: "#DC2626" }} />
                  </div>
                  <div>
                    <DialogTitle style={{ fontSize: "14px", fontWeight: 800, color: "#111827", fontFamily: ff }}>Transfer Unit Ownership</DialogTitle>
                    <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: 0, fontFamily: ff }}>Move or create a plan for the incoming owner</p>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)}
                  style={{ width: "28px", height: "28px", borderRadius: "6px", border: "none", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280" }}>
                  <X style={{ width: "12px", height: "12px" }} />
                </button>
              </div>
            </DialogHeader>
          </div>

          {/* Body */}
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Target resident */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>
                Target Resident
              </label>
              <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} style={{ ...selectStyle, color: toUserId ? "#111827" : "#9CA3AF" }}>
                <option value="" disabled>Select incoming owner…</option>
                {availableTargets.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              {!availableTargets.length && (
                <p style={{ fontSize: "11px", color: "#F59E0B", fontFamily: ff }}>No other residents available for transfer.</p>
              )}
            </div>

            {/* Transfer mode */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>
                Transfer Mode
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {TRANSFER_MODES.map((m) => {
                  const isSelected = mode === m.value;
                  return (
                    <button key={m.value} type="button" onClick={() => setMode(m.value as typeof mode)}
                      style={{ padding: "10px 12px", borderRadius: "8px", border: `1.5px solid ${isSelected ? m.border : "#E5E7EB"}`, background: isSelected ? m.bg : "#FAFAFA", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "3px", transition: "all 120ms" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "18px", height: "18px", borderRadius: "4px", background: isSelected ? m.color + "20" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: isSelected ? m.color : "#9CA3AF", fontWeight: 700 }}>{m.icon}</span>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? m.color : "#374151", fontFamily: ff }}>{m.label}</span>
                      </div>
                      <span style={{ fontSize: "10.5px", color: isSelected ? m.color + "BB" : "#9CA3AF", fontFamily: ff, lineHeight: 1.3 }}>{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment mode — only for CREATE_NEW_PLAN */}
            {mode === "CREATE_NEW_PLAN" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>
                  Payment Mode
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {[
                    { value: "CASH",        label: "Cash",         desc: "Full upfront payment" },
                    { value: "INSTALLMENT", label: "Installment",  desc: "Scheduled installments" },
                  ].map((pm) => {
                    const isSel = paymentMode === pm.value;
                    return (
                      <button key={pm.value} type="button" onClick={() => setPaymentMode(pm.value as typeof paymentMode)}
                        style={{ padding: "9px 12px", borderRadius: "8px", border: `1.5px solid ${isSel ? "#111827" : "#E5E7EB"}`, background: isSel ? "#111827" : "#FAFAFA", cursor: "pointer", display: "flex", flexDirection: "column", gap: "2px", transition: "all 120ms" }}>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: isSel ? "#FFF" : "#374151", fontFamily: ff }}>{pm.label}</span>
                        <span style={{ fontSize: "10.5px", color: isSel ? "#D1D5DB" : "#9CA3AF", fontFamily: ff }}>{pm.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>
                Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#9CA3AF" }}>(optional)</span>
              </label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Transfer reason / audit note…"
                style={textareaStyle} />
            </div>

            {/* Summary */}
            {toUserId && (
              <div style={{ borderRadius: "8px", border: `1px solid ${selectedMode.border}`, background: selectedMode.bg, padding: "10px 12px" }}>
                <p style={{ fontSize: "11.5px", fontWeight: 700, color: selectedMode.color, margin: "0 0 4px", fontFamily: ff }}>Transfer Summary</p>
                <p style={{ fontSize: "12px", color: "#374151", margin: 0, fontFamily: ff, lineHeight: 1.5 }}>
                  Transferring ownership to <strong style={{ color: "#111827" }}>{selectedTarget?.label}</strong> via{" "}
                  <strong style={{ color: selectedMode.color }}>{selectedMode.label}</strong>
                  {mode === "CREATE_NEW_PLAN" && <> · <span style={{ fontFamily: ffMono, fontSize: "11px" }}>{paymentMode}</span></>}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 20px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" onClick={() => setOpen(false)} disabled={submitting}
              style={{ padding: "7px 16px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", fontSize: "12.5px", fontWeight: 600, fontFamily: ff, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.5 : 1 }}>
              Cancel
            </button>
            <button type="button" onClick={() => void submit()} disabled={submitting || !toUserId}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 18px", borderRadius: "7px", border: "none", background: "#DC2626", color: "#FFF", fontSize: "12.5px", fontWeight: 700, fontFamily: ff, cursor: submitting || !toUserId ? "not-allowed" : "pointer", opacity: !toUserId ? 0.4 : 1, transition: "opacity 120ms" }}>
              <ArrowLeftRight style={{ width: "12px", height: "12px" }} />
              {submitting ? "Transferring…" : "Transfer Ownership"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}