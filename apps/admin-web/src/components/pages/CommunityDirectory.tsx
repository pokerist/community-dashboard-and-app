import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Phone, MapPin, Clock, Link, FileUp, CheckCircle2 } from "lucide-react";
import apiClient, { handleApiError } from "../../lib/api-client";

// ─── Types ────────────────────────────────────────────────────

type HelpCenterEntry = {
  id: string; title: string; phone: string;
  availability?: string | null; priority?: number; isActive?: boolean;
};
type DiscoverPlace = {
  id: string; name: string; category?: string | null; address?: string | null;
  mapLink?: string | null; phone?: string | null; workingHours?: string | null;
  imageFileId?: string | null; isActive?: boolean;
};

const defaultHelp: Omit<HelpCenterEntry, "id"> = { title: "", phone: "", availability: "", priority: 100, isActive: true };
const defaultPlace: Omit<DiscoverPlace, "id"> = { name: "", category: "", address: "", mapLink: "", phone: "", workingHours: "", imageFileId: "", isActive: true };

// ─── Design tokens ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB",
  fontSize: "13px", color: "#111827", background: "#FFF", outline: "none",
  fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px",
};

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>
        {label}{required && <span style={{ color: "#DC2626", marginLeft: "3px" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ color: "#9CA3AF" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

// ─── Help entry card ──────────────────────────────────────────

function HelpCard({ row, onDelete }: { row: HelpCenterEntry; onDelete: () => void }) {
  return (
    <div style={{ borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FFF", padding: "11px 13px", display: "flex", alignItems: "center", gap: "10px", transition: "background 100ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FFF"; }}>
      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#F0FDF4", border: "1.5px solid #A7F3D0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Phone style={{ width: "13px", height: "13px", color: "#059669" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <span style={{ fontSize: "11.5px", color: "#6B7280", fontFamily: "'DM Mono', monospace" }}>{row.phone}</span>
          {row.availability && <span style={{ fontSize: "11px", color: "#9CA3AF" }}>· {row.availability}</span>}
        </div>
      </div>
      {row.priority !== undefined && (
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "#F3F4F6", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>#{row.priority}</span>
      )}
      <button type="button" onClick={onDelete}
        style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#DC2626", flexShrink: 0, transition: "all 120ms ease" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#DC2626"; e.currentTarget.style.color = "#FFF"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#DC2626"; }}>
        <Trash2 style={{ width: "10px", height: "10px" }} />
      </button>
    </div>
  );
}

// ─── Discover place card ──────────────────────────────────────

function PlaceCard({ row, onDelete }: { row: DiscoverPlace; onDelete: () => void }) {
  return (
    <div style={{ borderRadius: "8px", border: "1px solid #EBEBEB", background: "#FFF", padding: "11px 13px", display: "flex", alignItems: "center", gap: "10px", transition: "background 100ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FFF"; }}>
      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#EFF6FF", border: "1.5px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MapPin style={{ width: "13px", height: "13px", color: "#2563EB" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
          {row.category && <span style={{ fontSize: "11px", color: "#6B7280" }}>{row.category}</span>}
          {row.address && <span style={{ fontSize: "11px", color: "#9CA3AF" }}>· {row.address}</span>}
          {row.workingHours && <span style={{ fontSize: "11px", color: "#9CA3AF", display: "flex", alignItems: "center", gap: "3px" }}><Clock style={{ width: "9px", height: "9px" }} />{row.workingHours}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
        {row.mapLink && (
          <a href={row.mapLink} target="_blank" rel="noreferrer"
            style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", transition: "all 120ms ease", textDecoration: "none" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#111827"; (e.currentTarget as HTMLAnchorElement).style.color = "#FFF"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#FFF"; (e.currentTarget as HTMLAnchorElement).style.color = "#6B7280"; }}>
            <Link style={{ width: "10px", height: "10px" }} />
          </a>
        )}
        <button type="button" onClick={onDelete}
          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#DC2626", transition: "all 120ms ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#DC2626"; e.currentTarget.style.color = "#FFF"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#DC2626"; }}>
          <Trash2 style={{ width: "10px", height: "10px" }} />
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function CommunityDirectory() {
  const [tab, setTab] = useState<"help" | "discover">("help");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [helpRows, setHelpRows] = useState<HelpCenterEntry[]>([]);
  const [discoverRows, setDiscoverRows] = useState<DiscoverPlace[]>([]);
  const [helpForm, setHelpForm] = useState(defaultHelp);
  const [discoverForm, setDiscoverForm] = useState(defaultPlace);
  const [discoverImageFile, setDiscoverImageFile] = useState<File | null>(null);

  const activeCount = useMemo(() => tab === "help" ? helpRows.length : discoverRows.length, [tab, helpRows.length, discoverRows.length]);

  const load = async () => {
    setLoading(true);
    try {
      const [helpRes, discoverRes] = await Promise.all([
        apiClient.get<HelpCenterEntry[]>("/help-center/admin"),
        apiClient.get<DiscoverPlace[]>("/discover/admin"),
      ]);
      setHelpRows(Array.isArray(helpRes.data) ? helpRes.data : []);
      setDiscoverRows(Array.isArray(discoverRes.data) ? discoverRes.data : []);
    } catch (e) { toast.error("Failed to load directory", { description: handleApiError(e) }); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const createHelp = async () => {
    if (!helpForm.title.trim() || !helpForm.phone.trim()) { toast.error("Title and phone are required"); return; }
    setSaving(true);
    try {
      await apiClient.post("/help-center/admin", { ...helpForm, title: helpForm.title.trim(), phone: helpForm.phone.trim(), availability: helpForm.availability?.trim() || null });
      toast.success("Help center entry created"); setHelpForm(defaultHelp); await load();
    } catch (e) { toast.error("Failed to create", { description: handleApiError(e) }); }
    finally { setSaving(false); }
  };

  const createDiscover = async () => {
    if (!discoverForm.name.trim()) { toast.error("Place name is required"); return; }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("name", discoverForm.name.trim());
      if (discoverForm.category?.trim()) form.append("category", discoverForm.category.trim());
      if (discoverForm.address?.trim()) form.append("address", discoverForm.address.trim());
      if (discoverForm.mapLink?.trim()) form.append("mapLink", discoverForm.mapLink.trim());
      if (discoverForm.phone?.trim()) form.append("phone", discoverForm.phone.trim());
      if (discoverForm.workingHours?.trim()) form.append("workingHours", discoverForm.workingHours.trim());
      if (discoverForm.imageFileId?.trim()) form.append("imageFileId", discoverForm.imageFileId.trim());
      if (discoverImageFile) form.append("image", discoverImageFile);
      await apiClient.post("/discover/admin", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Discover place created"); setDiscoverForm(defaultPlace); setDiscoverImageFile(null); await load();
    } catch (e) { toast.error("Failed to create", { description: handleApiError(e) }); }
    finally { setSaving(false); }
  };

  const removeHelp = async (id: string) => {
    try { await apiClient.delete(`/help-center/admin/${id}`); toast.success("Entry deleted"); await load(); }
    catch (e) { toast.error("Failed to delete", { description: handleApiError(e) }); }
  };
  const removeDiscover = async (id: string) => {
    try { await apiClient.delete(`/discover/admin/${id}`); toast.success("Place deleted"); await load(); }
    catch (e) { toast.error("Failed to delete", { description: handleApiError(e) }); }
  };

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* ── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Community Directory</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Manage resident-facing Help Center contacts and Discover places.</p>
        </div>
        <button type="button" onClick={() => void load()}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", background: "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif" }}>
          <RefreshCw style={{ width: "13px", height: "13px" }} /> Refresh
        </button>
      </div>

      {/* ── Tabs ─── */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px", padding: "4px", borderRadius: "9px", border: "1px solid #EBEBEB", background: "#FAFAFA", width: "fit-content" }}>
        {(["help", "discover"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ padding: "6px 16px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", cursor: "pointer", border: "none", background: tab === t ? "#FFF" : "transparent", color: tab === t ? "#111827" : "#6B7280", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 120ms ease" }}>
            {t === "help" ? "Help Center" : "Discover"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "14px", alignItems: "start" }}>
        {/* ── Create form panel ─── */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>
              {tab === "help" ? "Add Help Center Entry" : "Add Discover Place"}
            </span>
          </div>
          <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {tab === "help" ? (
              <>
                <Field label="Title" required>
                  <input value={helpForm.title} onChange={(e) => setHelpForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Emergency Maintenance" style={inputStyle} />
                </Field>
                <Field label="Phone" required>
                  <input value={helpForm.phone} onChange={(e) => setHelpForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+201xxxxxxxx" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
                </Field>
                <Field label="Availability">
                  <input value={helpForm.availability ?? ""} onChange={(e) => setHelpForm((p) => ({ ...p, availability: e.target.value }))} placeholder="e.g. 24/7 or 9AM–5PM" style={inputStyle} />
                </Field>
                <Field label="Priority">
                  <input type="number" value={helpForm.priority ?? 100} onChange={(e) => setHelpForm((p) => ({ ...p, priority: Number(e.target.value || 100) }))} style={inputStyle} />
                </Field>
                <button type="button" onClick={() => void createHelp()} disabled={saving}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: saving ? "#9CA3AF" : "#111827", color: "#FFF", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", marginTop: "4px" }}>
                  <Plus style={{ width: "13px", height: "13px" }} />
                  {saving ? "Saving…" : "Create Entry"}
                </button>
              </>
            ) : (
              <>
                <Field label="Name" required>
                  <input value={discoverForm.name} onChange={(e) => setDiscoverForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Community Gym" style={inputStyle} />
                </Field>
                <Field label="Category">
                  <input value={discoverForm.category ?? ""} onChange={(e) => setDiscoverForm((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Fitness, Dining…" style={inputStyle} />
                </Field>
                <Field label="Address">
                  <input value={discoverForm.address ?? ""} onChange={(e) => setDiscoverForm((p) => ({ ...p, address: e.target.value }))} placeholder="Building / Unit" style={inputStyle} />
                </Field>
                <Field label="Map URL">
                  <input value={discoverForm.mapLink ?? ""} onChange={(e) => setDiscoverForm((p) => ({ ...p, mapLink: e.target.value }))} placeholder="https://maps.google.com/…" style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input value={discoverForm.phone ?? ""} onChange={(e) => setDiscoverForm((p) => ({ ...p, phone: e.target.value }))} style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
                </Field>
                <Field label="Working Hours">
                  <input value={discoverForm.workingHours ?? ""} onChange={(e) => setDiscoverForm((p) => ({ ...p, workingHours: e.target.value }))} placeholder="e.g. 8AM – 10PM" style={inputStyle} />
                </Field>
                <Field label="Image File ID">
                  <input value={discoverForm.imageFileId ?? ""} onChange={(e) => setDiscoverForm((p) => ({ ...p, imageFileId: e.target.value }))} style={inputStyle} />
                </Field>
                <Field label="Upload Image">
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "7px", border: `1px dashed ${discoverImageFile ? "#10B981" : "#D1D5DB"}`, background: discoverImageFile ? "#ECFDF5" : "#FAFAFA", cursor: "pointer", fontSize: "12px", color: discoverImageFile ? "#065F46" : "#6B7280", height: "36px", boxSizing: "border-box" }}>
                    {discoverImageFile ? <CheckCircle2 style={{ width: "12px", height: "12px" }} /> : <FileUp style={{ width: "12px", height: "12px" }} />}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{discoverImageFile ? discoverImageFile.name : "Choose image"}</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setDiscoverImageFile(e.target.files?.[0] ?? null)} />
                  </label>
                </Field>
                <button type="button" onClick={() => void createDiscover()} disabled={saving}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: saving ? "#9CA3AF" : "#111827", color: "#FFF", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", marginTop: "4px" }}>
                  <Plus style={{ width: "13px", height: "13px" }} />
                  {saving ? "Saving…" : "Create Place"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── List panel ─── */}
        <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
            {tab === "help" ? (
              <SectionLabel icon={<Phone style={{ width: "12px", height: "12px" }} />} label="Help Center Entries" />
            ) : (
              <SectionLabel icon={<MapPin style={{ width: "12px", height: "12px" }} />} label="Discover Places" />
            )}
            <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#F3F4F6", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginLeft: "auto" }}>{activeCount}</span>
          </div>
          <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "600px", overflowY: "auto" }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: "58px", borderRadius: "8px", background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%" }} />
              ))
            ) : tab === "help" ? (
              helpRows.length === 0 ? (
                <p style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "#9CA3AF" }}>No entries yet.</p>
              ) : helpRows.map((row) => <HelpCard key={row.id} row={row} onDelete={() => void removeHelp(row.id)} />)
            ) : (
              discoverRows.length === 0 ? (
                <p style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: "#9CA3AF" }}>No places yet.</p>
              ) : discoverRows.map((row) => <PlaceCard key={row.id} row={row} onDelete={() => void removeDiscover(row.id)} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}