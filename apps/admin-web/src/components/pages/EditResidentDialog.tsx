import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { toast } from "sonner";
import { Pencil, Mail, Phone, Fingerprint, Calendar, ShieldCheck, User, X, Check } from "lucide-react";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";
import type { ResidentOverview } from "./resident-360.types";

// ─── Types ────────────────────────────────────────────────────

type EditResidentDialogProps = {
  overview: ResidentOverview;
  onUpdated: () => Promise<void> | void;
};

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB",
  fontSize: "13px", color: "#111827", background: "#FFF", outline: "none",
  fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

// ─── Status colours ───────────────────────────────────────────

const STATUS_META: Record<string, { label: string; dot: string }> = {
  ACTIVE:    { label: "Active",    dot: "#059669" },
  SUSPENDED: { label: "Suspended", dot: "#D97706" },
  DISABLED:  { label: "Disabled",  dot: "#6B7280" },
  INVITED:   { label: "Invited",   dot: "#2563EB" },
  PENDING:   { label: "Pending",   dot: "#BE185D" },
};

// ─── Field wrapper ────────────────────────────────────────────

function Field({ label, icon, mono = false, children }: { label: string; icon?: React.ReactNode; mono?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "4px", fontFamily: "'Work Sans', sans-serif" }}>
        {icon && <span style={{ color: "#D1D5DB" }}>{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Input with icon ──────────────────────────────────────────

function IconInput({ icon, mono = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "#D1D5DB", display: "flex", pointerEvents: "none" }}>{icon}</span>}
      <input {...props} style={{ ...inputStyle, paddingLeft: icon ? "30px" : "10px", fontFamily: mono ? "'DM Mono', monospace" : "'Work Sans', sans-serif" }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function EditResidentDialog({ overview, onUpdated }: EditResidentDialogProps) {
  const [open, setOpen]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nameEN: "", nameAR: "", email: "", phone: "",
    nationalId: "", dateOfBirth: "", userStatus: "ACTIVE",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      nameEN:      overview.resident.user.nameEN    || "",
      nameAR:      overview.resident.user.nameAR    || "",
      email:       overview.resident.user.email     || "",
      phone:       overview.resident.user.phone     || "",
      nationalId:  overview.resident.nationalId     || "",
      dateOfBirth: overview.resident.dateOfBirth ? String(overview.resident.dateOfBirth).slice(0, 10) : "",
      userStatus:  overview.resident.user.userStatus || "ACTIVE",
    });
  }, [open, overview]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await apiClient.patch(`/admin/users/residents/${overview.resident.user.id}/profile`, {
        nameEN:      form.nameEN.trim()      || undefined,
        nameAR:      form.nameAR.trim()      || undefined,
        email:       form.email.trim()       || undefined,
        phone:       form.phone.trim()       || undefined,
        nationalId:  form.nationalId.trim()  || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        userStatus:  form.userStatus,
      });
      toast.success("Resident profile updated");
      setOpen(false);
      await onUpdated();
    } catch (e) {
      toast.error("Failed to update resident profile", { description: errorMessage(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta  = STATUS_META[form.userStatus] ?? STATUS_META.ACTIVE;
  const initials    = (overview.resident.user.nameEN || "R").split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();

  return (
    <>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 13px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif", transition: "background 120ms ease" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#FFF")}>
        <Pencil style={{ width: "12px", height: "12px" }} />
        Edit Resident
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent style={{ maxWidth: "560px", padding: 0, borderRadius: "12px", overflow: "hidden", border: "1px solid #EBEBEB", fontFamily: "'Work Sans', sans-serif" }}>

          {/* Header accent */}
          <div style={{ height: "3px", background: "linear-gradient(90deg, #0D9488, #2563EB)" }} />

          <div style={{ padding: "20px 24px 0" }}>
            <DialogHeader>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
                {/* Avatar chip */}
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#FFF" }}>{initials}</span>
                </div>
                <div>
                  <DialogTitle style={{ fontSize: "15px", fontWeight: 800, color: "#111827", letterSpacing: "-0.01em", margin: 0 }}>
                    Edit Resident Profile
                  </DialogTitle>
                  <DialogDescription style={{ fontSize: "12px", color: "#9CA3AF", margin: "2px 0 0" }}>
                    {overview.resident.user.nameEN || "Resident"} · update account and identity details.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Form body */}
          <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Field label="Name (EN)" icon={<User style={{ width: "10px", height: "10px" }} />}>
              <IconInput icon={<User style={{ width: "12px", height: "12px" }} />} value={form.nameEN} onChange={(e) => setForm((p) => ({ ...p, nameEN: e.target.value }))} placeholder="Ahmed Hassan" />
            </Field>
            <Field label="Name (AR)" icon={<User style={{ width: "10px", height: "10px" }} />}>
              <input value={form.nameAR} onChange={(e) => setForm((p) => ({ ...p, nameAR: e.target.value }))} placeholder="أحمد حسن" style={{ ...inputStyle, direction: "rtl" }} />
            </Field>
            <Field label="Email">
              <IconInput type="email" icon={<Mail style={{ width: "12px", height: "12px" }} />} value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="resident@example.com" />
            </Field>
            <Field label="Phone">
              <IconInput icon={<Phone style={{ width: "12px", height: "12px" }} />} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+2010xxxxxxxx" mono />
            </Field>
            <Field label="National ID">
              <IconInput icon={<Fingerprint style={{ width: "12px", height: "12px" }} />} value={form.nationalId} onChange={(e) => setForm((p) => ({ ...p, nationalId: e.target.value }))} placeholder="29800000000000" mono />
            </Field>
            <Field label="Date of Birth">
              <IconInput type="date" icon={<Calendar style={{ width: "12px", height: "12px" }} />} value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
            </Field>

            {/* Status — full width */}
            <div style={{ gridColumn: "span 2" }}>
              <Field label="Account Status" icon={<ShieldCheck style={{ width: "10px", height: "10px" }} />}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "7px", height: "7px", borderRadius: "50%", background: statusMeta.dot, flexShrink: 0, pointerEvents: "none" }} />
                  <select value={form.userStatus} onChange={(e) => setForm((p) => ({ ...p, userStatus: e.target.value }))}
                    style={{ ...selectStyle, paddingLeft: "26px" }}>
                    {Object.entries(STATUS_META).map(([v, m]) => (
                      <option key={v} value={v}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 24px 20px", display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid #F3F4F6" }}>
            <button type="button" disabled={submitting} onClick={() => setOpen(false)}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: submitting ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: "12px", height: "12px" }} /> Cancel
            </button>
            <button type="button" disabled={submitting} onClick={() => void submit()}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 18px", borderRadius: "7px", background: submitting ? "#9CA3AF" : "#111827", color: "#FFF", border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", transition: "background 120ms ease", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
              <Check style={{ width: "13px", height: "13px" }} />
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}