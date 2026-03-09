import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, UserPlus, Plus, Trash2, Banknote, CreditCard, Home, User, Fingerprint, Phone, Mail, FileUp, Calendar, StickyNote, CheckCircle2, Users, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type UnitOption = { id: string; label: string };
type OwnerPaymentMode = "CASH" | "INSTALLMENT";

type OwnerInstallmentDraft = {
  dueDate: string; amount: string; referencePageIndex: string; referenceFile: File | null;
};

type UnitAssignmentRole = "OWNER" | "TENANT" | "FAMILY";

type OwnerUnitDraft = {
  unitId: string; role: UnitAssignmentRole; paymentMode: OwnerPaymentMode; contractSignedAt: string;
  contractFile: File | null; notes: string; installments: OwnerInstallmentDraft[];
};

type CreateOwnerForm = {
  nameEN: string; nameAR: string; email: string; phone: string;
  nationalId: string; nationalIdPhotoFile: File | null; units: OwnerUnitDraft[];
};

/** A queued resident ready for submission */
type QueuedResident = CreateOwnerForm & { _key: number };

function makeInstallment(): OwnerInstallmentDraft { return { dueDate: "", amount: "", referencePageIndex: "", referenceFile: null }; }
function makeUnit(): OwnerUnitDraft { return { unitId: "", role: "OWNER", paymentMode: "CASH", contractSignedAt: "", contractFile: null, notes: "", installments: [] }; }

const INIT_FORM: CreateOwnerForm = { nameEN: "", nameAR: "", email: "", phone: "", nationalId: "", nationalIdPhotoFile: null, units: [makeUnit()] };

let _queueKey = 0;

const ROLE_OPTIONS: Array<{ value: UnitAssignmentRole; label: string; desc: string; color: string; bg: string; icon: string }> = [
  { value: "OWNER", label: "Owner", desc: "Full ownership rights", color: "#1D4ED8", bg: "#EFF6FF", icon: "key" },
  { value: "TENANT", label: "Tenant", desc: "Active lease holder", color: "#059669", bg: "#ECFDF5", icon: "home" },
  { value: "FAMILY", label: "Family", desc: "Family member", color: "#D97706", bg: "#FFFBEB", icon: "users" },
];

// ─── Design tokens ────────────────────────────────────────────

const ACCENTS = ["#0D9488", "#2563EB", "#BE185D"];

// ─── Shared styles ────────────────────────────────────────────

const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 11px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, hint, required, span2 = false, children }: { label: string; hint?: string; required?: boolean; span2?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", gridColumn: span2 ? "span 2" : undefined }}>
      <label style={{ fontSize: "11.5px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: "3px" }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "-2px" }}>{hint}</p>}
      {children}
    </div>
  );
}

function SectionHeading({ icon, title, count, accent }: { icon: React.ReactNode; title: string; count?: number; accent?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
      <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: accent ? `${accent}15` : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: accent ?? "#6B7280", flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#111827", letterSpacing: "-0.01em", fontFamily: "'Work Sans', sans-serif" }}>{title}</span>
      {count !== undefined && <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: accent ? `${accent}12` : "#F3F4F6", color: accent ?? "#6B7280", fontFamily: "'DM Mono', monospace" }}>{count}</span>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────

type ResidentCreatePageProps = { onBack: () => void; onCreated?: () => void };

// ─── Main component ───────────────────────────────────────────

export function ResidentCreatePage({ onBack, onCreated }: ResidentCreatePageProps) {
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateOwnerForm>(INIT_FORM);
  const [queue, setQueue] = useState<QueuedResident[]>([]);
  const [expandedQueue, setExpandedQueue] = useState(true);

  // ── Load available units ──────────────────────────────────
  const loadUnits = useCallback(async () => {
    setLoadingUnits(true);
    try {
      const collected: any[] = [];
      let page = 1; let totalPages = 1;
      do {
        const res = await apiClient.get("/units", {
          params: { page, limit: 100, displayStatus: "DELIVERED" },
        });
        const raw = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        collected.push(...raw);
        totalPages = Number(res.data?.meta?.totalPages || 1);
        page++;
      } while (page <= totalPages);
      setUnitOptions(collected.map((u: any) => ({ id: String(u.id), label: [u.projectName, u.block ? `Block ${u.block}` : null, u.unitNumber ? `Unit ${u.unitNumber}` : null].filter(Boolean).join(" – ") || String(u.id) })).filter((u) => !!u.id));
    } catch (e) { toast.error("Failed to load units", { description: errorMessage(e) }); }
    finally { setLoadingUnits(false); }
  }, []);

  useEffect(() => { void loadUnits(); }, [loadUnits]);

  const uploadFile = useCallback(async (endpoint: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const res = await apiClient.post(endpoint, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
    const id = res.data?.id as string | undefined;
    if (!id) throw new Error("Upload did not return file id");
    return id;
  }, []);

  const updateUnit = useCallback((idx: number, updater: (p: OwnerUnitDraft) => OwnerUnitDraft) => {
    setForm((p) => ({ ...p, units: p.units.map((u, i) => i === idx ? updater(u) : u) }));
  }, []);

  // ── Validate current form (returns true if valid) ────────
  const validateForm = (): boolean => {
    if (!form.nameEN.trim())              { toast.error("Resident English name is required"); return false; }
    if (!form.phone.trim())               { toast.error("Phone is required"); return false; }
    if (!form.nationalIdPhotoFile)        { toast.error("National ID image is required"); return false; }
    if (!form.units.length || !form.units[0].unitId) { toast.error("At least one unit assignment is required"); return false; }
    return true;
  };

  // ── Add current form to queue ───────────────────────────
  const addToQueue = () => {
    if (!validateForm()) return;
    setQueue((prev) => [...prev, { ...form, _key: ++_queueKey }]);
    // Keep unit assignments but clear identity fields so the next resident form is pre-filled with the same unit(s)
    const preservedUnits = form.units.map((u) => ({ ...makeUnit(), unitId: u.unitId, role: u.role }));
    setForm({ ...INIT_FORM, units: preservedUnits });
    toast.success(`Added ${form.nameEN.trim()} to queue`);
  };

  const removeFromQueue = (key: number) => {
    setQueue((prev) => prev.filter((r) => r._key !== key));
  };

  // ── Submit a single resident ────────────────────────────
  const submitOneResident = async (resident: CreateOwnerForm) => {
    const natIdFileId = await uploadFile("/files/upload/national-id", resident.nationalIdPhotoFile!);
    const ownerUnits = resident.units.filter((u) => u.role === "OWNER" && u.unitId);
    const nonOwnerUnits = resident.units.filter((u) => u.role !== "OWNER" && u.unitId);

    const mappedOwnerUnits = [];
    for (let i = 0; i < ownerUnits.length; i++) {
      const ud = ownerUnits[i];
      if (ud.paymentMode === "INSTALLMENT" && !ud.installments.length) throw new Error(`Installments required for owner assignment #${i + 1}`);
      const contractFileId = ud.contractFile ? await uploadFile("/files/upload/contract", ud.contractFile) : undefined;
      const installments = [];
      for (let j = 0; j < ud.installments.length; j++) {
        const inst = ud.installments[j];
        if (!inst.dueDate) throw new Error(`Due date required for installment #${j + 1} in assignment #${i + 1}`);
        const amt = Number(inst.amount);
        if (!Number.isFinite(amt) || amt <= 0) throw new Error(`Invalid amount for installment #${j + 1}`);
        const referenceFileId = inst.referenceFile ? await uploadFile("/files/upload/contract", inst.referenceFile) : undefined;
        installments.push({ dueDate: new Date(inst.dueDate).toISOString(), amount: amt, referenceFileId, referencePageIndex: inst.referencePageIndex ? Number(inst.referencePageIndex) : undefined });
      }
      mappedOwnerUnits.push({ unitId: ud.unitId, paymentMode: ud.paymentMode, contractSignedAt: ud.contractSignedAt ? new Date(ud.contractSignedAt).toISOString() : undefined, contractFileId, notes: ud.notes.trim() || undefined, installments });
    }

    // Always use create-with-unit to create the user (it's the only endpoint that handles full user+resident creation).
    // For owner units, pass them with payment/contract info. For non-owner-only residents, pass the first unit as a
    // placeholder — the assign endpoint below will fix the role.
    const createUnits = mappedOwnerUnits.length > 0
      ? mappedOwnerUnits
      : [{ unitId: nonOwnerUnits[0].unitId, paymentMode: "CASH" as const, installments: [] }];

    const res = await apiClient.post("/owners/create-with-unit", {
      nameEN: resident.nameEN.trim(), nameAR: resident.nameAR.trim() || undefined,
      email: resident.email.trim() || undefined, phone: resident.phone.trim(),
      nationalId: resident.nationalId.trim() || undefined, nationalIdPhotoId: natIdFileId,
      units: createUnits,
    });
    const userId: string = res.data?.userId;

    // Assign non-owner units with correct role (TENANT/FAMILY).
    // The assign endpoint uses upsert, so it also fixes the role for the placeholder unit above.
    for (const ud of nonOwnerUnits) {
      await apiClient.post(`/admin/users/residents/${userId}/units/assign`, { unitId: ud.unitId, role: ud.role });
    }
  };

  // ── Submit all queued residents ─────────────────────────
  const handleSubmitAll = async () => {
    // If form has data, add it to queue first
    const toSubmit = [...queue];
    const hasFormData = form.nameEN.trim() || form.phone.trim();
    if (hasFormData) {
      if (!validateForm()) return;
      toSubmit.push({ ...form, _key: ++_queueKey });
    }
    if (!toSubmit.length) { toast.error("No residents to create. Fill the form or add residents to the queue."); return; }

    setSaving(true);
    let successCount = 0;
    const failedResidents: QueuedResident[] = [];

    for (const resident of toSubmit) {
      try {
        await submitOneResident(resident);
        successCount++;
      } catch (e) {
        toast.error(`Failed to create ${resident.nameEN}`, { description: errorMessage(e) });
        failedResidents.push(resident);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} resident${successCount > 1 ? "s" : ""} created successfully`);
    }

    setQueue(failedResidents);
    if (failedResidents.length === 0) {
      setForm(INIT_FORM);
      onCreated?.();
      onBack();
    }
    setSaving(false);
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif", maxWidth: "860px" }}>
      <style>{`@keyframes sk-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {/* ── Page header ────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button type="button" onClick={onBack}
              style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#9CA3AF", background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontFamily: "'Work Sans', sans-serif" }}>
              <ArrowLeft style={{ width: "12px", height: "12px" }} /> Residents
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "12px" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: 600 }}>New Resident</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#111827", letterSpacing: "-0.03em", margin: 0 }}>Add Residents</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Add one or more residents — fill info, queue them, then submit all at once.</p>
        </div>
        <button type="button" onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", cursor: "pointer", fontSize: "12.5px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
          <ArrowLeft style={{ width: "13px", height: "13px" }} /> Back
        </button>
      </div>

      {/* ── Section 1: Identity ────────────────────────────── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: "16px" }}>
        {/* Section accent strip */}
        <div style={{ height: "3px", background: ACCENTS[1] }} />
        <div style={{ padding: "20px 24px" }}>
          <SectionHeading icon={<User style={{ width: "13px", height: "13px" }} />} title="Identity" accent={ACCENTS[1]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Field label="Name (EN)" required>
              <input value={form.nameEN} onChange={(e) => setForm((p) => ({ ...p, nameEN: e.target.value }))} placeholder="Ahmed Hassan Mohamed" style={inputStyle} />
            </Field>
            <Field label="Name (AR)">
              <input value={form.nameAR} onChange={(e) => setForm((p) => ({ ...p, nameAR: e.target.value }))} placeholder="أحمد حسن محمد" style={{ ...inputStyle, direction: "rtl" }} />
            </Field>
            <Field label="Email" hint="Used for login credentials email.">
              <div style={{ position: "relative" }}>
                <Mail style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="resident@example.com" style={{ ...inputStyle, paddingLeft: "32px" }} />
              </div>
            </Field>
            <Field label="Phone" required>
              <div style={{ position: "relative" }}>
                <Phone style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+2010xxxxxxxx" style={{ ...inputStyle, paddingLeft: "32px" }} />
              </div>
            </Field>
            <Field label="National ID">
              <div style={{ position: "relative" }}>
                <Fingerprint style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "13px", height: "13px", color: "#9CA3AF" }} />
                <input value={form.nationalId} onChange={(e) => setForm((p) => ({ ...p, nationalId: e.target.value }))} placeholder="29800000000000" style={{ ...inputStyle, paddingLeft: "32px", fontFamily: "'DM Mono', monospace" }} />
              </div>
            </Field>
            <Field label="National ID Photo" required hint={form.nationalIdPhotoFile ? `✓ ${form.nationalIdPhotoFile.name}` : "Image or PDF"}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "7px", border: `1px dashed ${form.nationalIdPhotoFile ? "#10B981" : "#D1D5DB"}`, background: form.nationalIdPhotoFile ? "#ECFDF5" : "#FAFAFA", cursor: "pointer", fontSize: "12.5px", color: form.nationalIdPhotoFile ? "#065F46" : "#6B7280", transition: "all 120ms ease" }}>
                {form.nationalIdPhotoFile
                  ? <CheckCircle2 style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                  : <FileUp style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                }
                <span>{form.nationalIdPhotoFile ? form.nationalIdPhotoFile.name : "Upload ID photo"}</span>
                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setForm((p) => ({ ...p, nationalIdPhotoFile: e.target.files?.[0] ?? null }))} />
              </label>
            </Field>
          </div>
        </div>
      </div>

      {/* ── Section 2: Unit Assignments ────────────────────── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: "24px" }}>
        <div style={{ height: "3px", background: ACCENTS[0] }} />
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <SectionHeading icon={<Home style={{ width: "13px", height: "13px" }} />} title="Unit Assignments & Payment Plans" count={form.units.length} accent={ACCENTS[0]} />
            <button type="button" onClick={() => setForm((p) => ({ ...p, units: [...p.units, makeUnit()] }))}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: `1px solid ${ACCENTS[0]}40`, background: `${ACCENTS[0]}08`, color: ACCENTS[0], cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", transition: "all 120ms ease" }}>
              <Plus style={{ width: "12px", height: "12px" }} /> Add Unit
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {form.units.map((ud, ui) => {
              const roleOpt = ROLE_OPTIONS.find((r) => r.value === ud.role) ?? ROLE_OPTIONS[0];
              const accent = roleOpt.color;
              return (
                <div key={ui} style={{ borderRadius: "9px", border: `1px solid ${accent}30`, background: `${accent}04`, overflow: "hidden" }}>
                  {/* Assignment header */}
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${accent}15`, background: `${accent}08`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#FFF", fontFamily: "'DM Mono', monospace" }}>{ui + 1}</span>
                      </div>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827" }}>Assignment #{ui + 1}</span>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: roleOpt.bg, color: roleOpt.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{roleOpt.label}</span>
                    </div>
                    {form.units.length > 1 && (
                      <button type="button" onClick={() => setForm((p) => ({ ...p, units: p.units.filter((_, i) => i !== ui) }))}
                        style={{ fontSize: "11.5px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {/* Unit + Role row */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <Field label="Unit" required>
                        <select value={ud.unitId} style={selectStyle} onChange={(e) => updateUnit(ui, (p) => ({ ...p, unitId: e.target.value }))}>
                          <option value="">{loadingUnits ? "Loading units…" : "Select unit"}</option>
                          {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                        </select>
                      </Field>

                      <Field label="Role">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "5px" }}>
                          {ROLE_OPTIONS.map((r) => {
                            const isSelected = ud.role === r.value;
                            return (
                              <button key={r.value} type="button" onClick={() => updateUnit(ui, (p) => ({ ...p, role: r.value, ...(r.value !== "OWNER" ? { paymentMode: "CASH" as const, installments: [], contractFile: null, contractSignedAt: "", notes: "" } : {}) }))}
                                style={{ padding: "7px 4px", borderRadius: "7px", border: `1.5px solid ${isSelected ? r.color + "50" : "#E5E7EB"}`, background: isSelected ? r.bg : "#FAFAFA", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", transition: "all 120ms" }}>
                                <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? r.color : "#374151", fontFamily: "'Work Sans', sans-serif" }}>{r.label}</span>
                                <span style={{ fontSize: "9px", color: isSelected ? r.color + "CC" : "#9CA3AF", fontFamily: "'Work Sans', sans-serif", textAlign: "center", lineHeight: 1.2 }}>{r.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                    </div>

                    {/* Owner-only fields: payment, contract */}
                    {ud.role === "OWNER" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        {/* Payment mode toggle */}
                        <Field label="Payment Mode">
                          <div style={{ display: "flex", gap: "6px" }}>
                            {(["CASH", "INSTALLMENT"] as OwnerPaymentMode[]).map((mode) => {
                              const active = ud.paymentMode === mode;
                              return (
                                <button key={mode} type="button" onClick={() => updateUnit(ui, (p) => ({ ...p, paymentMode: mode, installments: mode === "INSTALLMENT" && !p.installments.length ? [makeInstallment()] : mode === "CASH" ? [] : p.installments }))}
                                  style={{ flex: 1, padding: "8px", borderRadius: "7px", border: `1px solid ${active ? accent : "#E5E7EB"}`, background: active ? `${accent}12` : "#FAFAFA", color: active ? accent : "#9CA3AF", cursor: "pointer", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", transition: "all 120ms ease", fontFamily: "'Work Sans', sans-serif" }}>
                                  {mode === "CASH" ? <Banknote style={{ width: "12px", height: "12px" }} /> : <CreditCard style={{ width: "12px", height: "12px" }} />}
                                  {mode === "CASH" ? "Cash" : "Installment"}
                                </button>
                              );
                            })}
                          </div>
                        </Field>

                        <Field label="Contract Signed Date">
                          <div style={{ position: "relative" }}>
                            <Calendar style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", color: "#9CA3AF" }} />
                            <input type="date" value={ud.contractSignedAt} style={{ ...inputStyle, paddingLeft: "30px" }} onChange={(e) => updateUnit(ui, (p) => ({ ...p, contractSignedAt: e.target.value }))} />
                          </div>
                        </Field>

                        <Field label="Contract File" hint={ud.contractFile ? `✓ ${ud.contractFile.name}` : "Image or PDF — optional"}>
                          <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "7px", border: `1px dashed ${ud.contractFile ? "#10B981" : "#D1D5DB"}`, background: ud.contractFile ? "#ECFDF5" : "#FAFAFA", cursor: "pointer", fontSize: "12.5px", color: ud.contractFile ? "#065F46" : "#6B7280", transition: "all 120ms ease" }}>
                            {ud.contractFile ? <CheckCircle2 style={{ width: "13px", height: "13px" }} /> : <FileUp style={{ width: "13px", height: "13px" }} />}
                            {ud.contractFile ? ud.contractFile.name : "Upload contract"}
                            <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => updateUnit(ui, (p) => ({ ...p, contractFile: e.target.files?.[0] ?? null }))} />
                          </label>
                        </Field>

                        <Field label="Notes">
                          <div style={{ position: "relative" }}>
                            <StickyNote style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", color: "#9CA3AF" }} />
                            <input value={ud.notes} onChange={(e) => updateUnit(ui, (p) => ({ ...p, notes: e.target.value }))} placeholder="Optional payment plan notes…" style={{ ...inputStyle, paddingLeft: "30px" }} />
                          </div>
                        </Field>
                      </div>
                    )}
                  </div>

                  {/* ── Installments ──────────────────────────── */}
                  {ud.role === "OWNER" && ud.paymentMode === "INSTALLMENT" && (
                    <div style={{ borderTop: `1px solid ${accent}20`, padding: "12px 14px 14px", background: `${accent}03` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <CreditCard style={{ width: "12px", height: "12px", color: accent }} />
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>Installments / Checks</span>
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: `${accent}15`, color: accent, fontFamily: "'DM Mono', monospace" }}>{ud.installments.length}</span>
                        </div>
                        <button type="button" onClick={() => updateUnit(ui, (p) => ({ ...p, installments: [...p.installments, makeInstallment()] }))}
                          style={{ fontSize: "11.5px", fontWeight: 700, color: accent, background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif', display: 'flex', alignItems: 'center', gap: '4px" }}>
                          + Add Installment
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {ud.installments.map((inst, ii) => (
                          <div key={ii} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 1fr auto", gap: "8px", alignItems: "end", padding: "10px 12px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF" }}>
                            <Field label="Due Date">
                              <input type="date" value={inst.dueDate} style={inputStyle} onChange={(e) => updateUnit(ui, (p) => ({ ...p, installments: p.installments.map((it, j) => j === ii ? { ...it, dueDate: e.target.value } : it) }))} />
                            </Field>
                            <Field label="Amount (EGP)">
                              <input type="number" step="0.01" value={inst.amount} style={inputStyle} placeholder="0.00" onChange={(e) => updateUnit(ui, (p) => ({ ...p, installments: p.installments.map((it, j) => j === ii ? { ...it, amount: e.target.value } : it) }))} />
                            </Field>
                            <Field label="Page #">
                              <input type="number" min={1} value={inst.referencePageIndex} style={inputStyle} onChange={(e) => updateUnit(ui, (p) => ({ ...p, installments: p.installments.map((it, j) => j === ii ? { ...it, referencePageIndex: e.target.value } : it) }))} />
                            </Field>
                            <Field label="Check File" hint={inst.referenceFile?.name ?? "Optional"}>
                              <label style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "7px", border: `1px dashed ${inst.referenceFile ? "#10B981" : "#D1D5DB"}`, background: inst.referenceFile ? "#ECFDF5" : "#FAFAFA", cursor: "pointer", fontSize: "11.5px", color: inst.referenceFile ? "#065F46" : "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden" }}>
                                {inst.referenceFile ? <CheckCircle2 style={{ width: "11px", height: "11px", flexShrink: 0 }} /> : <FileUp style={{ width: "11px", height: "11px", flexShrink: 0 }} />}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{inst.referenceFile ? inst.referenceFile.name : "Upload"}</span>
                                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => updateUnit(ui, (p) => ({ ...p, installments: p.installments.map((it, j) => j === ii ? { ...it, referenceFile: e.target.files?.[0] ?? null } : it) }))} />
                              </label>
                            </Field>
                            <button type="button" onClick={() => updateUnit(ui, (p) => ({ ...p, installments: p.installments.filter((_, j) => j !== ii) }))}
                              style={{ width: "30px", height: "30px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: "1px" }}>
                              <Trash2 style={{ width: "11px", height: "11px" }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Add to Queue + Submit buttons ────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: queue.length > 0 ? "16px" : "0" }}>
        <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>
          {form.units.length} unit assignment{form.units.length !== 1 ? "s" : ""} · {queue.length} in queue
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" disabled={saving} onClick={addToQueue}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "8px", background: "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", transition: "all 120ms ease" }}
            onMouseEnter={(e) => !saving && Object.assign(e.currentTarget.style, { background: "#F9FAFB", borderColor: "#D1D5DB" })}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, { background: "#FFF", borderColor: "#E5E7EB" })}>
            <Plus style={{ width: "13px", height: "13px" }} />
            Add & Queue Another
          </button>
          <button type="button" disabled={saving} onClick={() => void handleSubmitAll()}
            style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 20px", borderRadius: "8px", background: saving ? "#9CA3AF" : "#111827", color: "#FFF", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", letterSpacing: "-0.01em", transition: "background 120ms ease" }}>
            <UserPlus style={{ width: "14px", height: "14px" }} />
            {saving ? "Creating…" : queue.length > 0 ? `Create All (${queue.length + (form.nameEN.trim() ? 1 : 0)})` : "Create Resident"}
          </button>
        </div>
      </div>

      {/* ── Queued Residents ──────────────────────────────── */}
      {queue.length > 0 && (
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ height: "3px", background: "linear-gradient(90deg, #059669, #10B981)" }} />
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expandedQueue ? "12px" : "0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users style={{ width: "13px", height: "13px", color: "#059669" }} />
                </div>
                <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#111827", fontFamily: "'Work Sans', sans-serif" }}>Queued Residents</span>
                <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: "#ECFDF5", color: "#059669", fontFamily: "'DM Mono', monospace" }}>{queue.length}</span>
              </div>
              <button type="button" onClick={() => setExpandedQueue((p) => !p)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "4px" }}>
                {expandedQueue ? <ChevronUp style={{ width: "14px", height: "14px" }} /> : <ChevronDown style={{ width: "14px", height: "14px" }} />}
              </button>
            </div>

            {expandedQueue && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {queue.map((r, idx) => {
                  const roleLabel = ROLE_OPTIONS.find((ro) => ro.value === r.units[0]?.role);
                  const unitLabel = unitOptions.find((u) => u.id === r.units[0]?.unitId)?.label ?? "—";
                  return (
                    <div key={r._key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "8px", border: "1px solid #E5E7EB", background: "#FAFAFA" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "10px", fontWeight: 800, color: "#FFF", fontFamily: "'DM Mono', monospace" }}>{idx + 1}</span>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#111827", fontFamily: "'Work Sans', sans-serif" }}>{r.nameEN}</p>
                          <p style={{ margin: 0, fontSize: "11px", color: "#6B7280", fontFamily: "'Work Sans', sans-serif" }}>
                            {r.phone} · {r.units.length} unit{r.units.length > 1 ? "s" : ""}
                            {roleLabel && <> · <span style={{ color: roleLabel.color, fontWeight: 600 }}>{roleLabel.label}</span></>}
                            {" · "}{unitLabel}
                          </p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeFromQueue(r._key)} disabled={saving}
                        style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #FCA5A5", background: "#FEF2F2", color: "#DC2626", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Trash2 style={{ width: "11px", height: "11px" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
