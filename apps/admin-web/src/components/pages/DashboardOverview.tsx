import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActivityFeed } from "../ActivityFeed";
import { QuickActions } from "../QuickActions";
import { KpiGrid, KpiGridSkeleton } from "../StatCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import dashboardService, {
  CurrentVisitorDrilldownItem,
  DashboardPeriod,
  OpenComplaintDrilldownItem,
  RevenueDrilldownItem,
} from "../../lib/dashboard-service";
import {
  errorMessage,
  formatCurrencyEGP,
  formatDateTime,
  humanizeEnum,
  relativeTime,
} from "../../lib/live-data";

// ─── Live pulse ───────────────────────────────────────────────
function LiveDot({ fetching }: { fetching: boolean }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: "8px", height: "8px", alignItems: "center", justifyContent: "center" }}>
      {fetching && (
        <span style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          background: "#2563EB",
          opacity: 0.5,
          animation: "ping 1s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
      <span style={{
        width: "6px", height: "6px", borderRadius: "50%",
        background: fetching ? "#2563EB" : "#22C55E",
        display: "inline-block",
        flexShrink: 0,
      }} />
      <style>{`@keyframes ping { 75%,100%{ transform:scale(2); opacity:0 } }`}</style>
    </span>
  );
}

type DashboardCardKey =
  | "totalRegisteredDevices"
  | "activeMobileUsers"
  | "totalComplaints"
  | "openComplaints"
  | "closedComplaints"
  | "ticketsByStatus"
  | "revenueCurrentMonth"
  | "occupancyRate"
  | "currentVisitors"
  | "blueCollarWorkers"
  | "totalCars";

interface DashboardOverviewProps {
  onNavigate?: (section: string) => void;
}

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "MONTHLY",     label: "Monthly"     },
  { value: "QUARTERLY",   label: "Quarterly"   },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL",      label: "Annual"      },
];

export function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("MONTHLY");
  const [selectedCard, setSelectedCard] = useState<DashboardCardKey | null>(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const statsQuery = useQuery({
    queryKey: ["dashboard-stats", period],
    queryFn: () => dashboardService.getStats(period),
    refetchInterval: 10000,
  });

  const activityQuery = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: () => dashboardService.getActivity(),
    refetchInterval: 30000,
  });

  const openComplaintsDetailQuery = useQuery({
    queryKey: ["dashboard-open-complaints-drilldown", period],
    queryFn: () => dashboardService.getOpenComplaintsDrilldown(period, 20),
    enabled: selectedCard === "openComplaints",
  });

  const currentVisitorsDetailQuery = useQuery({
    queryKey: ["dashboard-current-visitors-drilldown", period],
    queryFn: () => dashboardService.getCurrentVisitorsDrilldown(period, 20),
    enabled: selectedCard === "currentVisitors",
  });

  const revenueDetailQuery = useQuery({
    queryKey: ["dashboard-revenue-drilldown", period],
    queryFn: () => dashboardService.getRevenueDrilldown(period, 20),
    enabled: selectedCard === "revenueCurrentMonth",
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (statsQuery.error) toast.error("Failed to load dashboard stats", { description: errorMessage(statsQuery.error) });
  }, [statsQuery.error]);

  useEffect(() => {
    if (activityQuery.error) toast.error("Failed to load activity", { description: errorMessage(activityQuery.error) });
  }, [activityQuery.error]);

  const stats = statsQuery.data;
  const kpis = stats?.kpis;
  const secondsSinceUpdate = statsQuery.dataUpdatedAt
    ? Math.max(0, Math.floor((clockNow - statsQuery.dataUpdatedAt) / 1000))
    : null;

  const detailTitle = useMemo(() => {
    if (!selectedCard) return "";
    if (selectedCard === "openComplaints")      return "Open Complaints";
    if (selectedCard === "currentVisitors")     return "Checked-In Visitors";
    if (selectedCard === "revenueCurrentMonth") return "Revenue Breakdown";
    return "Detail View";
  }, [selectedCard]);

  return (
    <>
      {/* ── Page wrapper ──────────────────────────────────────────── */}
      <div style={{ background: "#F5F4F1", minHeight: "100vh", fontFamily: "'Work Sans', sans-serif" }}>

        {/* ── Hero header bar ───────────────────────────────────────── */}
        <div style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #EBEBEB",
          padding: "20px 24px 0",
        }}>
          {/* Top row: title + headline KPIs */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>

            {/* Left: title + live dot */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "#111827",
                letterSpacing: "-0.025em",
                lineHeight: 1,
                fontFamily: "'Work Sans', sans-serif",
              }}>
                Dashboard
              </h1>
              <LiveDot fetching={statsQuery.isFetching} />
            </div>

            {/* Right: headline KPI chips — Codename-style large numbers */}
            {kpis && (
              <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
                {/* Active users */}
                <div style={{ textAlign: "right", padding: "0 20px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>
                      {kpis.activeMobileUsers.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "2px 7px", borderRadius: "5px" }}>
                      {kpis.activeMobileUsersByPlatform.android}A / {kpis.activeMobileUsersByPlatform.ios}i
                    </span>
                  </div>
                  <p style={{ marginTop: "4px", fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'Work Sans', sans-serif" }}>
                    Active Mobile Users
                  </p>
                </div>

                <div style={{ width: "1px", height: "40px", background: "#E5E7EB", alignSelf: "center" }} />

                {/* Open complaints */}
                <div style={{ textAlign: "right", padding: "0 20px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "32px", fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>
                      {kpis.openComplaints.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#D97706", background: "#FEF3C7", padding: "2px 7px", borderRadius: "5px" }}>
                      of {kpis.totalComplaints}
                    </span>
                  </div>
                  <p style={{ marginTop: "4px", fontSize: "11.5px", color: "#9CA3AF", fontFamily: "'Work Sans', sans-serif" }}>
                    Open Complaints
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom row: period tabs + sync status + refresh */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "0" }}>
            {/* Period tab strip */}
            <div style={{ display: "flex", alignItems: "center", gap: "2px", background: "#F3F4F6", borderRadius: "7px", padding: "3px" }}>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  style={{
                    padding: "5px 12px",
                    fontSize: "12.5px",
                    fontWeight: period === opt.value ? 600 : 500,
                    color: period === opt.value ? "#111827" : "#6B7280",
                    background: period === opt.value ? "#FFFFFF" : "transparent",
                    borderRadius: "5px",
                    border: "none",
                    cursor: "pointer",
                    boxShadow: period === opt.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 120ms ease",
                    fontFamily: "'Work Sans', sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sync status */}
            <span style={{ fontSize: "11.5px", color: statsQuery.isFetching ? "#2563EB" : "#9CA3AF", fontFamily: "'Work Sans', sans-serif" }}>
              {statsQuery.isFetching
                ? "Syncing…"
                : secondsSinceUpdate !== null
                  ? <span>Updated <span style={{ fontFamily: "'DM Mono', monospace" }}>{secondsSinceUpdate}s</span> ago</span>
                  : null
              }
            </span>

            {/* Refresh button */}
            <button
              type="button"
              onClick={() => void statsQuery.refetch()}
              disabled={statsQuery.isFetching}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "5px 12px",
                fontSize: "12px", fontWeight: 600,
                color: "#6B7280",
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "border-color 120ms, color 120ms",
                fontFamily: "'Work Sans', sans-serif",
                opacity: statsQuery.isFetching ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#D1D5DB"; (e.currentTarget as HTMLButtonElement).style.color = "#111827"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLButtonElement).style.color = "#6B7280"; }}
            >
              {statsQuery.isFetching ? (
                <svg style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite" }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                  <path fill="currentColor" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg style={{ width: "13px", height: "13px" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 01-9 9M3 12a9 9 0 019-9M21 12H17M7 12H3" strokeLinecap="round" />
                </svg>
              )}
              Refresh
            </button>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </div>

          {/* Tab underline indicator */}
          <div style={{ height: "2px", background: "#2563EB", width: "60px", borderRadius: "2px 2px 0 0", marginTop: "12px", opacity: 0 }} />
        </div>

        {/* ── Main content ──────────────────────────────────────────── */}
        <div style={{ padding: "24px" }}>

          {/* KPI Grid */}
          {statsQuery.isLoading ? (
            <KpiGridSkeleton />
          ) : kpis && stats ? (
            <KpiGrid
              kpis={kpis}
              periodLabel={stats.periodLabel}
              onCardClick={(key) => setSelectedCard(key as DashboardCardKey)}
            />
          ) : null}

          {/* ── Operations section ──────────────────────────────────── */}
          <div style={{ marginTop: "32px" }}>

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Icon */}
                <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1, letterSpacing: "-0.01em", fontFamily: "'Work Sans', sans-serif" }}>
                    Operations
                  </h2>
                  <p style={{ marginTop: "3px", fontSize: "11.5px", color: "#9CA3AF" }}>
                    Live activity and quick actions
                  </p>
                </div>
              </div>

              {!activityQuery.isLoading && (activityQuery.data?.length ?? 0) > 0 && (
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#9CA3AF", fontFamily: "'DM Mono', monospace", background: "#F3F4F6", padding: "3px 8px", borderRadius: "5px" }}>
                  {activityQuery.data!.length} events
                </span>
              )}
            </div>

            {/* Two-col layout: activity feed + quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 288px", gap: "16px", alignItems: "start" }}>
              <ActivityFeed
                activities={activityQuery.data ?? []}
                loading={activityQuery.isLoading}
              />
              <QuickActions onNavigate={onNavigate} />
            </div>
          </div>

        </div>{/* end main content */}
      </div>{/* end page wrapper */}

      {/* ── Drilldown Modal ───────────────────────────────────────── */}
      <Dialog open={selectedCard !== null} onOpenChange={(open: any) => !open && setSelectedCard(null)}>
        <DialogContent
          style={{
            maxWidth: "860px",
            borderRadius: "10px",
            border: "1px solid #EBEBEB",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            fontFamily: "'Work Sans', sans-serif",
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/* Modal header */}
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F3F4F6" }}>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: "16px", color: "#111827" }}>
                {detailTitle}
              </DialogTitle>
              <DialogDescription style={{ fontSize: "12.5px", color: "#9CA3AF", marginTop: "3px" }}>
                {selectedCard === "openComplaints" || selectedCard === "currentVisitors" || selectedCard === "revenueCurrentMonth"
                  ? `Latest records for ${stats?.periodLabel ?? period}.`
                  : "Detail view coming soon for this metric."}
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Modal body */}
          <div style={{ padding: "16px 24px 24px" }}>
            {selectedCard === "openComplaints" && (
              <OpenComplaintsTable rows={openComplaintsDetailQuery.data ?? []} loading={openComplaintsDetailQuery.isLoading} />
            )}
            {selectedCard === "currentVisitors" && (
              <CurrentVisitorsTable rows={currentVisitorsDetailQuery.data ?? []} loading={currentVisitorsDetailQuery.isLoading} />
            )}
            {selectedCard === "revenueCurrentMonth" && (
              <RevenueTable rows={revenueDetailQuery.data ?? []} loading={revenueDetailQuery.isLoading} />
            )}
            {selectedCard !== "openComplaints" && selectedCard !== "currentVisitors" && selectedCard !== "revenueCurrentMonth" && (
              <div style={{ padding: "32px 0", textAlign: "center" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <p style={{ fontSize: "13.5px", fontWeight: 600, color: "#6B7280" }}>Detail view coming soon</p>
                <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px" }}>Drill-down for this metric is under construction.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Drilldown table shell ────────────────────────────────────

function DrilldownSkeleton({ cols }: { cols: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ height: "36px", borderRadius: "5px", background: "linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

// ─── Table shared styles ──────────────────────────────────────

const tableWrap: React.CSSProperties = {
  maxHeight: "420px",
  overflowY: "auto",
  borderRadius: "8px",
  border: "1px solid #EBEBEB",
};

const thStyle: React.CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#9CA3AF",
  background: "#F9FAFB",
  padding: "8px 14px",
  borderBottom: "1px solid #EBEBEB",
  fontFamily: "'Work Sans', sans-serif",
};

const tdStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#374151",
  padding: "10px 14px",
  borderBottom: "1px solid #F3F4F6",
  fontFamily: "'Work Sans', sans-serif",
};

const tdMono: React.CSSProperties = {
  ...tdStyle,
  fontFamily: "'DM Mono', monospace",
  fontSize: "12px",
};

// ─── Open Complaints ─────────────────────────────────────────

function OpenComplaintsTable({ rows, loading }: { rows: OpenComplaintDrilldownItem[]; loading: boolean }) {
  if (loading) return <DrilldownSkeleton cols={6} />;
  return (
    <div style={tableWrap}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Number", "Category", "Priority", "Status", "Unit", "Created"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", padding: "32px" }}>Nothing here — all clear.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id} style={{ transition: "background 100ms" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
            >
              <td style={tdMono}>{row.complaintNumber}</td>
              <td style={tdStyle}>{row.category}</td>
              <td style={tdStyle}>{humanizeEnum(row.priority)}</td>
              <td style={tdStyle}>{humanizeEnum(row.status)}</td>
              <td style={tdMono}>{row.unitNumber ?? "—"}</td>
              <td style={{ ...tdMono, color: "#9CA3AF" }}>{formatDateTime(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Current Visitors ─────────────────────────────────────────

function CurrentVisitorsTable({ rows, loading }: { rows: CurrentVisitorDrilldownItem[]; loading: boolean }) {
  if (loading) return <DrilldownSkeleton cols={5} />;
  return (
    <div style={tableWrap}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Visitor", "Unit", "Checked In", "Valid To", "Relative"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", padding: "32px" }}>No visitors checked in right now.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id}
              onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
            >
              <td style={tdStyle}>{row.visitorName ?? "Visitor"}</td>
              <td style={tdMono}>{row.unitNumber ?? "—"}</td>
              <td style={tdMono}>{row.checkedInAt ? formatDateTime(row.checkedInAt) : "—"}</td>
              <td style={tdMono}>{formatDateTime(row.validTo)}</td>
              <td style={{ ...tdStyle, color: "#9CA3AF" }}>{row.checkedInAt ? relativeTime(row.checkedInAt) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Revenue ─────────────────────────────────────────────────

function RevenueTable({ rows, loading }: { rows: RevenueDrilldownItem[]; loading: boolean }) {
  if (loading) return <DrilldownSkeleton cols={5} />;
  return (
    <div style={tableWrap}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Invoice", "Amount", "Resident", "Unit", "Paid At"].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#9CA3AF", padding: "32px" }}>No revenue records for this period.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id}
              onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
            >
              <td style={tdMono}>{row.invoiceNumber}</td>
              <td style={{ ...tdMono, fontWeight: 600, color: "#059669" }}>{formatCurrencyEGP(row.amount)}</td>
              <td style={tdStyle}>{row.residentName ?? "—"}</td>
              <td style={tdMono}>{row.unitNumber ?? "—"}</td>
              <td style={{ ...tdMono, color: "#9CA3AF" }}>{formatDateTime(row.paidDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}