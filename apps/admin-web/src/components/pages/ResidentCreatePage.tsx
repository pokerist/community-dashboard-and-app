import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, UserPlus, Plus, Trash2, Banknote, CreditCard, Home, User, Fingerprint, Phone, Mail, FileUp, Calendar, StickyNote, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type UnitOption = { id: string; label: string };
type OwnerPaymentMode = "CASH" | "INSTALLMENT";

type OwnerInstallmentDraft = {
  dueDate: string; amount: string; referencePageIndex: string; referenceFile: File | null;
};

type OwnerUnitDraft = {
  unitId: string; paymentMode: OwnerPaymentMode; contractSignedAt: string;
  contractFile: File | null; notes: string; installments: OwnerInstallmentDraft[];
};

type CreateOwnerForm = {
  nameEN: string; nameAR: string; email: string; phone: string;
  nationalId: string; nationalIdPhotoFile: File | null; units: OwnerUnitDraft[];
};

function makeInstallment(): OwnerInstallmentDraft { return { dueDate: "", amount: "", referencePageIndex: "", referenceFile: null }; }
function makeUnit(): OwnerUnitDraft { return { unitId: "", paymentMode: "CASH", contractSignedAt: "", contractFile: null, notes: "", installments: [] }; }

const INIT_FORM: CreateOwnerForm = { nameEN: "", nameAR: "", email: "", phone: "", nationalId: "", nationalIdPhotoFile: null, units: [makeUnit()] };

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

  // ── Load available units ──────────────────────────────────
  const loadUnits = useCallback(async () => {
    setLoadingUnits(true);
    try {
      const collected: any[] = [];
      let page = 1; let totalPages = 1;
      do {
        const res = await apiClient.get("/units", { params: { page, limit: 100, status: "AVAILABLE" } });
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

  // ── Submit ────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.nameEN.trim())              { toast.error("Resident English name is required"); return; }
    if (!form.phone.trim())               { toast.error("Phone is required"); return; }
    if (!form.nationalIdPhotoFile)        { toast.error("National ID image is required"); return; }
    if (!form.units.length || !form.units[0].unitId) { toast.error("At least one unit assignment is required"); return; }

    setSaving(true);
    try {
      const natIdFileId = await uploadFile("/files/upload/national-id", form.nationalIdPhotoFile);
      const mappedUnits = [];

      for (let i = 0; i < form.units.length; i++) {
        const ud = form.units[i];
        if (!ud.unitId)                                          throw new Error(`Unit required in assignment #${i + 1}`);
        if (ud.paymentMode === "INSTALLMENT" && !ud.installments.length) throw new Error(`Installments required for assignment #${i + 1}`);

        const contractFileId = ud.contractFile ? await uploadFile("/files/upload/contract", ud.contractFile) : undefined;
        const installments = [];

        for (let j = 0; j < ud.installments.length; j++) {
          const inst = ud.installments[j];
          if (!inst.dueDate)                          throw new Error(`Due date required for installment #${j + 1} in assignment #${i + 1}`);
          const amt = Number(inst.amount);
          if (!Number.isFinite(amt) || amt <= 0)      throw new Error(`Invalid amount for installment #${j + 1}`);
          const referenceFileId = inst.referenceFile ? await uploadFile("/files/upload/contract", inst.referenceFile) : undefined;
          installments.push({ dueDate: new Date(inst.dueDate).toISOString(), amount: amt, referenceFileId, referencePageIndex: inst.referencePageIndex ? Number(inst.referencePageIndex) : undefined });
        }

        mappedUnits.push({ unitId: ud.unitId, paymentMode: ud.paymentMode, contractSignedAt: ud.contractSignedAt ? new Date(ud.contractSignedAt).toISOString() : undefined, contractFileId, notes: ud.notes.trim() || undefined, installments });
      }

      const res = await apiClient.post("/owners/create-with-unit", { nameEN: form.nameEN.trim(), nameAR: form.nameAR.trim() || undefined, email: form.email.trim() || undefined, phone: form.phone.trim(), nationalId: form.nationalId.trim() || undefined, nationalIdPhotoId: natIdFileId, units: mappedUnits });

      toast.success("Resident created", { description: res.data?.userEmail ? "Account, unit plans, and credentials email queued." : "Resident account and payment plans created." });
      setForm(INIT_FORM);
      onCreated?.();
      onBack();
    } catch (e) { toast.error("Failed to create resident", { description: errorMessage(e) }); }
    finally { setSaving(false); }
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
          <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#111827", letterSpacing: "-0.03em", margin: 0 }}>Add Resident</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Full onboarding — identity, unit assignments, contracts, payment plans.</p>
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
              const accent = ACCENTS[ui % ACCENTS.length];
              return (
                <div key={ui} style={{ borderRadius: "9px", border: `1px solid ${accent}30`, background: `${accent}04`, overflow: "hidden" }}>
                  {/* Assignment header */}
                  <div style={{ padding: "10px 14px", borderBottom: `1px solid ${accent}15`, background: `${accent}08`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#FFF", fontFamily: "'DM Mono', monospace" }}>{ui + 1}</span>
                      </div>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#111827" }}>Assignment #{ui + 1}</span>
                    </div>
                    {form.units.length > 1 && (
                      <button type="button" onClick={() => setForm((p) => ({ ...p, units: p.units.filter((_, i) => i !== ui) }))}
                        style={{ fontSize: "11.5px", color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif", fontWeight: 600 }}>
                        Remove
                      </button>
                    )}
                  </div>

                  <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <Field label="Unit" required>
                      <select value={ud.unitId} style={selectStyle} onChange={(e) => updateUnit(ui, (p) => ({ ...p, unitId: e.target.value }))}>
                        <option value="">{loadingUnits ? "Loading units…" : "Select unit"}</option>
                        {unitOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                      </select>
                    </Field>

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

                    <Field label="Notes" span2>
                      <div style={{ position: "relative" }}>
                        <StickyNote style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "12px", height: "12px", color: "#9CA3AF" }} />
                        <input value={ud.notes} onChange={(e) => updateUnit(ui, (p) => ({ ...p, notes: e.target.value }))} placeholder="Optional payment plan notes…" style={{ ...inputStyle, paddingLeft: "30px" }} />
                      </div>
                    </Field>
                  </div>

                  {/* ── Installments ──────────────────────────── */}
                  {ud.paymentMode === "INSTALLMENT" && (
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

      {/* ── Submit bar ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: "12px", color: "#9CA3AF", margin: 0 }}>
          {form.units.length} unit assignment{form.units.length !== 1 ? "s" : ""} · {form.units.reduce((acc, u) => acc + u.installments.length, 0)} installment{form.units.reduce((acc, u) => acc + u.installments.length, 0) !== 1 ? "s" : ""}
        </p>
        <button type="button" disabled={saving} onClick={() => void handleCreate()}
          style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 20px", borderRadius: "8px", background: saving ? "#9CA3AF" : "#111827", color: "#FFF", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", letterSpacing: "-0.01em", transition: "background 120ms ease" }}>
          <UserPlus style={{ width: "14px", height: "14px" }} />
          {saving ? "Creating Resident…" : "Create Resident"}
        </button>
      </div>
    </div>
  );
}