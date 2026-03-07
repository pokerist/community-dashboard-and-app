
import { useEffect, useMemo, useState, ReactElement, JSXElementConstructor, ReactNode, ReactPortal } from "react";
import { ArrowDown, ArrowUp, Eye, Plus, Search, Trash2 } from "lucide-react";
import { SurveyFieldType, SurveyStatus, SurveyTarget } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { DataTable, type DataTableColumn } from "../DataTable";
import { SkeletonTable } from "../SkeletonTable";
import { StatusBadge } from "../StatusBadge";
import { DrawerForm } from "../DrawerForm";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";
import { StatCard } from "../StatCard";
import { toast } from "sonner";
import surveyService, {
  type CommunityOption,
  type SurveyAnalytics,
  type SurveyDetail,
  type SurveyListItem,
  type SurveyQuestionAnalytics,
  type UnitOption,
} from "../../lib/surveyService";

type Tab = "surveys" | "analytics";

type QuestionForm = {
  localId: string;
  id?: string;
  text: string;
  type: SurveyFieldType;
  required: boolean;
  displayOrder: number;
  choices: string[];
};

type SurveyForm = {
  title: string;
  description: string;
  targetType: SurveyTarget;
  communityIds: string[];
  unitIds: string[];
  questions: QuestionForm[];
};

const createQuestion = (displayOrder: number): QuestionForm => ({
  localId: `q-${Date.now()}-${displayOrder}`,
  text: "",
  type: SurveyFieldType.TEXT,
  required: true,
  displayOrder,
  choices: ["", ""],
});

const createEmptyForm = (): SurveyForm => ({
  title: "",
  description: "",
  targetType: SurveyTarget.ALL,
  communityIds: [],
  unitIds: [],
  questions: [createQuestion(0)],
});

const formatDate = (value: string | null): string =>
  value ? new Date(value).toLocaleDateString() : "-";

const titleCase = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const targetLabel = (target: SurveyTarget): string => {
  if (target === SurveyTarget.SPECIFIC_COMMUNITIES) return "Specific Communities";
  if (target === SurveyTarget.SPECIFIC_UNITS) return "Specific Units";
  return "All";
};

const isText = (
  q: SurveyQuestionAnalytics,
): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.TEXT; textAnswers: string[]; totalTextAnswers: number } =>
  q.type === SurveyFieldType.TEXT;

const isMc = (
  q: SurveyQuestionAnalytics,
): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.MULTIPLE_CHOICE; options: Array<{ choice: string; percentage: number; count: number }> } =>
  q.type === SurveyFieldType.MULTIPLE_CHOICE;

const isRating = (
  q: SurveyQuestionAnalytics,
): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.RATING; avg: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> } =>
  q.type === SurveyFieldType.RATING;

const isYesNo = (
  q: SurveyQuestionAnalytics,
): q is SurveyQuestionAnalytics & { type: typeof SurveyFieldType.YES_NO; yes: number; no: number } =>
  q.type === SurveyFieldType.YES_NO;

export function SurveysManagement() {
  const [tab, setTab] = useState<Tab>("surveys");
  const [stats, setStats] = useState<{ total: number; active: number; totalResponses: number; avgResponseRate: number } | null>(null);
  const [rows, setRows] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [search, setSearch] = useState<string>("");
  const [status, setStatus] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [form, setForm] = useState<SurveyForm>(createEmptyForm);

  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitSearch, setUnitSearch] = useState<string>("");

  const [analyticsSurveyId, setAnalyticsSurveyId] = useState<string>("");
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [analyticsDetail, setAnalyticsDetail] = useState<SurveyDetail | null>(null);
  const [expandedText, setExpandedText] = useState<Set<string>>(new Set<string>());

  const filteredUnits = useMemo(() => {
    if (!unitSearch.trim()) return units;
    const query = unitSearch.trim().toLowerCase();
    return units.filter((unit) => `${unit.unitNumber} ${unit.block ?? ""}`.toLowerCase().includes(query));
  }, [unitSearch, units]);

  const loadRows = async (): Promise<void> => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        surveyService.getSurveyStats(),
        surveyService.listSurveys({
          status: status === "ALL" ? undefined : (status as SurveyStatus),
          search: search.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page: 1,
          limit: 100,
        }),
      ]);
      setStats({ total: s.total, active: s.active, totalResponses: s.totalResponses, avgResponseRate: s.avgResponseRate });
      setRows(list.data);
    } catch {
      toast.error("Failed to load surveys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [status, dateFrom, dateTo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRows();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const loadTargets = async (): Promise<void> => {
      try {
        const [cs, us] = await Promise.all([surveyService.listCommunityOptions(), surveyService.listUnitOptions()]);
        setCommunities(cs);
        setUnits(us);
      } catch {
        // Optional inputs.
      }
    };
    void loadTargets();
  }, []);

  useEffect(() => {
    if (!analyticsSurveyId) {
      setAnalytics(null);
      setAnalyticsDetail(null);
      return;
    }
    const loadAnalytics = async (): Promise<void> => {
      try {
        const [a, d] = await Promise.all([
          surveyService.getSurveyAnalytics(analyticsSurveyId),
          surveyService.getSurveyDetail(analyticsSurveyId),
        ]);
        setAnalytics(a);
        setAnalyticsDetail(d);
      } catch {
        toast.error("Failed to load analytics");
      }
    };
    void loadAnalytics();
  }, [analyticsSurveyId]);

  const openCreate = (): void => {
    setEditingId(null);
    setReadOnly(false);
    setForm(createEmptyForm());
    setDrawerOpen(true);
  };

  const openDetail = async (surveyId: string): Promise<void> => {
    try {
      const detail = await surveyService.getSurveyDetail(surveyId);
      setEditingId(surveyId);
      setReadOnly(detail.status !== SurveyStatus.DRAFT);
      setForm({
        title: detail.title,
        description: detail.description ?? "",
        targetType: detail.targetType,
        communityIds: detail.targetMeta?.communityIds ?? [],
        unitIds: detail.targetMeta?.unitIds ?? [],
        questions: detail.questions
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((q, index) => ({
            localId: q.id,
            id: q.id,
            text: q.text,
            type: q.type,
            required: q.required,
            displayOrder: index,
            choices: q.type === SurveyFieldType.MULTIPLE_CHOICE ? q.options?.choices ?? ["", ""] : ["", ""],
          })),
      });
      setDrawerOpen(true);
    } catch {
      toast.error("Failed to load survey");
    }
  };

  const publishSurvey = async (surveyId: string): Promise<void> => {
    try {
      await surveyService.publishSurvey(surveyId);
      toast.success("Survey published");
      await loadRows();
    } catch {
      toast.error("Failed to publish survey");
    }
  };

  const closeSurvey = async (surveyId: string): Promise<void> => {
    try {
      await surveyService.closeSurvey(surveyId);
      toast.success("Survey closed");
      await loadRows();
    } catch {
      toast.error("Failed to close survey");
    }
  };

  const deleteSurvey = async (surveyId: string): Promise<void> => {
    try {
      await surveyService.deleteSurvey(surveyId);
      if (analyticsSurveyId === surveyId) setAnalyticsSurveyId("");
      toast.success("Survey deleted");
      await loadRows();
    } catch {
      toast.error("Failed to delete survey");
    }
  };

  const setQuestion = (localId: string, updater: (current: QuestionForm) => QuestionForm): void => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.localId === localId ? updater(q) : q)),
    }));
  };

  const reindex = (questions: QuestionForm[]): QuestionForm[] =>
    questions.map((q, index) => ({ ...q, displayOrder: index }));

  const moveQuestion = (localId: string, direction: "up" | "down"): void => {
    setForm((prev) => {
      const i = prev.questions.findIndex((q) => q.localId === localId);
      if (i < 0) return prev;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= prev.questions.length) return prev;
      const next = [...prev.questions];
      const curr = next[i];
      next[i] = next[j];
      next[j] = curr;
      return { ...prev, questions: reindex(next) };
    });
  };

  const submitSurvey = async (): Promise<void> => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (form.questions.length < 1) {
      toast.error("At least one question is required");
      return;
    }

    try {
      const questions = form.questions.map((q, index) => {
        const text = q.text.trim();
        if (!text) throw new Error(`Question ${index + 1} is empty`);

        if (q.type === SurveyFieldType.MULTIPLE_CHOICE) {
          const choices = q.choices.map((choice) => choice.trim()).filter((choice) => choice.length > 0);
          if (choices.length < 2) throw new Error(`Question ${index + 1} needs at least 2 choices`);
          return {
            id: q.id,
            text,
            type: q.type,
            required: q.required,
            displayOrder: index,
            options: { choices },
          };
        }
        return { id: q.id, text, type: q.type, required: q.required, displayOrder: index };
      });

      const targetMeta =
        form.targetType === SurveyTarget.SPECIFIC_COMMUNITIES
          ? { communityIds: form.communityIds }
          : form.targetType === SurveyTarget.SPECIFIC_UNITS
            ? { unitIds: form.unitIds }
            : undefined;

      if (editingId) {
        await surveyService.updateSurvey(editingId, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          targetType: form.targetType,
          targetMeta,
          questions,
        });
      } else {
        await surveyService.createSurvey({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          targetType: form.targetType,
          targetMeta,
          questions,
        });
      }

      toast.success("Survey saved");
      setDrawerOpen(false);
      await loadRows();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    }
  };

  const columns = useMemo<DataTableColumn<SurveyListItem>[]>(() => [
    { key: "title", header: "Title", render: (r) => <span className="text-[#0F172A]">{r.title}</span> },
    { key: "target", header: "Target", render: (r) => <span className="text-[#64748B]">{targetLabel(r.targetType)}</span> },
    { key: "questions", header: "Questions", render: (r) => <span className="font-['DM_Mono'] text-[#0F172A]">{r.questionCount}</span> },
    { key: "responses", header: "Responses", render: (r) => <span className="font-['DM_Mono'] text-[#0F172A]">{r.responseCount}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "published", header: "Published", render: (r) => <span className="text-[#94A3B8]">{formatDate(r.publishedAt)}</span> },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => void openDetail(r.id)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#2563EB] hover:bg-blue-50"><Eye className="h-3.5 w-3.5" />View</button>
          {r.status === SurveyStatus.DRAFT ? <button type="button" onClick={() => void publishSurvey(r.id)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200">Publish</button> : null}
          {r.status === SurveyStatus.ACTIVE ? <button type="button" onClick={() => void closeSurvey(r.id)} className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 hover:bg-amber-200">Close</button> : null}
          {r.status !== SurveyStatus.ACTIVE ? <button type="button" onClick={() => void deleteSurvey(r.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200">Delete</button> : null}
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <PageHeader title="Survey Center" description="Create surveys and inspect response analytics." />

      <Tabs value={tab} onValueChange={(v: string) => {
          setTab(v as Tab);
          setAnalyticsSurveyId("");
        }} className="space-y-6">
        <TabsList className="border border-[#E2E8F0] bg-[#F8FAFC] p-1">
          <TabsTrigger value="surveys" className="text-[#64748B] data-[state=active]:bg-white data-[state=active]:text-[#0F172A]">Surveys</TabsTrigger>
          <TabsTrigger value="analytics" className="text-[#64748B] data-[state=active]:bg-white data-[state=active]:text-[#0F172A]">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="surveys" className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <StatCard icon="tickets" title="Total Surveys" value={String(stats?.total ?? 0)} />
            <StatCard icon="active-users" title="Active" value={String(stats?.active ?? 0)} />
            <StatCard icon="complaints-total" title="Total Responses" value={String(stats?.totalResponses ?? 0)} />
            <StatCard icon="revenue" title="Avg Response Rate" value={`${(stats?.avgResponseRate ?? 0).toFixed(1)}%`} />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title" className="w-full rounded-lg border border-[#CBD5E1] bg-white py-2 pl-9 pr-3 text-sm text-[#0F172A]" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]">
              <option value="ALL">All Statuses</option>
              <option value={SurveyStatus.DRAFT}>Draft</option>
              <option value={SurveyStatus.ACTIVE}>Active</option>
              <option value={SurveyStatus.CLOSED}>Closed</option>
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]" />
            <button type="button" onClick={openCreate} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors"><Plus className="h-4 w-4" />Create Survey</button>
          </div>

          {loading ? (
            <SkeletonTable columns={7} />
          ) : (
            <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} emptyTitle="No surveys found" emptyDescription="Create your first survey to collect responses." />
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <label className="mb-2 block text-xs uppercase tracking-wider text-[#64748B]">Survey selector</label>
            <select value={analyticsSurveyId} onChange={(e) => setAnalyticsSurveyId(e.target.value)} className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A]">
              <option value="">Select survey</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>{row.title}</option>
              ))}
            </select>
          </div>

          {!analytics || !analyticsDetail ? (
            <EmptyState title="Select a survey to view analytics" description="Choose a survey from the selector above." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <StatCard icon="tickets" title="Total Responses" value={String(analytics.totalResponses)} />
                <StatCard icon="active-users" title="Completion Rate" value={`${analytics.completionRate.toFixed(1)}%`} />
                <StatCard icon="devices" title="Published Date" value={formatDate(analyticsDetail.publishedAt)} />
              </div>

              {analytics.questions.slice().sort((a, b) => a.displayOrder - b.displayOrder).map((q, i) => (
                <div key={q.questionId} className="mb-4 rounded-xl border border-[#E2E8F0] bg-white p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="mb-1 text-xs text-[#94A3B8]">Q{i + 1} · {titleCase(q.type)}</p>
                      <p className="text-sm font-medium text-[#0F172A]">{q.questionText}</p>
                    </div>
                    <span className="text-xs text-[#64748B]">{q.answerCount} answers</span>
                  </div>

                  {isText(q) ? (
                    <div className="space-y-2">
                      {(expandedText.has(q.questionId) ? q.textAnswers : q.textAnswers.slice(0, 10)).map((answer: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | null | undefined, idx: any) => (
                        <div key={`${q.questionId}-${idx}`} className="max-h-[200px] overflow-y-auto rounded-lg bg-[#F8FAFC] p-3 text-sm text-[#0F172A]">{answer}</div>
                      ))}
                      {q.totalTextAnswers > 10 ? (
                        <button type="button" onClick={() => setExpandedText((prev) => {
                          const next = new Set(prev);
                          if (next.has(q.questionId)) next.delete(q.questionId); else next.add(q.questionId);
                          return next;
                        })} className="text-xs text-[#2563EB] hover:text-[#1D4ED8]">{expandedText.has(q.questionId) ? "Show fewer answers" : `View all ${q.totalTextAnswers} answers`}</button>
                      ) : null}
                    </div>
                  ) : null}

                  {isMc(q) ? (
                    <div className="space-y-2">
                      {q.options.map((opt: { choice: string; percentage: number; count: number }) => (
                        <div key={opt.choice} className="mb-2 flex items-center gap-3">
                          <span className="w-32 truncate text-sm text-[#64748B]">{opt.choice}</span>
                          <div className="h-2 flex-1 rounded-full bg-[#E2E8F0]"><div className="h-2 rounded-full bg-[#2563EB]" style={{ width: `${Math.min(opt.percentage, 100)}%` }} /></div>
                          <span className="w-16 text-right text-xs text-[#94A3B8]">{opt.count} ({opt.percentage.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isRating(q) ? (
                    <div className="space-y-4">
                      <p className="text-3xl font-['DM_Mono'] text-[#0F172A]">{q.avg.toFixed(1)}</p>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = q.distribution[star as 1 | 2 | 3 | 4 | 5];
                        const pct = q.answerCount > 0 ? (count / q.answerCount) * 100 : 0;
                        const tone = star >= 4 ? "bg-emerald-500" : star <= 2 ? "bg-red-500" : "bg-blue-500";
                        return (
                          <div key={`${q.questionId}-${star}`} className="flex items-center gap-3">
                            <span className="w-12 text-sm text-[#64748B]">{star}*</span>
                            <div className="h-2 flex-1 rounded-full bg-[#E2E8F0]"><div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                            <span className="w-8 text-right text-xs text-[#94A3B8]">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {isYesNo(q) ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs text-emerald-700">YES</p>
                        <p className="text-2xl font-['DM_Mono'] text-emerald-900">{q.yes}</p>
                        <p className="text-xs text-emerald-600">{q.answerCount > 0 ? `${((q.yes / q.answerCount) * 100).toFixed(1)}%` : "0%"}</p>
                      </div>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-xs text-red-700">NO</p>
                        <p className="text-2xl font-['DM_Mono'] text-red-900">{q.no}</p>
                        <p className="text-xs text-red-600">{q.answerCount > 0 ? `${((q.no / q.answerCount) * 100).toFixed(1)}%` : "0%"}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DrawerForm open={drawerOpen} onOpenChange={setDrawerOpen} title={editingId ? (readOnly ? "Survey Detail" : "Edit Survey") : "Create Survey"} description="Survey info and questions" widthClassName="w-full sm:max-w-[640px]">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-wider text-[#64748B]">Survey Info</p>
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Title" disabled={readOnly} className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70" />
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} disabled={readOnly} className="min-h-[80px] w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70" />
            <select value={form.targetType} onChange={(e) => setForm((p) => ({ ...p, targetType: e.target.value as SurveyTarget }))} disabled={readOnly} className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70">
              <option value={SurveyTarget.ALL}>ALL</option>
              <option value={SurveyTarget.SPECIFIC_COMMUNITIES}>Specific Communities</option>
              <option value={SurveyTarget.SPECIFIC_UNITS}>Specific Units</option>
            </select>

            {form.targetType === SurveyTarget.SPECIFIC_COMMUNITIES ? (
              <div className="max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-2">
                {communities.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[#0F172A] hover:bg-blue-50"><input type="checkbox" disabled={readOnly} checked={form.communityIds.includes(c.id)} onChange={() => setForm((p) => ({ ...p, communityIds: p.communityIds.includes(c.id) ? p.communityIds.filter((id) => id !== c.id) : [...p.communityIds, c.id] }))} />{c.name}</label>
                ))}
              </div>
            ) : null}

            {form.targetType === SurveyTarget.SPECIFIC_UNITS ? (
              <div className="space-y-2">
                <input value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} disabled={readOnly} placeholder="Search unit" className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70" />
                <div className="max-h-[160px] space-y-1 overflow-y-auto rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-2">
                  {filteredUnits.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[#0F172A] hover:bg-blue-50"><input type="checkbox" disabled={readOnly} checked={form.unitIds.includes(u.id)} onChange={() => setForm((p) => ({ ...p, unitIds: p.unitIds.includes(u.id) ? p.unitIds.filter((id) => id !== u.id) : [...p.unitIds, u.id] }))} />{u.unitNumber}{u.block ? ` · ${u.block}` : ""}</label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wider text-[#64748B]">Questions</p>{!readOnly ? <button type="button" onClick={() => setForm((p) => ({ ...p, questions: [...p.questions, createQuestion(p.questions.length)] }))} className="inline-flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8]"><Plus className="h-3.5 w-3.5" />Add Question</button> : null}</div>
            {form.questions.map((q, idx) => (
              <div key={q.localId} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <div className="mb-3 flex items-start justify-between"><span className="text-xs font-medium text-[#64748B]">Q{idx + 1}</span>{!readOnly ? <div className="flex items-center gap-1"><button type="button" onClick={() => moveQuestion(q.localId, "up")} className="rounded p-1 text-[#94A3B8] hover:bg-blue-50"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" onClick={() => moveQuestion(q.localId, "down")} className="rounded p-1 text-[#94A3B8] hover:bg-blue-50"><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setForm((p) => { if (p.questions.length <= 1) { toast.error("At least one question is required"); return p; } return { ...p, questions: p.questions.filter((item) => item.localId !== q.localId).map((item, order) => ({ ...item, displayOrder: order })) }; })} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button></div> : null}</div>
                <input value={q.text} onChange={(e) => setQuestion(q.localId, (current) => ({ ...current, text: e.target.value }))} disabled={readOnly} placeholder="Question text..." className="w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70" />
                <div className="mt-2 flex items-center gap-2"><select value={q.type} onChange={(e) => setQuestion(q.localId, (current) => ({ ...current, type: e.target.value as SurveyFieldType, choices: e.target.value === SurveyFieldType.MULTIPLE_CHOICE && current.choices.length === 0 ? ["", ""] : current.choices }))} disabled={readOnly} className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70"><option value={SurveyFieldType.TEXT}>TEXT</option><option value={SurveyFieldType.MULTIPLE_CHOICE}>MULTIPLE_CHOICE</option><option value={SurveyFieldType.RATING}>RATING</option><option value={SurveyFieldType.YES_NO}>YES_NO</option></select><label className="flex items-center gap-1.5 text-xs text-[#64748B]"><input type="checkbox" checked={q.required} disabled={readOnly} onChange={(e) => setQuestion(q.localId, (current) => ({ ...current, required: e.target.checked }))} />Required</label></div>
                {q.type === SurveyFieldType.MULTIPLE_CHOICE ? <div className="mt-3 space-y-2">{q.choices.map((choice, cIndex) => <div key={`${q.localId}-${cIndex}`} className="flex gap-2"><input value={choice} onChange={(e) => setQuestion(q.localId, (current) => ({ ...current, choices: current.choices.map((entry, i) => i === cIndex ? e.target.value : entry) }))} disabled={readOnly} placeholder={`Choice ${cIndex + 1}`} className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] disabled:opacity-70" />{!readOnly ? <button type="button" onClick={() => setQuestion(q.localId, (current) => { if (current.choices.length <= 2) { toast.error("Minimum 2 choices required"); return current; } return { ...current, choices: current.choices.filter((_, i) => i !== cIndex) }; })} className="rounded-lg border border-[#CBD5E1] px-2 text-sm text-red-600 hover:bg-red-50">×</button> : null}</div>)}{!readOnly ? <button type="button" onClick={() => setQuestion(q.localId, (current) => ({ ...current, choices: [...current.choices, ""] }))} className="text-xs text-[#2563EB] hover:text-[#1D4ED8]">+ Add Choice</button> : null}</div> : null}
                {q.type === SurveyFieldType.RATING ? <p className="mt-2 text-xs text-[#94A3B8]">Scale 1-5</p> : null}
                {q.type === SurveyFieldType.YES_NO ? <p className="mt-2 text-xs text-[#94A3B8]">Yes / No</p> : null}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3"><button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2 text-sm text-[#0F172A] hover:bg-[#E8EFF7]">Close</button>{!readOnly ? <button type="button" onClick={() => void submitSurvey()} className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8]">Save Survey</button> : null}</div>
        </div>
      </DrawerForm>
    </div>
  );
}

