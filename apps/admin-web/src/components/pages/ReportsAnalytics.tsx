import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart2, TrendingUp, TrendingDown, Download,
  RefreshCw, ChevronDown, Calendar, SlidersHorizontal,
  FileText, DollarSign, Activity,
  AlertTriangle, Shield, Settings, Home, LogIn,
} from "lucide-react";
import { StatCard } from "../StatCard";
import apiClient from "../../lib/api-client";

// ─── Types ────────────────────────────────────────────────────

type DateRange = "7d" | "30d" | "90d" | "12m" | "custom";

type KpiCard = {
  key: string; label: string; value: string | number;
  change?: number; icon: "revenue" | "active-users" | "tickets" | "devices" | "complaints-total" | "complaints-open";
};

type ChartPoint = { label: string; value: number; secondary?: number };

type ReportSection = {
  id: string; title: string; description: string; icon: React.ReactNode;
  data: ChartPoint[]; color: string; secondaryColor?: string;
  secondaryLabel?: string; primaryLabel?: string;
};

// ─── Helpers ──────────────────────────────────────────────────

const formatNum = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
    n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

const formatChange = (c: number): string => `${c >= 0 ? "+" : ""}${c.toFixed(1)}%`;

/** Convert an array of ChartPoints to CSV content and trigger a download. */
function exportSectionCsv(title: string, data: ChartPoint[], primaryLabel?: string, secondaryLabel?: string) {
  const hasSecondary = data.some((d) => d.secondary !== undefined);
  const header = hasSecondary
    ? `Label,${primaryLabel || "Value"},${secondaryLabel || "Secondary"}`
    : `Label,${primaryLabel || "Value"}`;
  const rows = data.map((d) =>
    hasSecondary ? `"${d.label}",${d.value},${d.secondary ?? ""}` : `"${d.label}",${d.value}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/\s+/g, "_").toLowerCase()}_report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Mini bar chart ───────────────────────────────────────────

function BarChart({ data, color, secondaryColor, height = 120 }: {
  data: ChartPoint[]; color: string; secondaryColor?: string; height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "100%", paddingBottom: "20px" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "2px", cursor: "pointer", position: "relative" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            {/* Tooltip */}
            {hovered === i && (
              <div style={{ position: "absolute", bottom: "calc(100% - 16px)", left: "50%", transform: "translateX(-50%)", background: "#111827", color: "#FFF", borderRadius: "5px", padding: "4px 8px", fontSize: "10.5px", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none" }}>
                {d.label}: {formatNum(d.value)}{d.secondary !== undefined ? ` / ${formatNum(d.secondary)}` : ""}
              </div>
            )}
            {secondaryColor && d.secondary !== undefined && (
              <div style={{ width: "100%", borderRadius: "3px 3px 0 0", background: secondaryColor, height: `${(d.secondary / maxVal) * 100}%`, opacity: hovered === i ? 1 : 0.7, transition: "height 400ms ease, opacity 150ms" }} />
            )}
            <div style={{ width: "100%", borderRadius: secondaryColor ? "3px 3px 0 0" : "3px 3px 0 0", background: color, height: `${(d.value / maxVal) * 100}%`, opacity: hovered === i ? 1 : 0.85, transition: "height 400ms ease, opacity 150ms" }} />
          </div>
        ))}
      </div>
      {/* X axis labels */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", gap: "3px" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "9.5px", color: "#9CA3AF", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Report card (with per-section export) ────────────────────

function ReportCard({ section }: { section: ReportSection }) {
  const [collapsed, setCollapsed] = useState(false);
  const total = section.data.reduce((s, d) => s + d.value, 0);
  const latest = section.data[section.data.length - 1]?.value ?? 0;
  const prev = section.data[section.data.length - 2]?.value ?? 0;
  const change = prev > 0 ? ((latest - prev) / prev) * 100 : 0;

  return (
    <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: collapsed ? "none" : "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => setCollapsed((p) => !p)}>
        <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `${section.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {section.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0 }}>{section.title}</p>
          <p style={{ fontSize: "11.5px", color: "#9CA3AF", margin: "1px 0 0" }}>{section.description}</p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ fontSize: "17px", fontWeight: 900, color: "#111827", margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: "-0.02em" }}>{formatNum(total)}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "3px", marginTop: "1px" }}>
            {change >= 0
              ? <TrendingUp style={{ width: "10px", height: "10px", color: "#059669" }} />
              : <TrendingDown style={{ width: "10px", height: "10px", color: "#DC2626" }} />}
            <span style={{ fontSize: "11px", fontWeight: 700, color: change >= 0 ? "#059669" : "#DC2626", fontFamily: "'DM Mono', monospace" }}>{formatChange(change)}</span>
          </div>
        </div>
        {/* Per-section CSV export */}
        <button
          type="button"
          title={`Export ${section.title} as CSV`}
          onClick={(e) => { e.stopPropagation(); exportSectionCsv(section.title, section.data, section.primaryLabel, section.secondaryLabel); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FAFAFA", cursor: "pointer", flexShrink: 0, padding: 0 }}
        >
          <Download style={{ width: "12px", height: "12px", color: "#6B7280" }} />
        </button>
        <ChevronDown style={{ width: "14px", height: "14px", color: "#9CA3AF", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 150ms", flexShrink: 0 }} />
      </div>

      {!collapsed && (
        <div style={{ padding: "14px 16px" }}>
          <BarChart data={section.data} color={section.color} secondaryColor={section.secondaryColor} />
          {(section.primaryLabel || section.secondaryLabel) && (
            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              {section.primaryLabel && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: section.color, display: "inline-block" }} />
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>{section.primaryLabel}</span>
                </div>
              )}
              {section.secondaryLabel && section.secondaryColor && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: section.secondaryColor, display: "inline-block" }} />
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>{section.secondaryLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export button (global) ──────────────────────────────────

function ExportButton({ onExport, loading }: { onExport: () => void; loading: boolean }) {
  return (
    <button type="button" onClick={onExport} disabled={loading}
      style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", background: "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: loading ? 0.6 : 1 }}>
      <Download style={{ width: "13px", height: "13px" }} />
      Export All CSV
    </button>
  );
}

// ─── Safe fetch helper ───────────────────────────────────────

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const { data } = await apiClient.get<T>(url);
    return data;
  } catch {
    return fallback;
  }
}

// ─── Main ─────────────────────────────────────────────────────

export function ReportsAnalytics() {
  const [range, setRange] = useState<DateRange>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [sections, setSections] = useState<ReportSection[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all stats in parallel
      const [
        complaintStats,
        violationStats,
        serviceStats,
        rentalStats,
        gateStats,
        reportStats,
        facilityStats,
        surveyStats,
      ] = await Promise.all([
        safeFetch<{
          total: number; open: number; resolved: number; closed: number;
          slaBreached: number; avgResolutionHours: number;
          byPriority: Record<string, number>;
          byCategory: { categoryName: string; count: number }[];
          byStatus: Record<string, number>;
        }>("/complaints/stats", {
          total: 0, open: 0, resolved: 0, closed: 0,
          slaBreached: 0, avgResolutionHours: 0,
          byPriority: {}, byCategory: [], byStatus: {},
        }),
        safeFetch<{
          total: number; pending: number; paid: number; appealed: number;
          cancelled: number; pendingAppeals: number;
          totalFinesIssued: number; totalFinesCollected: number;
          byCategory: { categoryName: string; count: number; totalFines: number }[];
        }>("/violations/stats", {
          total: 0, pending: 0, paid: 0, appealed: 0,
          cancelled: 0, pendingAppeals: 0,
          totalFinesIssued: 0, totalFinesCollected: 0, byCategory: [],
        }),
        safeFetch<{
          totalServices: number; activeServices: number; totalRequests: number;
          openRequests: number; slaBreachedRequests: number;
          resolvedThisMonth: number; totalRevenue: number;
          requestsByCategory: Record<string, number>;
        }>("/services/stats", {
          totalServices: 0, activeServices: 0, totalRequests: 0,
          openRequests: 0, slaBreachedRequests: 0,
          resolvedThisMonth: 0, totalRevenue: 0, requestsByCategory: {},
        }),
        safeFetch<{
          activeLeases: number; expiringThisMonth: number; expiredLeases: number;
          pendingRentRequests: number; totalMonthlyRevenue: number; leasingEnabled: boolean;
        }>("/rental/stats", {
          activeLeases: 0, expiringThisMonth: 0, expiredLeases: 0,
          pendingRentRequests: 0, totalMonthlyRevenue: 0, leasingEnabled: false,
        }),
        safeFetch<{
          totalGates: number; activeGates: number; todayEntries: number;
          currentlyInside: number; todayVisitors: number; todayDeliveries: number;
        }>("/gates/stats", {
          totalGates: 0, activeGates: 0, todayEntries: 0,
          currentlyInside: 0, todayVisitors: 0, todayDeliveries: 0,
        }),
        safeFetch<{
          totalGenerated: number; generatedThisMonth: number;
          activeSchedules: number; lastGeneratedAt: string | null;
        }>("/reports/stats", {
          totalGenerated: 0, generatedThisMonth: 0,
          activeSchedules: 0, lastGeneratedAt: null,
        }),
        safeFetch<{
          totalFacilities: number; activeFacilities: number; bookingsToday: number;
          pendingApprovals: number; revenueThisMonth: number;
          bookingsByFacility: { facilityName: string; totalBookings: number; revenue: number }[];
          bookingsByStatus: Record<string, number>;
        }>("/facilities/stats", {
          totalFacilities: 0, activeFacilities: 0, bookingsToday: 0,
          pendingApprovals: 0, revenueThisMonth: 0,
          bookingsByFacility: [], bookingsByStatus: {},
        }),
        safeFetch<{
          total: number; active: number; draft: number; closed: number;
          totalResponses: number; avgResponseRate: number;
        }>("/surveys/stats", {
          total: 0, active: 0, draft: 0, closed: 0,
          totalResponses: 0, avgResponseRate: 0,
        }),
      ]);

      // ── KPI cards from real data ──
      const totalRevenue = rentalStats.totalMonthlyRevenue + serviceStats.totalRevenue + facilityStats.revenueThisMonth;
      const totalOpenRequests = complaintStats.open + serviceStats.openRequests;
      const avgResHours = complaintStats.avgResolutionHours;

      setKpis([
        { key: "revenue", label: "Total Revenue", value: `EGP ${formatNum(totalRevenue)}`, icon: "revenue" },
        { key: "residents", label: "Active Leases", value: formatNum(rentalStats.activeLeases), icon: "active-users" },
        { key: "requests", label: "Open Requests", value: formatNum(totalOpenRequests), icon: "complaints-open" },
        { key: "response", label: "Avg Resolution", value: avgResHours > 0 ? `${avgResHours.toFixed(1)}h` : "N/A", icon: "tickets" },
      ]);

      // ── Build report sections from API data ──
      const builtSections: ReportSection[] = [];

      // 1. Revenue (rental + services + facilities)
      builtSections.push({
        id: "revenue", title: "Revenue", description: "Rental income, service revenue and facility bookings",
        icon: <DollarSign style={{ width: "14px", height: "14px", color: "#059669" }} />,
        data: [
          { label: "Rental", value: rentalStats.totalMonthlyRevenue },
          { label: "Services", value: serviceStats.totalRevenue },
          { label: "Facilities", value: facilityStats.revenueThisMonth },
          { label: "Fines Collected", value: violationStats.totalFinesCollected },
        ],
        color: "#059669",
      });

      // 2. Complaints Stats
      const complaintCategories = complaintStats.byCategory.length > 0
        ? complaintStats.byCategory.map((c) => ({ label: c.categoryName, value: c.count }))
        : Object.entries(complaintStats.byStatus).map(([status, count]) => ({ label: status, value: count as number }));
      if (complaintCategories.length === 0) {
        complaintCategories.push(
          { label: "Open", value: complaintStats.open },
          { label: "Resolved", value: complaintStats.resolved },
          { label: "Closed", value: complaintStats.closed },
          { label: "SLA Breached", value: complaintStats.slaBreached },
        );
      }
      builtSections.push({
        id: "complaints", title: "Complaints", description: `${complaintStats.total} total — ${complaintStats.open} open, ${complaintStats.resolved} resolved`,
        icon: <AlertTriangle style={{ width: "14px", height: "14px", color: "#F59E0B" }} />,
        data: complaintCategories,
        color: "#F59E0B",
      });

      // 3. Violations Stats
      const violationCategories = violationStats.byCategory.length > 0
        ? violationStats.byCategory.map((c) => ({ label: c.categoryName, value: c.count, secondary: c.totalFines }))
        : [
            { label: "Pending", value: violationStats.pending },
            { label: "Paid", value: violationStats.paid },
            { label: "Appealed", value: violationStats.appealed },
            { label: "Cancelled", value: violationStats.cancelled },
          ];
      builtSections.push({
        id: "violations", title: "Violations", description: `${violationStats.total} total — EGP ${formatNum(violationStats.totalFinesIssued)} fines issued`,
        icon: <Shield style={{ width: "14px", height: "14px", color: "#DC2626" }} />,
        data: violationCategories,
        color: "#DC2626",
        ...(violationStats.byCategory.length > 0 ? { secondaryColor: "#FCA5A5", primaryLabel: "Count", secondaryLabel: "Fine Amount" } : {}),
      });

      // 4. Service Performance
      const serviceCategories = Object.entries(serviceStats.requestsByCategory);
      const serviceData: ChartPoint[] = serviceCategories.length > 0
        ? serviceCategories.map(([cat, count]) => ({ label: cat, value: count as number }))
        : [
            { label: "Open", value: serviceStats.openRequests },
            { label: "Resolved", value: serviceStats.resolvedThisMonth },
            { label: "SLA Breached", value: serviceStats.slaBreachedRequests },
          ];
      builtSections.push({
        id: "services", title: "Service Performance", description: `${serviceStats.totalRequests} total requests — ${serviceStats.openRequests} open`,
        icon: <Settings style={{ width: "14px", height: "14px", color: "#2563EB" }} />,
        data: serviceData,
        color: "#2563EB",
      });

      // 5. Occupancy / Rental Stats
      builtSections.push({
        id: "occupancy", title: "Occupancy & Leases", description: `${rentalStats.activeLeases} active leases — ${rentalStats.expiringThisMonth} expiring soon`,
        icon: <Home style={{ width: "14px", height: "14px", color: "#7C3AED" }} />,
        data: [
          { label: "Active", value: rentalStats.activeLeases },
          { label: "Expiring", value: rentalStats.expiringThisMonth },
          { label: "Expired", value: rentalStats.expiredLeases },
          { label: "Pending Req.", value: rentalStats.pendingRentRequests },
        ],
        color: "#7C3AED",
      });

      // 6. Gate Entry Logs
      builtSections.push({
        id: "gates", title: "Gate Entry Logs", description: `${gateStats.totalGates} gates — ${gateStats.todayEntries} entries today`,
        icon: <LogIn style={{ width: "14px", height: "14px", color: "#0891B2" }} />,
        data: [
          { label: "Today Entries", value: gateStats.todayEntries },
          { label: "Currently In", value: gateStats.currentlyInside },
          { label: "Visitors", value: gateStats.todayVisitors },
          { label: "Deliveries", value: gateStats.todayDeliveries },
        ],
        color: "#0891B2",
      });

      // 7. Facility Bookings
      const facilityData: ChartPoint[] = facilityStats.bookingsByFacility.length > 0
        ? facilityStats.bookingsByFacility.map((f) => ({ label: f.facilityName, value: f.totalBookings, secondary: f.revenue }))
        : [
            { label: "Today", value: facilityStats.bookingsToday },
            { label: "Pending", value: facilityStats.pendingApprovals },
            { label: "Active Fac.", value: facilityStats.activeFacilities },
          ];
      builtSections.push({
        id: "facilities", title: "Facility Bookings", description: `${facilityStats.totalFacilities} facilities — ${facilityStats.bookingsToday} bookings today`,
        icon: <Activity style={{ width: "14px", height: "14px", color: "#059669" }} />,
        data: facilityData,
        color: "#059669",
        ...(facilityStats.bookingsByFacility.length > 0 ? { secondaryColor: "#6EE7B7", primaryLabel: "Bookings", secondaryLabel: "Revenue" } : {}),
      });

      // 8. Survey Responses
      builtSections.push({
        id: "surveys", title: "Survey Responses", description: `${surveyStats.total} surveys — ${surveyStats.avgResponseRate.toFixed(0)}% avg response rate`,
        icon: <BarChart2 style={{ width: "14px", height: "14px", color: "#0D9488" }} />,
        data: [
          { label: "Active", value: surveyStats.active },
          { label: "Draft", value: surveyStats.draft },
          { label: "Closed", value: surveyStats.closed },
          { label: "Responses", value: surveyStats.totalResponses },
        ],
        color: "#0D9488",
      });

      // 9. Reports Generated
      builtSections.push({
        id: "reports", title: "Generated Reports", description: `${reportStats.totalGenerated} total — ${reportStats.activeSchedules} active schedules`,
        icon: <FileText style={{ width: "14px", height: "14px", color: "#6366F1" }} />,
        data: [
          { label: "Total", value: reportStats.totalGenerated },
          { label: "This Month", value: reportStats.generatedThisMonth },
          { label: "Schedules", value: reportStats.activeSchedules },
        ],
        color: "#6366F1",
      });

      setSections(builtSections);
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      // Export all sections into a single CSV
      const lines: string[] = [];
      for (const section of sections) {
        const hasSecondary = section.data.some((d) => d.secondary !== undefined);
        lines.push(`"${section.title}"`);
        lines.push(hasSecondary ? "Label,Value,Secondary" : "Label,Value");
        for (const d of section.data) {
          lines.push(hasSecondary ? `"${d.label}",${d.value},${d.secondary ?? ""}` : `"${d.label}",${d.value}`);
        }
        lines.push(""); // blank separator
      }
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analytics_report_all.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report exported successfully");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "7px", border: "1px solid #E5E7EB",
    fontSize: "12.5px", color: "#111827", background: "#FFF", outline: "none",
    fontFamily: "'Work Sans', sans-serif", height: "34px", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {/* ── Header ─── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>Reports & Analytics</h1>
          <p style={{ marginTop: "4px", fontSize: "13px", color: "#6B7280" }}>Platform-wide performance metrics and trend analysis.</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={() => void load()} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", background: "#FFF", color: "#374151", border: "1px solid #E5E7EB", cursor: loading ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "'Work Sans', sans-serif", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw style={{ width: "13px", height: "13px", animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          <ExportButton onExport={() => void handleExportAll()} loading={exporting} />
        </div>
      </div>

      {/* ── KPI cards ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {kpis.map((k) => <StatCard key={k.key} icon={k.icon} title={k.label} value={String(k.value)} />)}
      </div>

      {/* ── Filter bar ─── */}
      <div style={{ borderRadius: "10px", border: "1px solid #EBEBEB", background: "#FFF", overflow: "hidden", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: filtersOpen && range === "custom" ? "1px solid #F3F4F6" : "none" }}>
          <Calendar style={{ width: "13px", height: "13px", color: "#9CA3AF", flexShrink: 0 }} />
          <span style={{ fontSize: "12.5px", color: "#6B7280", fontWeight: 500 }}>Time range:</span>
          <div style={{ display: "flex", gap: "4px" }}>
            {(["7d", "30d", "90d", "12m", "custom"] as DateRange[]).map((r) => (
              <button key={r} type="button" onClick={() => { setRange(r); if (r !== "custom") setFiltersOpen(false); else setFiltersOpen(true); }}
                style={{ padding: "4px 10px", borderRadius: "5px", fontSize: "11.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", cursor: "pointer", border: `1px solid ${range === r ? "#2563EB40" : "#E5E7EB"}`, background: range === r ? "#EFF6FF" : "#FAFAFA", color: range === r ? "#2563EB" : "#6B7280", transition: "all 120ms ease" }}>
                {r === "7d" ? "7 days" : r === "30d" ? "30 days" : r === "90d" ? "90 days" : r === "12m" ? "12 months" : "Custom"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setFiltersOpen((p) => !p)}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", border: "1px solid #E5E7EB", background: "#FAFAFA", color: "#6B7280", fontSize: "11.5px", fontWeight: 600, cursor: "pointer", fontFamily: "'Work Sans', sans-serif" }}>
            <SlidersHorizontal style={{ width: "11px", height: "11px" }} />
            Filters
            <ChevronDown style={{ width: "10px", height: "10px", transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
          </button>
        </div>
        {filtersOpen && (
          <div style={{ padding: "10px 14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>From</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...inputStyle, width: "140px" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "10.5px", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>To</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...inputStyle, width: "140px" }} />
            </div>
            <button type="button" onClick={() => void load()}
              style={{ alignSelf: "flex-end", padding: "7px 14px", borderRadius: "7px", background: "#111827", color: "#FFF", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, fontFamily: "'Work Sans', sans-serif", height: "34px" }}>
              Apply
            </button>
          </div>
        )}
      </div>

      {/* ── Report sections ─── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: "68px", borderRadius: "10px", background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)", backgroundSize: "200% 100%" }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {sections.map((s) => <ReportCard key={s.id} section={s} />)}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
