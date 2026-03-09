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
import { DataTable, type DataTableColumn } from "../DataTable";
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
    if (selectedCard === "totalRegisteredDevices") return "Registered Devices";
    if (selectedCard === "activeMobileUsers")   return "Active Mobile Users";
    if (selectedCard === "totalComplaints")      return "Total Complaints";
    if (selectedCard === "closedComplaints")     return "Closed Complaints";
    if (selectedCard === "ticketsByStatus")      return "Tickets by Status";
    if (selectedCard === "occupancyRate")        return "Occupancy Rate";
    if (selectedCard === "blueCollarWorkers")    return "Blue Collar Workers";
    if (selectedCard === "totalCars")            return "Registered Vehicles";
    return "Detail View";
  }, [selectedCard]);

  return (
    <>
      {/* ── Page wrapper ──────────────────────────────────────────── */}
      <div style={{ background: "#F1F3F5", minHeight: "100vh", fontFamily: "'Work Sans', sans-serif" }}>

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
            boxShadow: "0 20px 60px rgba(7, 1, 1, 0.12)",
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
                {`Showing data for ${stats?.periodLabel ?? period}.`}
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
            {selectedCard === "totalRegisteredDevices" && kpis && (
              <DevicesDetailPanel android={kpis.totalRegisteredDevicesByPlatform.android} ios={kpis.totalRegisteredDevicesByPlatform.ios} total={kpis.totalRegisteredDevices} />
            )}
            {selectedCard === "activeMobileUsers" && kpis && (
              <ActiveUsersDetailPanel android={kpis.activeMobileUsersByPlatform.android} ios={kpis.activeMobileUsersByPlatform.ios} total={kpis.activeMobileUsers} totalDevices={kpis.totalRegisteredDevices} />
            )}
            {selectedCard === "totalComplaints" && kpis && (
              <TotalComplaintsDetailPanel open={kpis.openComplaints} closed={kpis.closedComplaints} total={kpis.totalComplaints} />
            )}
            {selectedCard === "closedComplaints" && kpis && (
              <ClosedComplaintsDetailPanel open={kpis.openComplaints} closed={kpis.closedComplaints} total={kpis.totalComplaints} />
            )}
            {selectedCard === "ticketsByStatus" && kpis && (
              <TicketsByStatusDetailPanel tickets={kpis.ticketsByStatus} />
            )}
            {selectedCard === "occupancyRate" && kpis && (
              <OccupancyRateDetailPanel rate={kpis.occupancyRate} />
            )}
            {selectedCard === "blueCollarWorkers" && kpis && (
              <SimpleCountPanel count={kpis.blueCollarWorkers} label="Blue collar workers currently registered in the system." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>} />
            )}
            {selectedCard === "totalCars" && kpis && (
              <SimpleCountPanel count={kpis.totalCars} label="Vehicles registered across all units in the community." icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h2M19 17l1 2h-2"/><circle cx="7.5" cy="13" r="1.5"/><circle cx="16.5" cy="13" r="1.5"/></svg>} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Drilldown table shell ────────────────────────────────────

// ─── Open Complaints ─────────────────────────────────────────

function OpenComplaintsTable({ rows, loading }: { rows: OpenComplaintDrilldownItem[]; loading: boolean }) {
  const cols: DataTableColumn<OpenComplaintDrilldownItem>[] = [
    { key: "num", header: "Number", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.complaintNumber}</span> },
    { key: "category", header: "Category", render: (r) => <span>{r.category}</span> },
    { key: "priority", header: "Priority", render: (r) => <span>{humanizeEnum(r.priority)}</span> },
    { key: "status", header: "Status", render: (r) => <span>{humanizeEnum(r.status)}</span> },
    { key: "unit", header: "Unit", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.unitNumber ?? "—"}</span> },
    { key: "created", header: "Created", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "#9CA3AF" }}>{formatDateTime(r.createdAt)}</span> },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={loading} emptyTitle="Nothing here — all clear" />;
}

// ─── Current Visitors ─────────────────────────────────────────

function CurrentVisitorsTable({ rows, loading }: { rows: CurrentVisitorDrilldownItem[]; loading: boolean }) {
  const cols: DataTableColumn<CurrentVisitorDrilldownItem>[] = [
    { key: "visitor", header: "Visitor", render: (r) => <span>{r.visitorName ?? "Visitor"}</span> },
    { key: "unit", header: "Unit", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.unitNumber ?? "—"}</span> },
    { key: "checkedIn", header: "Checked In", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.checkedInAt ? formatDateTime(r.checkedInAt) : "—"}</span> },
    { key: "validTo", header: "Valid To", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{formatDateTime(r.validTo)}</span> },
    { key: "relative", header: "Relative", render: (r) => <span style={{ color: "#9CA3AF" }}>{r.checkedInAt ? relativeTime(r.checkedInAt) : "—"}</span> },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={loading} emptyTitle="No visitors checked in right now" />;
}

// ─── Revenue ─────────────────────────────────────────────────

function RevenueTable({ rows, loading }: { rows: RevenueDrilldownItem[]; loading: boolean }) {
  const cols: DataTableColumn<RevenueDrilldownItem>[] = [
    { key: "invoice", header: "Invoice", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.invoiceNumber}</span> },
    { key: "amount", header: "Amount", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", fontWeight: 600, color: "#059669" }}>{formatCurrencyEGP(r.amount)}</span> },
    { key: "resident", header: "Resident", render: (r) => <span>{r.residentName ?? "—"}</span> },
    { key: "unit", header: "Unit", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px" }}>{r.unitNumber ?? "—"}</span> },
    { key: "paidAt", header: "Paid At", render: (r) => <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", color: "#9CA3AF" }}>{formatDateTime(r.paidDate)}</span> },
  ];
  return <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={loading} emptyTitle="No revenue records for this period" />;
}

// ─── Inline Detail Panels ─────────────────────────────────────

const MONO = "'DM Mono', monospace";
const SANS = "'Work Sans', sans-serif";

function PlatformBar({ android, ios, total }: { android: number; ios: number; total: number }) {
  const aPct = total > 0 ? (android / total) * 100 : 50;
  const iPct = total > 0 ? (ios / total) * 100 : 50;
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9CA3AF", marginBottom: "6px", fontFamily: SANS }}>
        <span>Android — {aPct.toFixed(1)}%</span>
        <span>iOS — {iPct.toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "#F3F4F6" }}>
        <div style={{ width: `${aPct}%`, background: "#34D399", borderRadius: "4px 0 0 4px", transition: "width 300ms ease" }} />
        <div style={{ width: `${iPct}%`, background: "#60A5FA", borderRadius: "0 4px 4px 0", transition: "width 300ms ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", fontFamily: SANS }}>
        <span style={{ color: "#34D399", fontWeight: 600 }}>■ Android</span>
        <span style={{ color: "#60A5FA", fontWeight: 600 }}>■ iOS</span>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
      <span style={{ fontSize: "13px", color: "#6B7280", fontFamily: SANS }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: 700, color: color ?? "#111827", fontFamily: MONO }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
    </div>
  );
}

function DevicesDetailPanel({ android, ios, total }: { android: number; ios: number; total: number }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, color: "#111827", fontFamily: MONO, letterSpacing: "-0.03em" }}>{total.toLocaleString()}</span>
        <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px", fontFamily: SANS }}>Total registered devices</p>
      </div>
      <StatRow label="Android devices" value={android} color="#059669" />
      <StatRow label="iOS devices" value={ios} color="#3B82F6" />
      <StatRow label="Total" value={total} />
      <PlatformBar android={android} ios={ios} total={total} />
    </div>
  );
}

function ActiveUsersDetailPanel({ android, ios, total, totalDevices }: { android: number; ios: number; total: number; totalDevices: number }) {
  const adoptionRate = totalDevices > 0 ? (total / totalDevices) * 100 : 0;
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, color: "#111827", fontFamily: MONO, letterSpacing: "-0.03em" }}>{total.toLocaleString()}</span>
        <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px", fontFamily: SANS }}>Active mobile users</p>
      </div>
      <StatRow label="Android users" value={android} color="#059669" />
      <StatRow label="iOS users" value={ios} color="#3B82F6" />
      <StatRow label="Total active" value={total} />
      <StatRow label="Adoption rate" value={`${adoptionRate.toFixed(1)}%`} color="#7C3AED" />
      <div style={{ marginTop: "12px", padding: "10px 14px", background: "#F5F3FF", borderRadius: "8px" }}>
        <p style={{ fontSize: "12px", color: "#7C3AED", fontFamily: SANS }}>
          <span style={{ fontWeight: 700 }}>{adoptionRate.toFixed(1)}%</span> of {totalDevices.toLocaleString()} registered devices are actively used.
        </p>
      </div>
      <PlatformBar android={android} ios={ios} total={total} />
    </div>
  );
}

function ComplaintsBar({ open, closed, total }: { open: number; closed: number; total: number }) {
  const openPct = total > 0 ? (open / total) * 100 : 0;
  const closedPct = total > 0 ? (closed / total) * 100 : 0;
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9CA3AF", marginBottom: "6px", fontFamily: SANS }}>
        <span>Open — {openPct.toFixed(1)}%</span>
        <span>Closed — {closedPct.toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "#F3F4F6" }}>
        <div style={{ width: `${openPct}%`, background: "#F59E0B", borderRadius: "4px 0 0 4px", transition: "width 300ms ease" }} />
        <div style={{ width: `${closedPct}%`, background: "#10B981", borderRadius: "0 4px 4px 0", transition: "width 300ms ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", fontFamily: SANS }}>
        <span style={{ color: "#F59E0B", fontWeight: 600 }}>■ Open</span>
        <span style={{ color: "#10B981", fontWeight: 600 }}>■ Closed</span>
      </div>
    </div>
  );
}

function TotalComplaintsDetailPanel({ open, closed, total }: { open: number; closed: number; total: number }) {
  const resolutionRate = total > 0 ? (closed / total) * 100 : 0;
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, color: "#111827", fontFamily: MONO, letterSpacing: "-0.03em" }}>{total.toLocaleString()}</span>
        <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px", fontFamily: SANS }}>Total complaints filed</p>
      </div>
      <StatRow label="Open complaints" value={open} color="#D97706" />
      <StatRow label="Closed complaints" value={closed} color="#059669" />
      <StatRow label="Resolution rate" value={`${resolutionRate.toFixed(1)}%`} color="#059669" />
      <ComplaintsBar open={open} closed={closed} total={total} />
    </div>
  );
}

function ClosedComplaintsDetailPanel({ open, closed, total }: { open: number; closed: number; total: number }) {
  const resolutionRate = total > 0 ? (closed / total) * 100 : 0;
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, color: "#059669", fontFamily: MONO, letterSpacing: "-0.03em" }}>{closed.toLocaleString()}</span>
        <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px", fontFamily: SANS }}>Complaints resolved</p>
      </div>
      <StatRow label="Closed" value={closed} color="#059669" />
      <StatRow label="Still open" value={open} color="#D97706" />
      <StatRow label="Total" value={total} />
      <StatRow label="Resolution rate" value={`${resolutionRate.toFixed(1)}%`} color="#059669" />
      <ComplaintsBar open={open} closed={closed} total={total} />
    </div>
  );
}

function TicketsByStatusDetailPanel({ tickets }: { tickets: Record<string, number> }) {
  const statusConfig: Array<{ key: string; label: string; color: string }> = [
    { key: "NEW", label: "New", color: "#3B82F6" },
    { key: "IN_PROGRESS", label: "In Progress", color: "#D97706" },
    { key: "RESOLVED", label: "Resolved", color: "#059669" },
    { key: "CLOSED", label: "Closed", color: "#6B7280" },
  ];
  const total = Object.values(tickets).reduce((s, v) => s + v, 0);

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <span style={{ fontSize: "40px", fontWeight: 800, color: "#111827", fontFamily: MONO, letterSpacing: "-0.03em" }}>{total.toLocaleString()}</span>
        <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "4px", fontFamily: SANS }}>Total tickets</p>
      </div>
      {statusConfig.map(({ key, label, color }) => {
        const count = tickets[key] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={key} style={{ marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <span style={{ fontSize: "13px", color: "#6B7280", fontFamily: SANS }}>{label}</span>
              <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: MONO, color }}>
                {count.toLocaleString()} <span style={{ fontWeight: 500, fontSize: "11px", color: "#9CA3AF" }}>({pct.toFixed(1)}%)</span>
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: "#F3F4F6", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 300ms ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OccupancyRateDetailPanel({ rate }: { rate: number }) {
  const pct = Math.min(100, Math.max(0, rate));
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? "#059669" : pct >= 50 ? "#D97706" : "#EF4444";

  return (
    <div style={{ padding: "16px 0", textAlign: "center" }}>
      <div style={{ position: "relative", width: "140px", height: "140px", margin: "0 auto" }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r="54" fill="none" stroke="#F3F4F6" strokeWidth="10" />
          <circle cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "28px", fontWeight: 800, color: "#111827", fontFamily: MONO, letterSpacing: "-0.03em" }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      <p style={{ marginTop: "16px", fontSize: "13px", color: "#6B7280", fontFamily: SANS }}>
        {pct >= 80 ? "High occupancy — community is well utilized." : pct >= 50 ? "Moderate occupancy — room for growth." : "Low occupancy — significant vacancies."}
      </p>
      <div style={{ marginTop: "16px", height: "8px", borderRadius: "4px", background: "#F3F4F6", overflow: "hidden", maxWidth: "320px", margin: "16px auto 0" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 300ms ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", maxWidth: "320px", margin: "6px auto 0", fontSize: "11px", color: "#9CA3AF", fontFamily: SANS }}>
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function SimpleCountPanel({ count, label, icon }: { count: number; label: string; icon: React.ReactNode }) {
  return (
    <div style={{ padding: "24px 0", textAlign: "center" }}>
      <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        {icon}
      </div>
      <span style={{ fontSize: "44px", fontWeight: 800, color: "#111827", fontFamily: MONO, letterSpacing: "-0.03em", display: "block" }}>{count.toLocaleString()}</span>
      <p style={{ marginTop: "8px", fontSize: "13px", color: "#9CA3AF", fontFamily: SANS, maxWidth: "280px", margin: "8px auto 0" }}>{label}</p>
    </div>
  );
}