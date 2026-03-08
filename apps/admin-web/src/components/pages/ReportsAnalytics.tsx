import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Download,
  FileText,
  RefreshCw,
  Building2,
  DollarSign,
  MessageCircle,
  Wrench,
  AlertTriangle,
  Users,
  Activity,
  DoorOpen,
  X,
  Loader,
  CheckCircle2,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage, extractRows, formatCurrencyEGP, formatDateTime, humanizeEnum } from "../../lib/live-data";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { DataTable, type DataTableColumn } from "../DataTable";
import { PageHeader } from "../PageHeader";

type ReportKey =
  | "occupancy"
  | "financial"
  | "service_requests"
  | "security_incidents"
  | "visitor_traffic"
  | "maintenance_costs"
  | "complaints"
  | "violations"
  | "gate_entry_log"
  | "resident_activity";

type ExportFormat = "csv" | "json" | "xlsx" | "pdf";

type HistoryRow = {
  id: string;
  reportType: string;
  label: string;
  format: string;
  generatedAt: string;
  rowCount: number;
  filename: string;
  createdById?: string | null;
};

type ScheduleRow = {
  id: string;
  reportType: string;
  format: string;
  label: string;
  frequency: string;
  isEnabled: boolean;
  status: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  recipientEmails?: string[];
  createdAt: string;
};

const REPORT_OPTIONS: Array<{
  key: ReportKey;
  label: string;
  description: string;
  icon: typeof Building2;
  bgColor: string;
  textColor: string;
}> = [
  { key: "occupancy", label: "Occupancy Report", description: "Unit occupancy and block utilization analysis", icon: Building2, bgColor: "bg-blue-500/10", textColor: "text-blue-600" },
  { key: "financial", label: "Financial Summary", description: "Invoices, revenue, and payment status overview", icon: DollarSign, bgColor: "bg-emerald-500/10", textColor: "text-emerald-600" },
  { key: "complaints", label: "Complaints Report", description: "Complaints grouped by category and resolution status", icon: MessageCircle, bgColor: "bg-amber-500/10", textColor: "text-amber-600" },
  { key: "service_requests", label: "Service Requests Report", description: "Service requests by type, priority, and status", icon: Wrench, bgColor: "bg-purple-500/10", textColor: "text-purple-600" },
  { key: "violations", label: "Violations Report", description: "Violations and fines tracking by resident", icon: AlertTriangle, bgColor: "bg-red-500/10", textColor: "text-red-600" },
  { key: "visitor_traffic", label: "Visitor Traffic Report", description: "Access QR generation and gate usage activity", icon: Users, bgColor: "bg-cyan-500/10", textColor: "text-cyan-600" },
  { key: "maintenance_costs", label: "Maintenance Cost Analysis", description: "Maintenance invoices and cost breakdown", icon: Wrench, bgColor: "bg-orange-500/10", textColor: "text-orange-600" },
  { key: "security_incidents", label: "Security Incidents Report", description: "Incidents tracking and resolution status", icon: AlertTriangle, bgColor: "bg-red-600/10", textColor: "text-red-700" },
  { key: "gate_entry_log", label: "Gate Entry Log Report", description: "Access records and gate operations history", icon: DoorOpen, bgColor: "bg-indigo-500/10", textColor: "text-indigo-600" },
  { key: "resident_activity", label: "Resident Activity Report", description: "Per-resident activity summary and metrics", icon: Activity, bgColor: "bg-pink-500/10", textColor: "text-pink-600" },
];

function toBackendReportType(key: ReportKey): string {
  switch (key) {
    case "occupancy": return "OCCUPANCY";
    case "financial": return "FINANCIAL";
    case "service_requests": return "SERVICE_REQUESTS";
    case "security_incidents": return "SECURITY_INCIDENTS";
    case "visitor_traffic": return "VISITOR_TRAFFIC";
    case "maintenance_costs": return "MAINTENANCE_COSTS";
    case "complaints": return "COMPLAINTS";
    case "violations": return "VIOLATIONS";
    case "gate_entry_log": return "GATE_ENTRY_LOG";
    case "resident_activity": return "RESIDENT_ACTIVITY";
    default: return "OCCUPANCY";
  }
}

const FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

export function ReportsAnalytics() {
  const [activeTab, setActiveTab] = useState<"reports" | "schedules">("reports");
  const [selectedReportType, setSelectedReportType] = useState<ReportKey>("occupancy");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalGenerated: 0,
    generatedThisMonth: 0,
    activeSchedules: 0,
    lastGeneratedAt: null as string | null,
  });
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Schedule creation form state
  const [scheduleForm, setScheduleForm] = useState({
    reportType: "occupancy" as ReportKey,
    format: "csv" as ExportFormat,
    frequency: "WEEKLY",
    label: "",
    recipientEmails: "",
  });
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiClient.get("/reports/stats");
      setStats(res.data);
    } catch (error) {
      toast.error("Failed to load stats", { description: errorMessage(error) });
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get("/reports", { params: { page: 1, limit: 20 } });
      setHistory(extractRows<HistoryRow>(res.data?.data || []));
    } catch (error) {
      toast.error("Failed to load reports", { description: errorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await apiClient.get("/reports/schedules", { params: { limit: 30 } });
      setSchedules(extractRows<ScheduleRow>(res.data?.data || []));
    } catch (error) {
      toast.error("Failed to load schedules", { description: errorMessage(error) });
    }
  }, []);

  const generateReport = useCallback(
    async (reportType: ReportKey) => {
      setIsGenerating(true);
      try {
        const report = REPORT_OPTIONS.find((r) => r.key === reportType);
        const res = await apiClient.post("/reports/generate", {
          reportType: toBackendReportType(reportType),
          format: exportFormat.toUpperCase(),
          label: report?.label,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });

        const reportId = res.data?.id;
        if (!reportId) throw new Error("No report ID returned");

        try {
          const downloadRes = await apiClient.get(`/reports/${reportId}/download`, { responseType: "blob" });
          const blob = new Blob([downloadRes.data]);
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = res.data?.filename || `report.${exportFormat}`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        } catch {
          // Fallback — report still saved
        }

        await loadHistory();
        toast.success(`${report?.label} generated successfully!`);
        setShowGenerateModal(false);
      } catch (error) {
        toast.error("Failed to generate report", { description: errorMessage(error) });
      } finally {
        setIsGenerating(false);
      }
    },
    [exportFormat, dateFrom, dateTo, loadHistory],
  );

  const downloadReport = useCallback(async (reportId: string, filename: string) => {
    try {
      const res = await apiClient.get(`/reports/${reportId}/download`, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to download report", { description: errorMessage(error) });
    }
  }, []);

  const toggleSchedule = useCallback(
    async (scheduleId: string, enable: boolean) => {
      try {
        await apiClient.patch(`/reports/schedules/${scheduleId}/toggle`, { isEnabled: enable });
        await loadSchedules();
        toast.success(enable ? "Schedule enabled" : "Schedule paused");
      } catch (error) {
        toast.error("Failed to toggle schedule", { description: errorMessage(error) });
      }
    },
    [loadSchedules],
  );

  const runScheduleNow = useCallback(
    async (scheduleId: string) => {
      try {
        await apiClient.post(`/reports/schedules/${scheduleId}/run-now`);
        await loadSchedules();
        await loadHistory();
        toast.success("Schedule executed successfully");
      } catch (error) {
        toast.error("Failed to run schedule", { description: errorMessage(error) });
      }
    },
    [loadSchedules, loadHistory],
  );

  const createSchedule = useCallback(async () => {
    if (!scheduleForm.label.trim()) {
      toast.error("Schedule label is required");
      return;
    }
    setIsCreatingSchedule(true);
    try {
      const emails = scheduleForm.recipientEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      await apiClient.post("/reports/schedules", {
        reportType: toBackendReportType(scheduleForm.reportType),
        format: scheduleForm.format.toUpperCase(),
        frequency: scheduleForm.frequency,
        label: scheduleForm.label.trim(),
        recipientEmails: emails.length > 0 ? emails : undefined,
      });
      await loadSchedules();
      await loadStats();
      setShowScheduleModal(false);
      setScheduleForm({ reportType: "occupancy", format: "csv", frequency: "WEEKLY", label: "", recipientEmails: "" });
      toast.success("Schedule created");
    } catch (error) {
      toast.error("Failed to create schedule", { description: errorMessage(error) });
    } finally {
      setIsCreatingSchedule(false);
    }
  }, [scheduleForm, loadSchedules, loadStats]);

  useEffect(() => {
    void loadStats();
    void loadHistory();
    void loadSchedules();
  }, [loadStats, loadHistory, loadSchedules]);

  const getFormatBadgeColor = (format: string) => {
    const f = format.toLowerCase();
    if (f === "csv") return "bg-emerald-100 text-emerald-700";
    if (f === "xlsx") return "bg-blue-100 text-blue-700";
    if (f === "pdf") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Generate, download, and schedule automated reports"
        variant="light"
        actions={
          <Button variant="outline" size="sm" onClick={() => { void loadStats(); void loadHistory(); void loadSchedules(); }} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-6 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Total Generated</p>
              <p className="text-3xl font-bold text-[#0F172A] mt-2">{stats.totalGenerated}</p>
            </div>
            <FileText className="w-10 h-10 text-blue-300" />
          </div>
        </Card>
        <Card className="p-6 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">This Month</p>
              <p className="text-3xl font-bold text-[#0F172A] mt-2">{stats.generatedThisMonth}</p>
            </div>
            <CalendarClock className="w-10 h-10 text-emerald-300" />
          </div>
        </Card>
        <Card className="p-6 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Active Schedules</p>
              <p className="text-3xl font-bold text-[#0F172A] mt-2">{stats.activeSchedules}</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-amber-300" />
          </div>
        </Card>
        <Card className="p-6 border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[#64748B] uppercase tracking-wider">Last Generated</p>
              <p className="text-sm font-medium text-[#0F172A] mt-2">{stats.lastGeneratedAt ? formatDateTime(stats.lastGeneratedAt) : "—"}</p>
            </div>
            <RefreshCw className="w-10 h-10 text-cyan-300" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${activeTab === "reports" ? "border-blue-600 text-blue-600" : "border-transparent text-[#64748B] hover:text-[#334155]"}`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Reports
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition ${activeTab === "schedules" ? "border-blue-600 text-blue-600" : "border-transparent text-[#64748B] hover:text-[#334155]"}`}
        >
          <CalendarClock className="w-4 h-4 inline mr-2" />
          Schedules
        </button>
      </div>

      {activeTab === "reports" ? (
        <div className="space-y-6">
          {/* Report Type Cards Grid */}
          <div>
            <p className="text-sm text-[#64748B] mb-4">Click any card to generate an instant report</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {REPORT_OPTIONS.map(({ key, label, description, icon: Icon, bgColor, textColor }) => (
                <Card
                  key={key}
                  className="border border-[#E2E8F0] p-4 rounded-xl hover:border-blue-400 hover:shadow-sm transition cursor-pointer group"
                  onClick={() => { setSelectedReportType(key); setShowGenerateModal(true); }}
                >
                  <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${textColor}`} />
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A] mb-1">{label}</p>
                  <p className="text-xs text-[#64748B] line-clamp-2">{description}</p>
                  <div className="mt-3 flex items-center gap-1 text-blue-500 text-xs opacity-0 group-hover:opacity-100 transition">
                    <Download className="w-3 h-3" />
                    <span>Generate</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Reports Table */}
          <div>
            <h2 className="text-base font-semibold text-[#0F172A] mb-3">Generated Reports</h2>
            {(() => {
              const cols: DataTableColumn<HistoryRow>[] = [
                { key: "name", header: "Report Name", render: (r) => <span className="text-[#0F172A] font-medium">{r.label}</span> },
                { key: "type", header: "Type", render: (r) => <span className="text-[#64748B] text-sm">{humanizeEnum(r.reportType)}</span> },
                { key: "format", header: "Format", render: (r) => <Badge className={getFormatBadgeColor(r.format)}>{r.format.toUpperCase()}</Badge> },
                { key: "rows", header: "Rows", render: (r) => <span className="text-[#334155] font-medium">{r.rowCount}</span> },
                { key: "generated", header: "Generated", render: (r) => <span className="text-[#64748B] text-sm">{formatDateTime(r.generatedAt)}</span> },
                { key: "actions", header: "Actions", render: (r) => (
                  <Button variant="ghost" size="sm" onClick={() => void downloadReport(r.id, r.filename)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <Download className="w-4 h-4" />
                  </Button>
                )},
              ];
              return (
                <Card className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <DataTable columns={cols} rows={history} rowKey={(r) => r.id} emptyTitle="No reports generated yet" emptyDescription="Generated reports will appear here" />
                </Card>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#64748B]">Manage automatic report generation schedules</p>
            <Button onClick={() => setShowScheduleModal(true)} className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90">
              <CalendarClock className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </div>

          <div className="grid gap-3">
            {schedules.length === 0 ? (
              <Card className="border border-[#E2E8F0] rounded-xl p-12 text-center">
                <CalendarClock className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" />
                <p className="text-[#64748B]">No schedules created yet</p>
              </Card>
            ) : (
              schedules.map((schedule) => (
                <Card key={schedule.id} className="border border-[#E2E8F0] rounded-xl p-5 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-[#0F172A] font-semibold">{schedule.label}</p>
                        <Badge className={schedule.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                          {schedule.isEnabled ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
                        <span>{humanizeEnum(schedule.reportType)}</span>
                        <span>•</span>
                        <span>{schedule.format.toUpperCase()}</span>
                        <span>•</span>
                        <span>{schedule.frequency}</span>
                        <span>•</span>
                        <span>Next: {schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : "—"}</span>
                      </div>
                      {schedule.recipientEmails && schedule.recipientEmails.length > 0 && (
                        <p className="text-xs text-[#64748B] mt-1">📧 {schedule.recipientEmails.join(", ")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => void runScheduleNow(schedule.id)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleSchedule(schedule.id, !schedule.isEnabled)}
                        className={schedule.isEnabled ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                      >
                        {schedule.isEnabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowGenerateModal(false)}>
          <Card className="bg-white border border-[#E2E8F0] rounded-xl p-6 w-[420px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#0F172A]">
                Generate {REPORT_OPTIONS.find((r) => r.key === selectedReportType)?.label}
              </h2>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 rounded text-[#64748B] hover:text-[#334155] hover:bg-[#F1F5F9]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[#334155]">Date Range</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#334155]">Export Format</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(["csv", "xlsx", "pdf", "json"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${exportFormat === fmt ? "bg-blue-600 text-white border-blue-600" : "bg-white text-[#334155] border-[#CBD5E1] hover:border-blue-400"}`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
              <Button onClick={() => { void generateReport(selectedReportType); }} disabled={isGenerating} className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90">
                {isGenerating ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {isGenerating ? "Generating..." : "Generate & Download"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={() => setShowScheduleModal(false)}>
          <Card className="bg-white border border-[#E2E8F0] rounded-xl p-6 w-[480px] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#0F172A]">Create Report Schedule</h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 rounded text-[#64748B] hover:text-[#334155] hover:bg-[#F1F5F9]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[#334155]">Schedule Label</Label>
                <Input
                  value={scheduleForm.label}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g. Weekly Occupancy Report"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#334155]">Report Type</Label>
                <Select value={scheduleForm.reportType} onValueChange={(v) => setScheduleForm((prev) => ({ ...prev, reportType: v as ReportKey }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_OPTIONS.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[#334155]">Format</Label>
                  <Select value={scheduleForm.format} onValueChange={(v) => setScheduleForm((prev) => ({ ...prev, format: v as ExportFormat }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["csv", "xlsx", "pdf", "json"] as const).map((fmt) => (
                        <SelectItem key={fmt} value={fmt}>{fmt.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[#334155]">Frequency</Label>
                  <Select value={scheduleForm.frequency} onValueChange={(v) => setScheduleForm((prev) => ({ ...prev, frequency: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#334155]">Recipient Emails (optional, comma-separated)</Label>
                <Input
                  value={scheduleForm.recipientEmails}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, recipientEmails: e.target.value }))}
                  placeholder="admin@company.com, finance@company.com"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
              <Button onClick={() => void createSchedule()} disabled={isCreatingSchedule} className="bg-[#0B5FFF] text-white hover:bg-[#0B5FFF]/90">
                {isCreatingSchedule ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                {isCreatingSchedule ? "Creating..." : "Create Schedule"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
