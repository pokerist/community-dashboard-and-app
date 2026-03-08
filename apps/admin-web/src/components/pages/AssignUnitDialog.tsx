import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";
import { Link2, X } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type UnitOption = { id: string; label: string };

type AssignUnitDialogProps = {
  residentUserId: string;
  unitOptions: UnitOption[];
  onAssigned: () => Promise<void> | void;
};

// ─── Style tokens ─────────────────────────────────────────────

const ff = "'Work Sans', sans-serif";

const selectStyle: React.CSSProperties = {
  height: "36px", borderRadius: "7px", border: "1px solid #E5E7EB",
  background: "#FFF", fontFamily: ff, fontSize: "12.5px", color: "#111827",
  outline: "none", padding: "0 10px", boxSizing: "border-box", width: "100%", cursor: "pointer",
};

const ROLES = [
  { value: "OWNER",  label: "Owner",  desc: "Full ownership rights",         color: "#1D4ED8", bg: "#EFF6FF" },
  { value: "TENANT", label: "Tenant", desc: "Active lease holder",           color: "#059669", bg: "#ECFDF5" },
  { value: "FAMILY", label: "Family", desc: "Family member of owner/tenant", color: "#D97706", bg: "#FFFBEB" },
];

// ─── Component ────────────────────────────────────────────────

export function AssignUnitDialog({ residentUserId, unitOptions, onAssigned }: AssignUnitDialogProps) {
  const [open, setOpen]           = useState(false);
  const [unitId, setUnitId]       = useState("");
  const [role, setRole]           = useState<"OWNER" | "TENANT" | "FAMILY">("FAMILY");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!unitId) { toast.error("Unit is required"); return; }
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/users/residents/${residentUserId}/units/assign`, { unitId, role });
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

  const selectedRole = ROLES.find((r) => r.value === role)!;

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", fontSize: "12.5px", fontWeight: 600, fontFamily: ff, cursor: "pointer", transition: "all 120ms" }}
        onMouseEnter={(e) => Object.assign(e.currentTarget.style, { background: "#111827", color: "#FFF", borderColor: "#111827" })}
        onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "#FFF", color: "#374151", borderColor: "#E5E7EB" })}
      >
        <Link2 style={{ width: "12px", height: "12px" }} />
        Assign Unit
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ maxWidth: "440px", padding: 0, borderRadius: "12px", border: "1px solid #EBEBEB", overflow: "hidden", fontFamily: ff }}>
          {/* Accent bar */}
          <div style={{ height: "3px", background: "linear-gradient(90deg,#111827,#374151)" }} />

          {/* Header */}
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Link2 style={{ width: "14px", height: "14px", color: "#374151" }} />
                  </div>
                  <div>
                    <DialogTitle style={{ fontSize: "14px", fontWeight: 800, color: "#111827", fontFamily: ff }}>Assign Unit</DialogTitle>
                    <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: 0, fontFamily: ff }}>Link a unit and set access role</p>
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
            {/* Unit select */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Unit</label>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ ...selectStyle, color: unitId ? "#111827" : "#9CA3AF" }}>
                <option value="" disabled>Select a unit…</option>
                {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
              {!unitOptions.length && (
                <p style={{ fontSize: "11px", color: "#F59E0B", fontFamily: ff }}>No units available to assign.</p>
              )}
            </div>

            {/* Role selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: ff }}>Access Role</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {ROLES.map((r) => {
                  const isSelected = role === r.value;
                  return (
                    <button key={r.value} type="button" onClick={() => setRole(r.value as typeof role)}
                      style={{ padding: "9px 6px", borderRadius: "8px", border: `1.5px solid ${isSelected ? r.color + "50" : "#E5E7EB"}`, background: isSelected ? r.bg : "#FAFAFA", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", transition: "all 120ms" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: isSelected ? r.color : "#374151", fontFamily: ff }}>{r.label}</span>
                      <span style={{ fontSize: "10px", color: isSelected ? r.color + "CC" : "#9CA3AF", fontFamily: ff, textAlign: "center", lineHeight: 1.3 }}>{r.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary pill */}
            {unitId && (
              <div style={{ borderRadius: "8px", border: "1px solid #F3F4F6", background: "#FAFAFA", padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: selectedRole.color, flexShrink: 0 }} />
                <p style={{ fontSize: "12px", color: "#374151", fontFamily: ff, margin: 0 }}>
                  Assigning as <strong style={{ color: selectedRole.color }}>{selectedRole.label}</strong> to{" "}
                  <strong style={{ color: "#111827" }}>{unitOptions.find((u) => u.id === unitId)?.label}</strong>
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
            <button type="button" onClick={() => void submit()} disabled={submitting || !unitId}
              style={{ padding: "7px 18px", borderRadius: "7px", border: "none", background: "#111827", color: "#FFF", fontSize: "12.5px", fontWeight: 700, fontFamily: ff, cursor: submitting || !unitId ? "not-allowed" : "pointer", opacity: !unitId ? 0.4 : 1, transition: "opacity 120ms" }}>
              {submitting ? "Assigning…" : "Assign Unit"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}