import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import apiClient from "../../lib/api-client";
import { errorMessage, extractRows, formatCurrencyEGP, formatDateTime, humanizeEnum } from "../../lib/live-data";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type ReportKey =
  | "occupancy"
  | "financial"
  | "service_requests"
  | "security_incidents"
  | "visitor_traffic"
  | "maintenance_costs";

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
  cronExpr?: string | null;
  isEnabled: boolean;
  status: string;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  createdAt: string;
};

type ScheduleForm = {
  reportKey: ReportKey;
  format: ExportFormat;
  frequency: string;
  nextRunAt: string;
};

const REPORT_OPTIONS: Array<{ key: ReportKey; label: string; description: string }> = [
  { key: "occupancy", label: "Occupancy Report", description: "Unit occupancy and block utilization" },
  { key: "financial", label: "Financial Summary", description: "Invoices and revenue summary" },
  { key: "service_requests", label: "Service Request Analysis", description: "Requests grouped by service/status" },
  { key: "security_incidents", label: "Security Incident Report", description: "Incidents and current statuses" },
  { key: "visitor_traffic", label: "Visitor Traffic Report", description: "Access QR generation activity" },
  { key: "maintenance_costs", label: "Maintenance Cost Analysis", description: "Maintenance-related invoices and requests" },
] as const;

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "message\nNo rows";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escapeValue = (value: unknown) => {
    const raw =
      value === null || value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escapeValue(row[h])).join(",")),
  ];
  return lines.join("\n");
}

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
    default:
      return "OCCUPANCY";
  }
}

export function ReportsAnalytics() {
  const [reportKey, setReportKey] = useState<ReportKey>("occupancy");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false);
  const [isScheduleSubmitting, setIsScheduleSubmitting] = useState(false);
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    reportKey: "occupancy",
    format: "csv",
    frequency: "DAILY",
    nextRunAt: "",
  });
  const [dataset, setDataset] = useState<{
    summary: any | null;
    revenue: any;
    occupancy: any;
    invoices: any[];
    serviceRequests: any[];
    incidents: any[];
    accessQrs: any[];
  }>({
    summary: null,
    revenue: null,
    occupancy: null,
    invoices: [],
    serviceRequests: [],
    incidents: [],
    accessQrs: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadReportHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await apiClient.get("/reports/history", { params: { page: 1, limit: 20 } });
      setHistory(extractRows<HistoryRow>(res.data));
    } catch (error) {
      toast.error("Failed to load report history", { description: errorMessage(error) });
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    setIsSchedulesLoading(true);
    try {
      const res = await apiClient.get("/reports/schedules/list", { params: { limit: 30 } });
      setSchedules(extractRows<ScheduleRow>(res.data));
    } catch (error) {
      toast.error("Failed to load report schedules", { description: errorMessage(error) });
    } finally {
      setIsSchedulesLoading(false);
    }
  }, []);

  const createSchedule = useCallback(async () => {
    setIsScheduleSubmitting(true);
    try {
      const report = REPORT_OPTIONS.find((r) => r.key === scheduleForm.reportKey);
      await apiClient.post("/reports/schedule", {
        reportType: toBackendReportType(scheduleForm.reportKey),
        format: scheduleForm.format.toUpperCase(),
        label: report?.label,
        frequency: scheduleForm.frequency,
        nextRunAt: scheduleForm.nextRunAt ? new Date(scheduleForm.nextRunAt).toISOString() : undefined,
        dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : undefined,
        dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
      });
      toast.success("Report schedule created");
      await loadSchedules();
    } catch (error) {
      toast.error("Failed to create report schedule", { description: errorMessage(error) });
    } finally {
      setIsScheduleSubmitting(false);
    }
  }, [dateFrom, dateTo, loadSchedules, scheduleForm]);

  const toggleSchedule = useCallback(async (row: ScheduleRow, nextEnabled: boolean) => {
    setTogglingScheduleId(row.id);
    try {
      await apiClient.patch(`/reports/schedules/${row.id}`, { isEnabled: nextEnabled });
      toast.success(`Schedule ${nextEnabled ? "enabled" : "paused"}`);
      await loadSchedules();
    } catch (error) {
      toast.error("Failed to update schedule", { description: errorMessage(error) });
    } finally {
      setTogglingScheduleId(null);
    }
  }, [loadSchedules]);

  const runScheduleNow = useCallback(async (row: ScheduleRow) => {
    setRunningScheduleId(row.id);
    try {
      const res = await apiClient.post(`/reports/schedules/${row.id}/run-now`);
      toast.success("Schedule executed", {
        description: `Generated report ${res.data?.generatedReportId ?? ""}`.trim(),
      });
      await Promise.all([loadSchedules(), loadReportHistory()]);
    } catch (error) {
      toast.error("Failed to run schedule", { description: errorMessage(error) });
    } finally {
      setRunningScheduleId(null);
    }
  }, [loadReportHistory, loadSchedules]);

  const downloadGeneratedReport = useCallback(async (reportId: string, fallbackFilename?: string) => {
    const response = await apiClient.get(`/reports/${reportId}/download`, { responseType: "blob" });
    const contentDisposition = String(response.headers?.["content-disposition"] ?? "");
    const matchedName = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition)?.[1];
    const filename = matchedName || fallbackFilename || `report-${reportId}.dat`;
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  const loadReportSources = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [summaryRes, revenueRes, occupancyRes, invoicesRes, serviceReqRes, incidentsRes, accessRes] =
        await Promise.all([
          apiClient.get("/dashboard/summary"),
          apiClient.get("/dashboard/revenue"),
          apiClient.get("/dashboard/occupancy"),
          apiClient.get("/invoices"),
          apiClient.get("/service-requests"),
          apiClient.get("/incidents/list", { params: { page: 1, limit: 100 } }),
          apiClient.get("/access-qrcodes"),
        ]);

      setDataset({
        summary: summaryRes.data ?? null,
        revenue: revenueRes.data ?? null,
        occupancy: occupancyRes.data ?? null,
        invoices: extractRows(invoicesRes.data),
        serviceRequests: extractRows(serviceReqRes.data),
        incidents: extractRows(incidentsRes.data),
        accessQrs: extractRows(accessRes.data),
      });
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load report sources", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReportSources();
  }, [loadReportSources]);

  useEffect(() => {
    void loadReportHistory();
  }, [loadReportHistory]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const stats = useMemo(() => {
    const paidInvoices = dataset.invoices.filter((i: any) => String(i.status).toUpperCase() === "PAID");
    const totalRevenue = paidInvoices.reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0);
    return {
      invoices: dataset.invoices.length,
      serviceRequests: dataset.serviceRequests.length,
      incidents: dataset.incidents.length,
      qrs: dataset.accessQrs.length,
      totalRevenue,
    };
  }, [dataset]);

  const withinRange = useCallback(
    (value?: string | null) => {
      if (!dateFrom && !dateTo) return true;
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && date > new Date(`${dateTo}T23:59:59.999`)) return false;
      return true;
    },
    [dateFrom, dateTo],
  );

  const buildRows = useCallback(
    (key: ReportKey): Record<string, unknown>[] => {
      switch (key) {
        case "occupancy": {
          const byLocation = Array.isArray(dataset.occupancy?.byLocation) ? dataset.occupancy.byLocation : [];
          return byLocation.map((row: any) => ({
            projectName: row.projectName ?? "",
            block: row.block ?? "",
            totalUnits: Number(row.totalUnits ?? 0),
            occupiedUnits: Number(row.occupiedUnits ?? 0),
            vacantUnits: Number(row.vacantUnits ?? 0),
            occupancyRate: Number(row.occupancyRate ?? 0),
          }));
        }
        case "financial":
          return dataset.invoices
            .filter((invoice: any) => withinRange(invoice.paidDate ?? invoice.dueDate ?? invoice.createdAt))
            .map((invoice: any) => ({
              invoiceNumber: invoice.invoiceNumber ?? invoice.id,
              type: invoice.type ?? "",
              status: invoice.status ?? "",
              amount: Number(invoice.amount ?? 0),
              dueDate: invoice.dueDate ?? "",
              paidDate: invoice.paidDate ?? "",
              unitId: invoice.unitId ?? "",
              residentId: invoice.residentId ?? "",
            }));
        case "service_requests":
          return dataset.serviceRequests
            .filter((request: any) => withinRange(request.createdAt))
            .map((request: any) => ({
              id: request.id,
              serviceName: request.service?.name ?? "",
              category: request.category ?? "",
              status: request.status ?? "",
              priority: request.priority ?? "",
              createdAt: request.createdAt ?? "",
              unitId: request.unitId ?? "",
              requesterId: request.requesterId ?? "",
            }));
        case "security_incidents":
          return dataset.incidents
            .filter((incident: any) => withinRange(incident.reportedAt ?? incident.createdAt))
            .map((incident: any) => ({
              incidentNumber: incident.incidentNumber ?? incident.id,
              type: incident.type ?? "",
              status: incident.status ?? "",
              severity: incident.severity ?? "",
              reportedAt: incident.reportedAt ?? incident.createdAt ?? "",
              location: incident.location ?? "",
            }));
        case "visitor_traffic":
          return dataset.accessQrs
            .filter((qr: any) => withinRange(qr.createdAt ?? qr.generatedAt))
            .map((qr: any) => ({
              id: qr.id,
              type: qr.type ?? qr.accessType ?? "",
              status: qr.status ?? "",
              validFrom: qr.validFrom ?? "",
              validTo: qr.validTo ?? "",
              createdAt: qr.createdAt ?? qr.generatedAt ?? "",
              unitId: qr.unitId ?? "",
            }));
        case "maintenance_costs": {
          const maintenanceInvoices = dataset.invoices.filter((invoice: any) => {
            const type = String(invoice.type ?? "").toUpperCase();
            return type.includes("MAINTENANCE") || type === "SERVICE_FEE";
          });
          return maintenanceInvoices
            .filter((invoice: any) => withinRange(invoice.paidDate ?? invoice.dueDate ?? invoice.createdAt))
            .map((invoice: any) => ({
              invoiceNumber: invoice.invoiceNumber ?? invoice.id,
              type: invoice.type ?? "",
              amount: Number(invoice.amount ?? 0),
              status: invoice.status ?? "",
              dueDate: invoice.dueDate ?? "",
              linkedServiceRequestId: invoice.serviceRequestId ?? "",
            }));
        }
      }
    },
    [dataset, withinRange],
  );

  const generateReport = useCallback(
    async (key: ReportKey, format: ExportFormat) => {
      const report = REPORT_OPTIONS.find((r) => r.key === key);
      const label = report?.label ?? key;
      setIsGenerating(true);
      try {
        const generated = await apiClient.post("/reports/generate", {
          reportType: toBackendReportType(key),
          format: format.toUpperCase(),
          label,
          dateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : undefined,
          dateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
        });

        const data = generated.data ?? {};
        if (!data.id) {
          throw new Error("Report generation succeeded but no report ID was returned");
        }

        await downloadGeneratedReport(String(data.id), data.filename);
        await loadReportHistory();

        toast.success("Report generated", {
          description: `${label} exported as ${String(data.format ?? format).toUpperCase()} (${Number(data.rowCount ?? 0)} rows).`,
        });
      } catch (error) {
        toast.error("Failed to generate report", { description: errorMessage(error) });
      } finally {
        setIsGenerating(false);
      }
    },
    [dateFrom, dateTo, downloadGeneratedReport, loadReportHistory],
  );

  const previewRows = useMemo(() => buildRows(reportKey).slice(0, 10), [buildRows, reportKey]);
  const schedulePreviewLabel = useMemo(
    () => REPORT_OPTIONS.find((r) => r.key === scheduleForm.reportKey)?.label ?? humanizeEnum(scheduleForm.reportKey),
    [scheduleForm.reportKey],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Reports & Analytics</h1>
          <p className="text-[#64748B] mt-1">
            Backend-generated reports with stored export history, plus live preview from source endpoints.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadReportSources()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]">{loadError}</Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4"><p className="text-xs text-[#64748B]">Invoices</p><p className="text-2xl mt-2">{stats.invoices}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#64748B]">Service Requests</p><p className="text-2xl mt-2">{stats.serviceRequests}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#64748B]">Incidents</p><p className="text-2xl mt-2">{stats.incidents}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#64748B]">QR Access Rows</p><p className="text-2xl mt-2">{stats.qrs}</p></Card>
        <Card className="p-4"><p className="text-xs text-[#64748B]">Paid Revenue</p><p className="text-2xl mt-2">{formatCurrencyEGP(stats.totalRevenue)}</p></Card>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="text-[#1E293B]">Generate Custom Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="xl:col-span-2 space-y-2">
            <Label>Report Type</Label>
            <Select value={reportKey} onValueChange={(value) => setReportKey(value as ReportKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="xlsx">XLSX</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white" onClick={() => void generateReport(reportKey, exportFormat)} disabled={isGenerating}>
            <Download className="w-4 h-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate & Download"}
          </Button>
          {REPORT_OPTIONS.map((option) => (
            <Button key={option.key} variant="outline" onClick={() => void generateReport(option.key, "csv")} disabled={isGenerating}>
              <FileText className="w-4 h-4 mr-2" />
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-[#64748B]">
          Preview below is generated from live API payloads in this page; actual exports are generated and stored by backend `/reports`.
        </p>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="p-6 xl:col-span-2">
          <h3 className="text-[#1E293B] mb-1">
            {REPORT_OPTIONS.find((r) => r.key === reportKey)?.label}
          </h3>
          <p className="text-sm text-[#64748B] mb-4">
            {REPORT_OPTIONS.find((r) => r.key === reportKey)?.description}
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  {previewRows[0]
                    ? Object.keys(previewRows[0]).map((key) => <TableHead key={key}>{humanizeEnum(key)}</TableHead>)
                    : <TableHead>Preview</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, index) => (
                  <TableRow key={index}>
                    {Object.keys(previewRows[0] ?? { preview: "" }).map((key) => (
                      <TableCell key={`${index}-${key}`} className="text-xs">
                        {row[key] === null || row[key] === undefined ? "—" : String(row[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {previewRows.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-8 text-center text-[#64748B]">
                      No rows available for the selected report/date range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#1E293B]">Recent Exports</h3>
              <Button variant="outline" size="sm" onClick={() => void loadReportHistory()} disabled={isHistoryLoading}>
                {isHistoryLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#E5E7EB] p-3">
                  <div className="text-sm font-medium text-[#1E293B]">{item.label}</div>
                  <div className="text-xs text-[#64748B] mt-1">
                    {item.filename} • {item.rowCount} rows
                  </div>
                  <div className="text-xs text-[#64748B] mt-1">
                    {formatDateTime(item.generatedAt)}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Badge variant="secondary">{String(item.format).toUpperCase()}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void downloadGeneratedReport(item.id, item.filename)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
              {history.length === 0 ? (
                <div className="text-sm text-[#64748B]">No exports generated yet.</div>
              ) : null}
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[#1E293B]">Report Schedules</h3>
              <Button variant="outline" size="sm" onClick={() => void loadSchedules()} disabled={isSchedulesLoading}>
                {isSchedulesLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>

            <div className="rounded-lg border border-[#E5E7EB] p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-[#1E293B]">
                <CalendarClock className="w-4 h-4 text-[#0B5FFF]" />
                Create Schedule
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label>Report</Label>
                  <Select
                    value={scheduleForm.reportKey}
                    onValueChange={(value) => setScheduleForm((s) => ({ ...s, reportKey: value as ReportKey }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_OPTIONS.map((option) => (
                        <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select
                      value={scheduleForm.format}
                      onValueChange={(value) => setScheduleForm((s) => ({ ...s, format: value as ExportFormat }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="xlsx">XLSX</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={scheduleForm.frequency}
                      onValueChange={(value) => setScheduleForm((s) => ({ ...s, frequency: value }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Next Run (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={scheduleForm.nextRunAt}
                    onChange={(e) => setScheduleForm((s) => ({ ...s, nextRunAt: e.target.value }))}
                  />
                </div>
                <div className="text-xs text-[#64748B]">
                  Schedule will use current date filters if set. Selected report: {schedulePreviewLabel}
                </div>
                <Button
                  className="bg-[#0B5FFF] hover:bg-[#0B5FFF]/90 text-white"
                  onClick={() => void createSchedule()}
                  disabled={isScheduleSubmitting}
                >
                  {isScheduleSubmitting ? "Creating..." : "Create Schedule"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {schedules.map((row) => (
                <div key={row.id} className="rounded-lg border border-[#E5E7EB] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#1E293B] truncate">{row.label}</div>
                      <div className="text-xs text-[#64748B] mt-1">
                        {humanizeEnum(row.reportType)} • {String(row.format).toUpperCase()} • {humanizeEnum(row.frequency)}
                      </div>
                      <div className="text-xs text-[#64748B] mt-1">
                        Next: {formatDateTime(row.nextRunAt)} • Last: {formatDateTime(row.lastRunAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={row.isEnabled ? "bg-[#10B981]/10 text-[#10B981]" : "bg-[#F59E0B]/10 text-[#F59E0B]"}>
                        {row.isEnabled ? "Enabled" : "Paused"}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={runningScheduleId === row.id}
                          onClick={() => void runScheduleNow(row)}
                        >
                          {runningScheduleId === row.id ? "Running..." : "Run Now"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={togglingScheduleId === row.id}
                          onClick={() => void toggleSchedule(row, !row.isEnabled)}
                        >
                          {togglingScheduleId === row.id ? "Updating..." : row.isEnabled ? "Pause" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {schedules.length === 0 ? (
                <div className="text-sm text-[#64748B]">No schedules created yet.</div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
