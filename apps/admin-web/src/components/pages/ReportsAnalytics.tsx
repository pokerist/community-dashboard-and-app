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
  FileIcon,
  MoreVertical,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

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
  {
    key: "occupancy",
    label: "Occupancy Report",
    description: "Unit occupancy and block utilization analysis",
    icon: Building2,
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
  },
  {
    key: "financial",
    label: "Financial Summary",
    description: "Invoices, revenue, and payment status overview",
    icon: DollarSign,
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
  },
  {
    key: "complaints",
    label: "Complaints Report",
    description: "Complaints grouped by category and resolution status",
    icon: MessageCircle,
    bgColor: "bg-amber-500/10",
    textColor: "text-amber-400",
  },
  {
    key: "service_requests",
    label: "Service Requests Report",
    description: "Service requests by type, priority, and status",
    icon: Wrench,
    bgColor: "bg-purple-500/10",
    textColor: "text-purple-400",
  },
  {
    key: "violations",
    label: "Violations Report",
    description: "Violations and fines tracking by resident",
    icon: AlertTriangle,
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
  },
  {
    key: "visitor_traffic",
    label: "Visitor Traffic Report",
    description: "Access QR generation and gate usage activity",
    icon: Users,
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
  },
  {
    key: "maintenance_costs",
    label: "Maintenance Cost Analysis",
    description: "Maintenance invoices and cost breakdown",
    icon: Wrench,
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-400",
  },
  {
    key: "security_incidents",
    label: "Security Incidents Report",
    description: "Incidents tracking and resolution status",
    icon: AlertTriangle,
    bgColor: "bg-red-600/10",
    textColor: "text-red-500",
  },
  {
    key: "gate_entry_log",
    label: "Gate Entry Log Report",
    description: "Access records and gate operations history",
    icon: DoorOpen,
    bgColor: "bg-indigo-500/10",
    textColor: "text-indigo-400",
  },
  {
    key: "resident_activity",
    label: "Resident Activity Report",
    description: "Per-resident activity summary and metrics",
    icon: Activity,
    bgColor: "bg-pink-500/10",
    textColor: "text-pink-400",
  },
];

function toBackendReportType(key: ReportKey): string {
  switch (key) {
    case "occupancy":
      return "OCCUPANCY";
    case "financial":
      return "FINANCIAL";
    case "service_requests":
      return "SERVICE_REQUESTS";
    case "security_incidents":
      return "SECURITY_INCIDENTS";
    case "visitor_traffic":
      return "VISITOR_TRAFFIC";
    case "maintenance_costs":
      return "MAINTENANCE_COSTS";
    case "complaints":
      return "COMPLAINTS";
    case "violations":
      return "VIOLATIONS";
    case "gate_entry_log":
      return "GATE_ENTRY_LOG";
    case "resident_activity":
      return "RESIDENT_ACTIVITY";
    default:
      return "OCCUPANCY";
  }
}

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

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await apiClient.get("/reports/stats");
      setStats(res.data);
    } catch (error) {
      toast.error("Failed to load stats", { description: errorMessage(error) });
    }
  }, []);

  // Load reports history
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

  // Load schedules
  const loadSchedules = useCallback(async () => {
    try {
      const res = await apiClient.get("/reports/schedules", { params: { limit: 30 } });
      setSchedules(extractRows<ScheduleRow>(res.data?.data || []));
    } catch (error) {
      toast.error("Failed to load schedules", { description: errorMessage(error) });
    }
  }, []);

  // Generate report
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

        // Download the file
        try {
          const downloadRes = await apiClient.get(`/reports/${reportId}/download`, {
            responseType: "blob",
          });
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
          // Fallback
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

  // Download report
  const downloadReport = useCallback(async (reportId: string, filename: string) => {
    try {
      const res = await apiClient.get(`/reports/${reportId}/download`, {
        responseType: "blob",
      });
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

  // Toggle schedule
  const toggleSchedule = useCallback(
    async (scheduleId: string, enable: boolean) => {
      try {
        await apiClient.patch(`/reports/schedules/${scheduleId}/toggle`, {
          isEnabled: enable,
        });
        await loadSchedules();
        toast.success(enable ? "Schedule enabled" : "Schedule paused");
      } catch (error) {
        toast.error("Failed to toggle schedule", { description: errorMessage(error) });
      }
    },
    [loadSchedules],
  );

  // Run schedule now
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

  useEffect(() => {
    void loadStats();
    void loadHistory();
    void loadSchedules();
  }, [loadStats, loadHistory, loadSchedules]);

  // Get format badge color
  const getFormatBadgeColor = (format: string) => {
    const f = format.toLowerCase();
    if (f === "csv") return "bg-emerald-500/20 text-emerald-300";
    if (f === "xlsx") return "bg-blue-500/20 text-blue-300";
    if (f === "pdf") return "bg-red-500/20 text-red-300";
    return "bg-amber-500/20 text-amber-300";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1117] to-[#161b22]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0f1117]/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Reports & Analytics</h1>
              <p className="text-slate-400 text-sm">Generate, download, and schedule automated reports</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loadStats();
                void loadHistory();
                void loadSchedules();
              }}
              disabled={isLoading}
              className="border-white/10 text-white hover:bg-white/5"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 -mb-4">
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === "reports"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Reports
            </button>
            <button
              onClick={() => setActiveTab("schedules")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === "schedules"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-300"
              }`}
            >
              <CalendarClock className="w-4 h-4 inline mr-2" />
              Schedules
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "reports" ? (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-[#161b22]/50 border-white/10 p-6 rounded-xl hover:border-white/20 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-medium">Total Generated</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.totalGenerated}</p>
                  </div>
                  <FileText className="w-10 h-10 text-blue-400/30" />
                </div>
              </Card>

              <Card className="bg-[#161b22]/50 border-white/10 p-6 rounded-xl hover:border-white/20 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-medium">This Month</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.generatedThisMonth}</p>
                  </div>
                  <CalendarClock className="w-10 h-10 text-emerald-400/30" />
                </div>
              </Card>

              <Card className="bg-[#161b22]/50 border-white/10 p-6 rounded-xl hover:border-white/20 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-medium">Active Schedules</p>
                    <p className="text-3xl font-bold text-white mt-2">{stats.activeSchedules}</p>
                  </div>
                  <CheckCircle2 className="w-10 h-10 text-amber-400/30" />
                </div>
              </Card>

              <Card className="bg-[#161b22]/50 border-white/10 p-6 rounded-xl hover:border-white/20 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-medium">Last Generated</p>
                    <p className="text-sm font-medium text-white mt-2">
                      {stats.lastGeneratedAt ? formatDateTime(stats.lastGeneratedAt) : "—"}
                    </p>
                  </div>
                  <RefreshCw className="w-10 h-10 text-cyan-400/30" />
                </div>
              </Card>
            </div>

            {/* Report Type Cards Grid */}
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-2">Available Reports</h2>
                <p className="text-slate-400 text-sm">Click any card to generate an instant report</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {REPORT_OPTIONS.map(({ key, label, description, icon: Icon, bgColor, textColor }) => (
                  <Card
                    key={key}
                    className="bg-[#161b22]/50 border-white/10 p-5 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition cursor-pointer group"
                    onClick={() => {
                      setSelectedReportType(key);
                      setShowGenerateModal(true);
                    }}
                  >
                    <div className={`w-10 h-10 rounded-lg ${bgColor} flex items-center justify-center mb-4`}>
                      <Icon className={`w-5 h-5 ${textColor}`} />
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">{label}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{description}</p>
                    <div className="mt-4 flex items-center gap-1 text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition">
                      <Download className="w-3 h-3" />
                      <span>Generate</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Recent Reports Table */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4">Generated Reports</h2>
              <Card className="bg-[#161b22]/50 border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-slate-400">Report Name</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                        <TableHead className="text-slate-400">Format</TableHead>
                        <TableHead className="text-slate-400 text-right">Rows</TableHead>
                        <TableHead className="text-slate-400">Generated</TableHead>
                        <TableHead className="text-slate-400 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.length === 0 ? (
                        <TableRow className="border-white/10 hover:bg-white/5">
                          <TableCell colSpan={6} className="text-center py-12">
                            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
                            <p className="text-slate-400">No reports generated yet</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        history.map((report) => (
                          <TableRow key={report.id} className="border-white/10 hover:bg-white/5 transition">
                            <TableCell className="text-white font-medium">{report.label}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{humanizeEnum(report.reportType)}</TableCell>
                            <TableCell>
                              <Badge className={getFormatBadgeColor(report.format)}>
                                {report.format.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-right font-medium">{report.rowCount}</TableCell>
                            <TableCell className="text-slate-400 text-sm">{formatDateTime(report.generatedAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void downloadReport(report.id, report.filename)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Report Schedules</h2>
                <p className="text-slate-400 text-sm mt-1">Manage automatic report generation schedules</p>
              </div>
              <Button
                onClick={() => setShowScheduleModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Create Schedule
              </Button>
            </div>

            <div className="grid gap-4">
              {schedules.length === 0 ? (
                <Card className="bg-[#161b22]/50 border-white/10 rounded-xl p-12 text-center">
                  <CalendarClock className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-400">No schedules created yet</p>
                </Card>
              ) : (
                schedules.map((schedule) => (
                  <Card
                    key={schedule.id}
                    className="bg-[#161b22]/50 border-white/10 rounded-xl p-5 hover:border-white/20 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-white font-semibold">{schedule.label}</p>
                          <Badge className={schedule.isEnabled ? "bg-green-500/20 text-green-300" : "bg-slate-500/20 text-slate-300"}>
                            {schedule.isEnabled ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
                          <span>{humanizeEnum(schedule.reportType)}</span>
                          <span>•</span>
                          <span>{schedule.format.toUpperCase()}</span>
                          <span>•</span>
                          <span>{schedule.frequency}</span>
                          <span>•</span>
                          <span>Next: {schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : "—"}</span>
                        </div>
                        {schedule.recipientEmails && schedule.recipientEmails.length > 0 && (
                          <div className="text-xs text-slate-500 mt-2">
                            📧 {schedule.recipientEmails.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void runScheduleNow(schedule.id)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void toggleSchedule(schedule.id, !schedule.isEnabled)}
                          className={schedule.isEnabled ? "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10" : "text-green-400 hover:text-green-300 hover:bg-green-500/10"}
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
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <Card className="bg-[#161b22] border-white/20 rounded-2xl p-8 w-[420px] shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                Generate {REPORT_OPTIONS.find((r) => r.key === selectedReportType)?.label}
              </h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">Date Range</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="To"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Export Format</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(["csv", "xlsx", "pdf", "json"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition ${
                        exportFormat === fmt
                          ? "bg-blue-600 text-white"
                          : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => setShowGenerateModal(false)}
                className="border-white/10 text-slate-300 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void generateReport(selectedReportType);
                }}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGenerating ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {isGenerating ? "Generating..." : "Generate & Download"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
