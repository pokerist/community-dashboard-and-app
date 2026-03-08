import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Search, Eye, ArrowUp, ArrowDown, Trash2,
  BarChart2, ClipboardList, ChevronDown, SlidersHorizontal, Check, X,
} from "lucide-react";
import { SurveyFieldType, SurveyStatus, SurveyTarget } from "@prisma/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { StatCard } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import surveyService, {
  type CommunityOption,
  type SurveyAnalytics,
  type SurveyDetail,
  type SurveyListItem,
  type SurveyQuestionAnalytics,
  type UnitOption,
} from "../../lib/surveyService";

// ─── Types ────────────────────────────────────────────────────

type Tab = "surveys" | "analytics";

type QuestionForm = {
  localId: string; id?: string; text: string; type: SurveyFieldType;
  required: boolean; displayOrder: number; choices: string[];
};

type SurveyForm = {
  title: string; description: string; targetType: SurveyTarget;
  communityIds: string[]; unitIds: string[]; questions: QuestionForm[];
};

// ─── Helpers ──────────────────────────────────────────────────

const createQuestion = (displayOrder: number): QuestionForm => ({
  localId: `q-${Date.now()}-${displayOrder}`, text: "", type: SurveyFieldType.TEXT,
  required: true, displayOrder, choices: ["", ""],
});
const createEmptyForm = (): SurveyForm => ({
  title: "", description: "", targetType: SurveyTarget.ALL,
  communityIds: [], unitIds: [], questions: [createQuestion(0)],
});
const formatDate = (v: string | null): string => v ? new Date(v).toLocaleDateString() : "—";
const titleCase = (v: string): string => v.toLowerCase().split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
const targetLabel = (t: SurveyTarget): string => ({ SPECIFIC_COMMUNITIES: "Specific Communities", SPECIFIC_UNITS: "Specific Units", ALL: "All" }[t] ?? "All");

const isText = (q: SurveyQuestionAnalytics): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.TEXT; textAnswers: string[]; totalTextAnswers: number } => q.type === SurveyFieldType.TEXT;
const isMc = (q: SurveyQuestionAnalytics): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.MULTIPLE_CHOICE; options: Array<{ choice: string; percentage: number; count: number }> } => q.type === SurveyFieldType.MULTIPLE_CHOICE;
const isRating = (q: SurveyQuestionAnalytics): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.RATING; avg: number; distribution: Record<1|2|3|4|5, number> } => q.type === SurveyFieldType.RATING;
const isYesNo = (q: SurveyQuestionAnalytics): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.YES_NO; yes: number; no: number } => q.type === SurveyFieldType.YES_NO;

// ─── Design tokens ────────────────────────────────────────────

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #E5E7EB", fontSize: "13px", color: "#111827", background: "#FFF", outline: "none", fontFamily: "'Work Sans', sans-serif", boxSizing: "border-box", height: "36px" };
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };
const textareaStyle: React.CSSProperties = { ...inputStyle, height: "auto", resize: "vertical" as const };

// ─── Primitives ───────────────────────────────────────────────

function Field({ label, required, children, span2 }: { label: string; required?: boolean; children: React.ReactNode; span2?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", gridColumn: span2 ? "span 2" : undefined }}>
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

// ─── Survey row ───────────────────────────────────────────────

function SurveyRow({ row, onView, onPublish, onClose, onDelete, onAnalytics }: {
  row: SurveyListItem; onView: () => void; onPublish?: () => void;
  onClose?: () => void; onDelete?: () => void; onAnalytics: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto auto", alignItems: "center", gap: "12px", padding: "11px 14px", borderBottom: "1px solid #F9FAFB", transition: "background 100ms" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</p>
        <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: "2px 0 0" }}>{targetLabel(row.targetType)}</p>
      </div>
      <span style={{ fontSize: "12px", fontFamily: "'DM Mono', monospace", color: "#6B7280", whiteSpace: "nowrap" }}>{row.questionCount}q</span>
      <span style={{ fontSize: "12px", fontFamily: "'DM Mono', monospace", color: "#6B7280", whiteSpace: "nowrap" }}>{row.responseCount}r</span>
      <StatusBadge value={row.status} />
      <span style={{ fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>{formatDate(row.publishedAt)}</span>
      <div style={{ display: "flex", gap: "4px" }}>
        <button type="button" onClick={onView}
          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280", transition: "all 120ms ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#111827"; e.currentTarget.style.color = "#FFF"; e.currentTarget.style.borderColor = "#111827"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
          <Eye style={{ width: "11px", height: "11px" }} />
        </button>
        <button type="button" onClick={onAnalytics}
          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6B7280", transition: "all 120ms ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#2563EB"; e.currentTarget.style.color = "#FFF"; e.currentTarget.style.borderColor = "#2563EB"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#6B7280"; e.currentTarget.style.borderColor = "#E5E7EB"; }}>
          <BarChart2 style={{ width: "11px", height: "11px" }} />
        </button>
        {onPublish && (
          <button type="button" onClick={onPublish}
            style={{ padding: "0 8px", height: "28px", borderRadius: "6px", border: "1px solid #BFDBFE", background: "#EFF6FF", cursor: "pointer", fontSize: "11.5px", fontWeight: 600, color: "#2563EB", fontFamily: "'Work Sans', sans-serif", transition: "all 120ms ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#2563EB"; e.currentTarget.style.color = "#FFF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.color = "#2563EB"; }}>
            Publish
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose}
            style={{ padding: "0 8px", height: "28px", borderRadius: "6px", border: "1px solid #FDE68A", background: "#FFFBEB", cursor: "pointer", fontSize: "11.5px", fontWeight: 600, color: "#D97706", fontFamily: "'Work Sans', sans-serif" }}>
            Close
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete}
            style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#DC2626", transition: "all 120ms ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#DC2626"; e.currentTarget.style.color = "#FFF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF5F5"; e.currentTarget.style.color = "#DC2626"; }}>
            <Trash2 style={{ width: "10px", height: "10px" }} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Analytics question card ──────────────────────────────────

function QuestionAnalyticsCard({ q, index, expanded, onToggleExpand }: {
  q: SurveyQuestionAnalytics; index: number; expanded: boolean; onToggleExpand: () => void;
}) {
  return (
    <div style={{ borderRadius: "9px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div>
          <p style={{ fontSize: "10.5px", color: "#9CA3AF", margin: "0 0 3px", fontFamily: "'Work Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Q{index + 1} · {titleCase(q.type)}</p>
          <p style={{ fontSize: "13.5px", fontWeight: 600, color: "#111827", margin: 0 }}>{q.questionText}</p>
        </div>
        <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "5px", background: "#F3F4F6", color: "#6B7280", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{q.answerCount} answers</span>
      </div>
      <div style={{ padding: "14px 16px" }}>
        {isText(q) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {(expanded ? q.textAnswers : q.textAnswers.slice(0, 5)).map((a, i) => (
              <div key={i} style={{ padding: "8px 12px", borderRadius: "6px", background: "#F9FAFB", fontSize: "12.5px", color: "#374151", border: "1px solid #F3F4F6" }}>{a}</div>
            ))}
            {q.totalTextAnswers > 5 && (
              <button type="button" onClick={onToggleExpand} style={{ fontSize: "11.5px", color: "#2563EB", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Work Sans', sans-serif", padding: 0 }}>
                {expanded ? "Show fewer" : `View all ${q.totalTextAnswers} answers`}
              </button>
            )}
          </div>
        )}
        {isMc(q) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {q.options.map((opt) => (
              <div key={opt.choice} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "120px", fontSize: "12px", color: "#6B7280", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.choice}</span>
                <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "#F3F4F6", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "3px", background: "#2563EB", width: `${Math.min(opt.percentage, 100)}%`, transition: "width 600ms ease" }} />
                </div>
                <span style={{ width: "80px", textAlign: "right", fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{opt.count} ({opt.percentage.toFixed(1)}%)</span>
              </div>
            ))}
          </div>
        )}
        {isRating(q) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ fontSize: "28px", fontWeight: 900, color: "#111827", margin: "0 0 8px", fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{q.avg.toFixed(1)}<span style={{ fontSize: "13px", color: "#9CA3AF", fontWeight: 400 }}> / 5</span></p>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = q.distribution[star as 1|2|3|4|5];
              const pct = q.answerCount > 0 ? (count / q.answerCount) * 100 : 0;
              const color = star >= 4 ? "#059669" : star <= 2 ? "#DC2626" : "#2563EB";
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "20px", fontSize: "12px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{star}★</span>
                  <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "#F3F4F6", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "3px", background: color, width: `${Math.min(pct, 100)}%`, transition: "width 600ms ease" }} />
                  </div>
                  <span style={{ width: "24px", textAlign: "right", fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{count}</span>
                </div>
              );
            })}
          </div>
        )}
        {isYesNo(q) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ padding: "14px 16px", borderRadius: "8px", border: "1px solid #A7F3D0", background: "#ECFDF5" }}>
              <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Yes</p>
              <p style={{ fontSize: "22px", fontWeight: 900, color: "#059669", margin: "0", fontFamily: "'DM Mono', monospace" }}>{q.yes}</p>
              <p style={{ fontSize: "11px", color: "#6EE7B7", margin: "3px 0 0" }}>{q.answerCount > 0 ? `${((q.yes / q.answerCount) * 100).toFixed(1)}%` : "0%"}</p>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: "8px", border: "1px solid #FECACA", background: "#FEF2F2" }}>
              <p style={{ fontSize: "10.5px", fontWeight: 700, color: "#7F1D1D", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>No</p>
              <p style={{ fontSize: "22px", fontWeight: 900, color: "#DC2626", margin: "0", fontFamily: "'DM Mono', monospace" }}>{q.no}</p>
              <p style={{ fontSize: "11px", color: "#FCA5A5", margin: "3px 0 0" }}>{q.answerCount > 0 ? `${((q.no / q.answerCount) * 100).toFixed(1)}%` : "0%"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function SurveysManagement() {
  const [tab, setTab] = useState<Tab>("surveys");
  const [stats, setStats] = useState<{ total: number; active: number; totalResponses: number; avgResponseRate: number } | null>(null);
  const [rows, setRows] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [form, setForm] = useState<SurveyForm>(createEmptyForm);

  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitSearch, setUnitSearch] = useState("");
  const [communitySearch, setCommunitySearch] = useState("");

  const [analyticsSurveyId, setAnalyticsSurveyId] = useState("");
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [analyticsDetail, setAnalyticsDetail] = useState<SurveyDetail | null>(null);
  const [expandedText, setExpandedText] = useState<Set<string>>(new Set());

  const filteredCommunities = useMemo(() => {
    const q = communitySearch.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q));
  }, [communitySearch, communities]);

  const sortedCommunities = useMemo(() => {
    return [...filteredCommunities].sort((a, b) => {
      const aSelected = form.communityIds.includes(a.id) ? 0 : 1;
      const bSelected = form.communityIds.includes(b.id) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [filteredCommunities, form.communityIds]);

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    return q ? units.filter((u) => `${u.unitNumber} ${u.block ?? ""}`.toLowerCase().includes(q)) : units;
  }, [unitSearch, units]);

  const sortedUnits = useMemo(() => {
    return [...filteredUnits].sort((a, b) => {
      const aSelected = form.unitIds.includes(a.id) ? 0 : 1;
      const bSelected = form.unitIds.includes(b.id) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [filteredUnits, form.unitIds]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        surveyService.getSurveyStats(),
        surveyService.listSurveys({ status: status === "ALL" ? undefined : (status as SurveyStatus), search: search.trim() || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, limit: 100 }),
      ]);
      setStats({ total: s.total, active: s.active, totalResponses: s.totalResponses, avgResponseRate: s.avgResponseRate });
      setRows(list.data);
    } catch { toast.error("Failed to load surveys"); }
    finally { setLoading(false); }
  }, [status, search, dateFrom, dateTo]);

  useEffect(() => { void loadRows(); }, [loadRows]);

  useEffect(() => {
    const t = window.setTimeout(() => void loadRows(), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void Promise.all([surveyService.listCommunityOptions(), surveyService.listUnitOptions()])
      .then(([cs, us]) => { setCommunities(cs); setUnits(us); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!analyticsSurveyId) { setAnalytics(null); setAnalyticsDetail(null); return; }
    Promise.all([surveyService.getSurveyAnalytics(analyticsSurveyId), surveyService.getSurveyDetail(analyticsSurveyId)])
      .then(([a, d]) => { setAnalytics(a); setAnalyticsDetail(d); })
      .catch(() => toast.error("Failed to load analytics"));
  }, [analyticsSurveyId]);

  const openCreate = () => { setEditingId(null); setReadOnly(false); setForm(createEmptyForm()); setDialogOpen(true); };
  const openDetail = async (id: string) => {
    try {
      const d = await surveyService.getSurveyDetail(id);
      setEditingId(id); setReadOnly(d.status !== SurveyStatus.DRAFT);
      setForm({ title: d.title, description: d.description ?? "", targetType: d.targetType, communityIds: d.targetMeta?.communityIds ?? [], unitIds: d.targetMeta?.unitIds ?? [], questions: d.questions.slice().sort((a, b) => a.displayOrder - b.displayOrder).map((q, i) => ({ localId: q.id, id: q.id, text: q.text, type: q.type, required: q.required, displayOrder: i, choices: q.type === SurveyFieldType.MULTIPLE_CHOICE ? q.options?.choices ?? ["", ""] : ["", ""] })) });
      setDialogOpen(true);
    } catch { toast.error("Failed to load survey"); }
  };

  const publishSurvey = async (id: string) => { try { await surveyService.publishSurvey(id); toast.success("Survey published — notification sent to all targeted residents"); await loadRows(); } catch { toast.error("Failed to publish"); } };
  const closeSurvey = async (id: string) => { try { await surveyService.closeSurvey(id); toast.success("Survey closed"); await loadRows(); } catch { toast.error("Failed to close"); } };
  const deleteSurvey = async (id: string) => { try { await surveyService.deleteSurvey(id); if (analyticsSurveyId === id) setAnalyticsSurveyId(""); toast.success("Survey deleted"); await loadRows(); } catch { toast.error("Failed to delete"); } };

  const setQuestion = (localId: string, updater: (q: QuestionForm) => QuestionForm) => setForm((p) => ({ ...p, questions: p.questions.map((q) => q.localId === localId ? updater(q) : q) }));
  const reindex = (qs: QuestionForm[]) => qs.map((q, i) => ({ ...q, displayOrder: i }));
  const moveQuestion = (localId: string, dir: "up" | "down") => setForm((p) => {
    const i = p.questions.findIndex((q) => q.localId === localId); if (i < 0) return p;
    const j = dir === "up" ? i - 1 : i + 1; if (j < 0 || j >= p.questions.length) return p;
    const n = [...p.questions]; const t = n[i]; n[i] = n[j]; n[j] = t; return { ...p, questions: reindex(n) };
  });

  const submitSurvey = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.questions.length) { toast.error("At least one question required"); return; }
    try {
      const questions = form.questions.map((q, i) => {
        const text = q.text.trim(); if (!text) throw new Error(`Question ${i + 1} is empty`);
        if (q.type === SurveyFieldType.MULTIPLE_CHOICE) { const choices = q.choices.map((c) => c.trim()).filter(Boolean); if (choices.length < 2) throw new Error(`Question ${i + 1} needs ≥2 choices`); return { id: q.id, text, type: q.type, required: q.required, displayOrder: i, options: { choices } }; }
        return { id: q.id, text, type: q.type, required: q.required, displayOrder: i };
      });
      const targetMeta = form.targetType === SurveyTarget.SPECIFIC_COMMUNITIES ? { communityIds: form.communityIds } : form.targetType === SurveyTarget.SPECIFIC_UNITS ? { unitIds: form.unitIds } : undefined;
      if (editingId) await surveyService.updateSurvey(editingId, { title: form.title.trim(), description: form.description.trim() || undefined, targetType: form.targetType, targetMeta, questions });
      else await surveyService.createSurvey({ title: form.title.trim(), description: form.description.trim() || undefined, targetType: form.targetType, targetMeta, questions });
      toast.success("Survey saved"); setDialogOpen(false); await loadRows();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save"); }
  };

  const activeFilters = [status !== "ALL", dateFrom, dateTo].filter(Boolean).length;

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* ── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Survey Center</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Create surveys and inspect response analytics.</p>
        </div>
        <button type="button" onClick={openCreate}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "#111827", color: "#FFF", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
          <Plus style={{ width: "13px", height: "13px" }} /> Create Survey
        </button>
      </div>

      {/* ── Stats ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <StatCard icon="tickets" title="Total Surveys" value={String(stats?.total ?? 0)} />
        <StatCard icon="active-users" title="Active" value={String(stats?.active ?? 0)} />
        <StatCard icon="complaints-total" title="Total Responses" value={String(stats?.totalResponses ?? 0)} />
        <StatCard icon="revenue" title="Avg Response Rate" value={`${(stats?.avgResponseRate ?? 0).toFixed(1)}%`} />
      </div>

      {/* ── Tabs ─── */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "14px", padding: "4px", borderRadius: "9px", border: "1px solid #EBEBEB", background: "#FAFAFA", width: "fit-content" }}>
        {(["surveys", "analytics"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ padding: "6px 16px", borderRadius: "6px", fontSize: "12.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", cursor: "pointer", border: "none", background: tab === t ? "#FFF" : "transparent", color: tab === t ? "#111827" : "#6B7280", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 120ms ease" }}>
            {t === "surveys" ? "Surveys" : "Analytics"}
          </button>
        ))}
      </div>

      {tab === "surveys" ? (
        <>
          {/* Filter bar */}
          <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: filtersOpen ? "1px solid #F3F4F6" : "none" }}>
              <Search style={{ width: "13px", height: "13px", color: "#9CA3AF", flexShrink: 0 }} />
              <input placeholder="Search surveys…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "13px", color: "#111827", fontFamily: "'Work Sans', sans-serif" }} />
              <button type="button" onClick={() => setFiltersOpen((p) => !p)}
                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: `1px solid ${activeFilters > 0 ? "#2563EB40" : "#E5E7EB"}`, background: activeFilters > 0 ? "#EFF6FF" : "#FAFAFA", color: activeFilters > 0 ? "#2563EB" : "#6B7280", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "'Work Sans', sans-serif" }}>
                <SlidersHorizontal style={{ width: "11px", height: "11px" }} />
                Filters
                {activeFilters > 0 && <span style={{ width: "15px", height: "15px", borderRadius: "50%", background: "#2563EB", color: "#FFF", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeFilters}</span>}
                <ChevronDown style={{ width: "10px", height: "10px", transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
              </button>
            </div>
            {filtersOpen && (
              <div style={{ padding: "10px 14px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...selectStyle, width: "140px" }}>
                  <option value="ALL">All Statuses</option>
                  <option value={SurveyStatus.DRAFT}>Draft</option>
                  <option value={SurveyStatus.ACTIVE}>Active</option>
                  <option value={SurveyStatus.CLOSED}>Closed</option>
                </select>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputStyle, width: "140px" }} />
                <span style={{ fontSize: "11.5px", color: "#9CA3AF" }}>to</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputStyle, width: "140px" }} />
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", gap: "12px", padding: "9px 14px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA" }}>
              {["Survey", "Questions", "Responses", "Status", "Published", "Actions"].map((h) => (
                <span key={h} style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Work Sans', sans-serif" }}>{h}</span>
              ))}
            </div>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: "54px", margin: "6px 10px", borderRadius: "7px", background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%" }} />)
            ) : rows.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <ClipboardList style={{ width: "28px", height: "28px", color: "#E5E7EB", margin: "0 auto 8px" }} />
                <p style={{ fontSize: "13px", color: "#9CA3AF" }}>No surveys found</p>
              </div>
            ) : rows.map((row) => (
              <SurveyRow key={row.id} row={row}
                onView={() => void openDetail(row.id)}
                onAnalytics={() => { setTab("analytics"); setAnalyticsSurveyId(row.id); }}
                onPublish={row.status === SurveyStatus.DRAFT ? () => void publishSurvey(row.id) : undefined}
                onClose={row.status === SurveyStatus.ACTIVE ? () => void closeSurvey(row.id) : undefined}
                onDelete={row.status !== SurveyStatus.ACTIVE ? () => void deleteSurvey(row.id) : undefined}
              />
            ))}
          </div>
        </>
      ) : (
        /* Analytics tab */
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", padding: "14px 16px" }}>
            <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "6px" }}>Survey Selector</label>
            <select value={analyticsSurveyId} onChange={(e) => setAnalyticsSurveyId(e.target.value)} style={{ ...selectStyle, maxWidth: "400px" }}>
              <option value="">Select a survey…</option>
              {rows.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>

          {!analytics || !analyticsDetail ? (
            <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", padding: "40px", textAlign: "center" }}>
              <BarChart2 style={{ width: "28px", height: "28px", color: "#E5E7EB", margin: "0 auto 8px" }} />
              <p style={{ fontSize: "13px", color: "#9CA3AF" }}>Select a survey to view analytics</p>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                <StatCard icon="tickets" title="Total Responses" value={String(analytics.totalResponses)} />
                <StatCard icon="active-users" title="Completion Rate" value={`${analytics.completionRate.toFixed(1)}%`} />
                <StatCard icon="devices" title="Published" value={formatDate(analyticsDetail.publishedAt)} />
              </div>
              {analytics.questions.slice().sort((a, b) => a.displayOrder - b.displayOrder).map((q, i) => (
                <QuestionAnalyticsCard key={q.questionId} q={q} index={i} expanded={expandedText.has(q.questionId)}
                  onToggleExpand={() => setExpandedText((p) => { const n = new Set(p); n.has(q.questionId) ? n.delete(q.questionId) : n.add(q.questionId); return n; })} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ══ Survey dialog ════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: "600px", padding: 0, borderRadius: "12px", overflow: "hidden", border: "1px solid #EBEBEB", fontFamily: "'Work Sans', sans-serif", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "3px", background: editingId ? "linear-gradient(90deg, #2563EB, #0D9488)" : "linear-gradient(90deg, #0D9488, #BE185D)", flexShrink: 0 }} />
          <div style={{ padding: "18px 24px 10px", flexShrink: 0 }}>
            <DialogHeader>
              <DialogTitle style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: 0 }}>
                {editingId ? (readOnly ? "Survey Detail" : "Edit Survey") : "Create Survey"}
              </DialogTitle>
              <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "3px" }}>{readOnly ? "This survey is published and cannot be edited." : "Fill in the survey details and questions. An in-app notification will be sent to targeted residents when published."}</p>
            </DialogHeader>
          </div>

          <div style={{ overflowY: "auto", padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Info */}
            <div>
              <SectionLabel icon={<ClipboardList style={{ width: "12px", height: "12px" }} />} label="Survey Info" />
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Field label="Title" required>
                  <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} disabled={readOnly} placeholder="e.g. Resident Satisfaction Q3" style={{ ...inputStyle, opacity: readOnly ? 0.6 : 1 }} />
                </Field>
                <Field label="Description">
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} disabled={readOnly} rows={2} style={{ ...textareaStyle, opacity: readOnly ? 0.6 : 1 }} />
                </Field>
                <Field label="Target Audience">
                  <select value={form.targetType} onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value as SurveyTarget }))} disabled={readOnly} style={{ ...selectStyle, opacity: readOnly ? 0.6 : 1 }}>
                    <option value={SurveyTarget.ALL}>All Residents</option>
                    <option value={SurveyTarget.SPECIFIC_COMMUNITIES}>Specific Communities</option>
                    <option value={SurveyTarget.SPECIFIC_UNITS}>Specific Units</option>
                  </select>
                </Field>
                {form.targetType === SurveyTarget.SPECIFIC_COMMUNITIES && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input value={communitySearch} onChange={(e) => setCommunitySearch(e.target.value)} disabled={readOnly} placeholder="Search community…" style={inputStyle} />
                    <div style={{ maxHeight: "160px", overflowY: "auto", borderRadius: "7px", border: "1px solid #E5E7EB", padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      {sortedCommunities.map((c) => (
                        <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 6px", borderRadius: "5px", fontSize: "12.5px", color: "#374151", cursor: "pointer", background: form.communityIds.includes(c.id) ? "#EFF6FF" : "transparent", border: form.communityIds.includes(c.id) ? "1px solid #BFDBFE" : "1px solid transparent", transition: "all 100ms" }}>
                          <input type="checkbox" disabled={readOnly} checked={form.communityIds.includes(c.id)} onChange={() => setForm((p) => ({ ...p, communityIds: p.communityIds.includes(c.id) ? p.communityIds.filter((id) => id !== c.id) : [...p.communityIds, c.id] }))} />
                          {c.name}
                        </label>
                      ))}
                      {sortedCommunities.length === 0 && <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "8px 0", textAlign: "center" }}>No communities found</p>}
                    </div>
                  </div>
                )}
                {form.targetType === SurveyTarget.SPECIFIC_UNITS && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} disabled={readOnly} placeholder="Search unit or block…" style={inputStyle} />
                    <div style={{ maxHeight: "160px", overflowY: "auto", borderRadius: "7px", border: "1px solid #E5E7EB", padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      {sortedUnits.map((u) => (
                        <label key={u.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 6px", borderRadius: "5px", fontSize: "12.5px", color: "#374151", cursor: "pointer", background: form.unitIds.includes(u.id) ? "#EFF6FF" : "transparent", border: form.unitIds.includes(u.id) ? "1px solid #BFDBFE" : "1px solid transparent", transition: "all 100ms" }}>
                          <input type="checkbox" disabled={readOnly} checked={form.unitIds.includes(u.id)} onChange={() => setForm((p) => ({ ...p, unitIds: p.unitIds.includes(u.id) ? p.unitIds.filter((id) => id !== u.id) : [...p.unitIds, u.id] }))} />
                          {u.unitNumber}{u.block ? ` · ${u.block}` : ""}
                        </label>
                      ))}
                      {sortedUnits.length === 0 && <p style={{ fontSize: "12px", color: "#9CA3AF", margin: "8px 0", textAlign: "center" }}>No units found</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Questions */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ClipboardList style={{ width: "12px", height: "12px", color: "#9CA3AF" }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Questions</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px", background: "#F3F4F6", color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>{form.questions.length}</span>
                </div>
                {!readOnly && (
                  <button type="button" onClick={() => setForm((p) => ({ ...p, questions: [...p.questions, createQuestion(p.questions.length)] }))}
                    style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 600, color: "#2563EB", background: "none", border: "none", cursor: "pointer", fontFamily: "'Work Sans', sans-serif" }}>
                    <Plus style={{ width: "11px", height: "11px" }} /> Add Question
                  </button>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {form.questions.map((q, idx) => (
                  <div key={q.localId} style={{ borderRadius: "8px", border: "1px solid #E5E7EB", background: "#FAFAFA", padding: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>Q{idx + 1}</span>
                      {!readOnly && (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <button type="button" onClick={() => moveQuestion(q.localId, "up")} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #E5E7EB", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9CA3AF" }}><ArrowUp style={{ width: "10px", height: "10px" }} /></button>
                          <button type="button" onClick={() => moveQuestion(q.localId, "down")} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #E5E7EB", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9CA3AF" }}><ArrowDown style={{ width: "10px", height: "10px" }} /></button>
                          <button type="button" onClick={() => setForm((p) => { if (p.questions.length <= 1) { toast.error("At least one question required"); return p; } return { ...p, questions: reindex(p.questions.filter((item) => item.localId !== q.localId)) }; })} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #FECACA", background: "#FFF5F5", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#DC2626" }}><Trash2 style={{ width: "10px", height: "10px" }} /></button>
                        </div>
                      )}
                    </div>
                    <input value={q.text} onChange={(e) => setQuestion(q.localId, (c) => ({ ...c, text: e.target.value }))} disabled={readOnly} placeholder="Question text…" style={{ ...inputStyle, background: "#FFF", marginBottom: "8px" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <select value={q.type} onChange={(e) => setQuestion(q.localId, (c) => ({ ...c, type: e.target.value as SurveyFieldType, choices: e.target.value === SurveyFieldType.MULTIPLE_CHOICE && !c.choices.length ? ["", ""] : c.choices }))} disabled={readOnly} style={{ ...selectStyle, width: "160px" }}>
                        <option value={SurveyFieldType.TEXT}>Text</option>
                        <option value={SurveyFieldType.MULTIPLE_CHOICE}>Multiple Choice</option>
                        <option value={SurveyFieldType.RATING}>Rating (1–5)</option>
                        <option value={SurveyFieldType.YES_NO}>Yes / No</option>
                      </select>
                      <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#6B7280", cursor: "pointer" }}>
                        <input type="checkbox" checked={q.required} disabled={readOnly} onChange={(e) => setQuestion(q.localId, (c) => ({ ...c, required: e.target.checked }))} />
                        Required
                      </label>
                    </div>
                    {q.type === SurveyFieldType.MULTIPLE_CHOICE && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "5px" }}>
                        {q.choices.map((choice, ci) => (
                          <div key={ci} style={{ display: "flex", gap: "5px" }}>
                            <input value={choice} onChange={(e) => setQuestion(q.localId, (c) => ({ ...c, choices: c.choices.map((x, i) => i === ci ? e.target.value : x) }))} disabled={readOnly} placeholder={`Choice ${ci + 1}`} style={{ ...inputStyle, flex: 1 }} />
                            {!readOnly && <button type="button" onClick={() => setQuestion(q.localId, (c) => { if (c.choices.length <= 2) { toast.error("Minimum 2 choices"); return c; } return { ...c, choices: c.choices.filter((_, i) => i !== ci) }; })} style={{ width: "36px", height: "36px", borderRadius: "7px", border: "1px solid #FECACA", background: "#FFF5F5", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}><X style={{ width: "11px", height: "11px" }} /></button>}
                          </div>
                        ))}
                        {!readOnly && <button type="button" onClick={() => setQuestion(q.localId, (c) => ({ ...c, choices: [...c.choices, ""] }))} style={{ fontSize: "11.5px", color: "#2563EB", fontWeight: 600, background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Work Sans', sans-serif", padding: 0 }}>+ Add Choice</button>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: "12px 24px 20px", borderTop: "1px solid #F3F4F6", display: "flex", justifyContent: "flex-end", gap: "8px", flexShrink: 0, background: "#FFF" }}>
            <button type="button" onClick={() => setDialogOpen(false)} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "7px", border: "1px solid #E5E7EB", background: "#FFF", color: "#6B7280", cursor: "pointer", fontSize: "12.5px", fontWeight: 500, fontFamily: "'Work Sans', sans-serif" }}>
              <X style={{ width: "12px", height: "12px" }} /> {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly && (
              <button type="button" onClick={() => void submitSurvey()} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 20px", borderRadius: "7px", background: "#111827", color: "#FFF", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif" }}>
                <Check style={{ width: "13px", height: "13px" }} /> Save Survey
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}