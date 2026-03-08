import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle, Clock, Video, Flame,
  RefreshCw, Plus, X, Check, Shield,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import apiClient from "../../lib/api-client";
import { errorMessage, extractRows, formatDateTime, humanizeEnum, getPriorityColorClass, getStatusColorClass } from "../../lib/live-data";

// ─── Types ────────────────────────────────────────────────────

type Incident = {
  id: string; incidentNumber?: string; type: string; location?: string | null;
  residentName?: string | null; description: string; priority: string;
  status: string; responseTime?: string | null; reportedAt?: string; createdAt?: string;
  unit?: { unitNumber: string } | null;
};

type FireStatus = {
  active?: boolean; triggeredAt?: string | null;
  counters?: { totalRecipients: number; acknowledged: number; pending: number };
  pendingRecipients?: Array<{ userId: string; name?: string }>;
};

// ─── Design tokens ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB",
  fontSize: "13px", color: "#111827", background: "#FFF", outline: "none",
  fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px",
};
const textareaStyle: React.CSSProperties = { ...inputStyle, height: "auto", resize: "vertical" as const };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

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
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ color: "#9CA3AF" }}>{icon}</span>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>{label}</span>
    </div>
  );
}

// ─── Incident row ─────────────────────────────────────────────

function IncidentRow({ row }: { row: Incident }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto auto auto", alignItems: "center", gap: "12px", padding: "11px 14px", borderBottom: "1px solid #F9FAFB", transition: "background 100ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
      <span style={{ fontSize: "11px", fontFamily: "'DM Mono', monospace", color: "#9CA3AF", whiteSpace: "nowrap" }}>{row.incidentNumber ?? row.id.slice(0, 8)}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.type}</p>
        {row.description && <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: "1px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.description}</p>}
      </div>
      <span style={{ fontSize: "12px", color: "#6B7280", whiteSpace: "nowrap" }}>{row.location ?? row.unit?.unitNumber ?? "—"}</span>
      <span style={{ fontSize: "12px", color: "#374151", whiteSpace: "nowrap" }}>{row.residentName ?? "—"}</span>
      <span className={getPriorityColorClass(row.priority)} style={{ fontSize: "11.5px", fontWeight: 700, padding: "2px 7px", borderRadius: "5px", whiteSpace: "nowrap" }}>{humanizeEnum(row.priority)}</span>
      <StatusBadge value={row.status} />
      <span style={{ fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{row.responseTime ?? "—"}</span>
      <span style={{ fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{formatDateTime(row.reportedAt ?? row.createdAt ?? "")}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function SecurityEmergency() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cards, setCards] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fireStatus, setFireStatus] = useState<FireStatus | null>(null);

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportForm, setReportForm] = useState({ type: "", location: "", resident: "", description: "", priority: "MEDIUM" });

  // Fire dialog
  const [fireDialogOpen, setFireDialogOpen] = useState(false);
  const [fireTriggering, setFireTriggering] = useState(false);
  const [fireResolving, setFireResolving] = useState(false);
  const [fireMessageEn, setFireMessageEn] = useState("Emergency alarm triggered. Please evacuate immediately and confirm once you are safe.");
  const [fireMessageAr, setFireMessageAr] = useState("تم إطلاق إنذار الطوارئ. يرجى الإخلاء فورًا وتأكيد الوصول إلى مكان آمن.");

  const loadIncidents = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [cardsRes, listRes, fireRes] = await Promise.all([
        apiClient.get("/incidents/cards"),
        apiClient.get("/incidents/list", { params: { page: 1, limit: 100 } }),
        apiClient.get("/fire-evacuation/admin/status").catch(() => ({ data: null })),
      ]);
      setCards(cardsRes.data ?? {}); setIncidents(extractRows(listRes.data)); setFireStatus(fireRes?.data ?? null);
    } catch (e) { const msg = errorMessage(e); setLoadError(msg); toast.error("Failed to load incidents", { description: msg }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadIncidents(); }, [loadIncidents]);

  const handleReport = async () => {
    if (!reportForm.type || !reportForm.description || !reportForm.priority) { toast.error("Fill all required fields"); return; }
    setSubmitting(true);
    try {
      await apiClient.post("/incidents", { type: reportForm.type, location: reportForm.location || undefined, residentName: reportForm.resident || undefined, description: reportForm.description, priority: reportForm.priority });
      toast.success("Incident reported"); setReportOpen(false); setReportForm({ type: "", location: "", resident: "", description: "", priority: "MEDIUM" }); await loadIncidents();
    } catch (e) { toast.error("Failed to report", { description: errorMessage(e) }); }
    finally { setSubmitting(false); }
  };

  const triggerFire = async () => {
    setFireTriggering(true);
    try {
      const res = await apiClient.post("/fire-evacuation/admin/trigger", { messageEn: fireMessageEn, messageAr: fireMessageAr });
      setFireStatus(res.data ?? null); setFireDialogOpen(false); toast.success("Emergency alarm triggered — notifications sent to all residents");
    } catch (e) { toast.error("Failed to trigger", { description: errorMessage(e) }); }
    finally { setFireTriggering(false); }
  };

  const resolveFire = async () => {
    setFireResolving(true);
    try {
      const res = await apiClient.post("/fire-evacuation/admin/resolve", { note: "Evacuation alert closed by admin" });
      setFireStatus(res.data ?? null); toast.success("Emergency alarm resolved");
    } catch (e) { toast.error("Failed to resolve", { description: errorMessage(e) }); }
    finally { setFireResolving(false); }
  };

  const activeIncidents = Number(cards?.activeIncidents ?? 0);
  const resolvedToday = Number(cards?.incidentsResolvedToday ?? 0);
  const avgResponse = Number(cards?.averageResponseTime ?? 0);
  const totalCameras = Number(cards?.totalCCTVCameras ?? 0);

  const fireActive = !!fireStatus?.active;

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* ── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Emergency & Safety</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Live incident monitoring and emergency reporting.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={() => void loadIncidents()} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", background: "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw style={{ width: "13px", height: "13px", animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          <button type="button" onClick={() => setReportOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "#DC2626", color: "#FFF", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 2px 6px rgba(220,38,38,0.3)" }}>
            <AlertTriangle style={{ width: "13px", height: "13px" }} /> Report Incident
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: "12px 14px", borderRadius: "8px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: "13px", marginBottom: "16px" }}>{loadError}</div>
      )}

      {/* ── Stats ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <StatCard title="Active Incidents" value={String(activeIncidents)} icon="complaints-open" />
        <StatCard title="Resolved Today" value={String(resolvedToday)} icon="active-users" />
        <StatCard title="Avg Response" value={`${avgResponse}m`} icon="tickets" />
        <StatCard title="CCTV Cameras" value={String(totalCameras)} icon="devices" />
      </div>

      {/* ── Emergency Alarm panel ─── */}
      <div style={{
        borderRadius: "10px", border: `1px solid ${fireActive ? "#FECACA" : "#EBEBEB"}`,
        background: fireActive ? "linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)" : "#FFF",
        padding: "16px", marginBottom: "16px", transition: "all 300ms ease",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
              <Flame style={{ width: "16px", height: "16px", color: fireActive ? "#DC2626" : "#9CA3AF" }} />
              <span style={{ fontSize: "13px", fontWeight: 800, color: fireActive ? "#7F1D1D" : "#111827" }}>Emergency Alarm</span>
              <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px", background: fireActive ? "#DC2626" : "#F3F4F6", color: fireActive ? "#FFF" : "#9CA3AF", fontFamily: "'Work Sans', sans-serif" }}>
                {fireActive ? "ACTIVE ALARM" : "Standby"}
              </span>
            </div>
            <p style={{ fontSize: "12.5px", color: fireActive ? "#991B1B" : "#6B7280", margin: 0 }}>Trigger emergency alarm for all residents and track acknowledgements in real time.</p>
            {fireStatus?.triggeredAt && <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: "4px 0 0", fontFamily: "'DM Mono', monospace" }}>Last: {formatDateTime(fireStatus.triggeredAt)}</p>}
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setFireDialogOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "8px", background: "#DC2626", color: "#FFF", border: "2px solid #B91C1C", cursor: "pointer", fontSize: "13px", fontWeight: 800, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 3px 8px rgba(220,38,38,0.4)", letterSpacing: "0.02em", transition: "all 150ms ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#B91C1C"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(185,28,28,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#DC2626"; e.currentTarget.style.boxShadow = "0 3px 8px rgba(220,38,38,0.4)"; }}>
              <Flame style={{ width: "14px", height: "14px" }} /> Trigger Alarm
            </button>
            <button type="button" onClick={() => void resolveFire()} disabled={!fireActive || fireResolving}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "7px", background: "#FFF", color: "#B91C1C", border: "1px solid #FECACA", cursor: !fireActive || fireResolving ? "not-allowed" : "pointer", fontSize: "12.5px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: !fireActive || fireResolving ? 0.5 : 1 }}>
              <CheckCircle style={{ width: "12px", height: "12px" }} /> {fireResolving ? "Resolving…" : "Mark All Clear"}
            </button>
          </div>
        </div>

        {/* Fire counters */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "14px" }}>
          <div style={{ padding: "10px 12px", borderRadius: "7px", border: "1px solid #FECACA", background: "#FFF" }}>
            <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#7F1D1D", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Targeted</p>
            <p style={{ fontSize: "20px", fontWeight: 900, color: "#7F1D1D", margin: 0, fontFamily: "'DM Mono', monospace" }}>{Number(fireStatus?.counters?.totalRecipients ?? 0)}</p>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: "7px", border: "1px solid #A7F3D0", background: "#FFF" }}>
            <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Confirmed</p>
            <p style={{ fontSize: "20px", fontWeight: 900, color: "#059669", margin: 0, fontFamily: "'DM Mono', monospace" }}>{Number(fireStatus?.counters?.acknowledged ?? 0)}</p>
          </div>
          <div style={{ padding: "10px 12px", borderRadius: "7px", border: "1px solid #FDE68A", background: "#FFF" }}>
            <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 3px" }}>Pending</p>
            <p style={{ fontSize: "20px", fontWeight: 900, color: "#D97706", margin: 0, fontFamily: "'DM Mono', monospace" }}>{Number(fireStatus?.counters?.pending ?? 0)}</p>
          </div>
        </div>

        {/* Pending residents */}
        {Array.isArray(fireStatus?.pendingRecipients) && fireStatus!.pendingRecipients.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#7F1D1D", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Pending confirmations</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {fireStatus!.pendingRecipients.slice(0, 12).map((r) => (
                <span key={r.userId} style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#FEE2E2", color: "#991B1B" }}>{r.name ?? r.userId}</span>
              ))}
              {fireStatus!.pendingRecipients.length > 12 && (
                <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "#F3F4F6", color: "#6B7280" }}>+{fireStatus!.pendingRecipients.length - 12} more</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Incidents table ─── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "6px" }}>
          <Shield style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#374151" }}>Emergency Incidents</span>
          <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", background: "#F3F4F6", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", marginLeft: "2px" }}>{incidents.length}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto auto auto", gap: "12px", padding: "9px 14px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
          {["ID", "Type / Description", "Location", "Resident", "Priority", "Status", "Response", "Reported"].map((h) => (
            <span key={h} style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif", whiteSpace: "nowrap" }}>{h}</span>
          ))}
        </div>
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: "54px", margin: "6px 10px", borderRadius: "7px", background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%" }} />)
        ) : incidents.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Shield style={{ width: "28px", height: "28px", color: "#E5E7EB", margin: "0 auto 8px" }} />
            <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No incidents found</p>
          </div>
        ) : incidents.map((row) => <IncidentRow key={row.id} row={row} />)}
      </div>

      {/* ══ Report incident dialog ════════════════════════════════ */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent style={{ maxWidth: "480px", padding: 0, borderRadius: "12px", overflow: "hidden", border: "1px solid #EBEBEB", fontFamily: "'Work Sans', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "3px", background: "linear-gradient(90deg, #DC2626, #F97316)", flexShrink: 0 }} />
          <div style={{ padding: "18px 24px 10px", flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: 0 }}>Report Emergency Incident</DialogTitle>
              <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Creates a real incident record.</p>
            </DialogHeader>
          </div>
          <div style={{ overflowY: "auto", padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <SectionLabel icon={<AlertTriangle style={{ width: "12px", height: "12px" }} />} label="Incident Details" />
            <Field label="Incident Type" required>
              <input value={reportForm.type} onChange={(e) => setReportForm((p) => ({ ...p, type: e.target.value }))} placeholder="e.g. Security Breach, Medical Emergency…" style={inputStyle} />
            </Field>
            <Field label="Location">
              <input value={reportForm.location} onChange={(e) => setReportForm((p) => ({ ...p, location: e.target.value }))} placeholder="e.g. Block C – Main Entrance" style={inputStyle} />
            </Field>
            <Field label="Resident Name">
              <input value={reportForm.resident} onChange={(e) => setReportForm((p) => ({ ...p, resident: e.target.value }))} placeholder="Resident involved (optional)" style={inputStyle} />
            </Field>
            <Field label="Priority" required>
              <select value={reportForm.priority} onChange={(e) => setReportForm((p) => ({ ...p, priority: e.target.value }))} style={selectStyle}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </Field>
            <Field label="Description" required>
              <textarea value={reportForm.description} onChange={(e) => setReportForm((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Describe the incident…" style={textareaStyle} />
            </Field>
          </div>
          <div style={{ padding: "12px 24px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0, background: "#FFF" }}>
            <button type="button" onClick={() => setReportOpen(false)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: "12px", height: "12px" }} /> Cancel
            </button>
            <button type="button" onClick={() => void handleReport()} disabled={submitting}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 20px", borderRadius: "7px", background: submitting ? "#9CA3AF" : "#DC2626", color: "#FFF", border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
              <Check style={{ width: "13px", height: "13px" }} />
              {submitting ? "Reporting…" : "Report Now"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ Emergency alarm dialog ════════════════════════════════ */}
      <Dialog open={fireDialogOpen} onOpenChange={setFireDialogOpen}>
        <DialogContent style={{ maxWidth: "520px", padding: 0, borderRadius: "12px", overflow: "hidden", border: "1px solid #FECACA", fontFamily: "'Work Sans', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "3px", background: "linear-gradient(90deg, #B91C1C, #DC2626)", flexShrink: 0 }} />
          <div style={{ padding: "18px 24px 10px", flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: "15px", fontWeight: 800, color: "#7F1D1D", margin: 0 }}>Trigger Emergency Alarm</DialogTitle>
              <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>Sends emergency alarm to all active residents via in-app notification and push.</p>
            </DialogHeader>
          </div>
          <div style={{ overflowY: "auto", padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <Field label="English Message">
              <textarea value={fireMessageEn} onChange={(e) => setFireMessageEn(e.target.value)} rows={3} style={textareaStyle} />
            </Field>
            <Field label="Arabic Message">
              <textarea value={fireMessageAr} onChange={(e) => setFireMessageAr(e.target.value)} rows={3} style={{ ...textareaStyle, direction: "rtl" }} />
            </Field>
          </div>
          <div style={{ padding: "12px 24px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0, background: "#FFF" }}>
            <button type="button" onClick={() => setFireDialogOpen(false)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: "12px", height: "12px" }} /> Cancel
            </button>
            <button type="button" onClick={() => void triggerFire()} disabled={fireTriggering}
              style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 20px", borderRadius: "7px", background: fireTriggering ? "#9CA3AF" : "#B91C1C", color: "#FFF", border: "none", cursor: fireTriggering ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 2px 5px rgba(185,28,28,0.3)" }}>
              <Flame style={{ width: "13px", height: "13px" }} />
              {fireTriggering ? "Sending…" : "Send Alarm"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}