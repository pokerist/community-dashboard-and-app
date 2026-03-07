import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity } from "lucide-react";
import { ActivityFeed } from "../ActivityFeed";
import { QuickActions } from "../QuickActions";
import { StatCard } from "../StatCard";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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

/* ── Live pulse indicator ─────────────────────────────────────── */
function LivePulse({ fetching }: { fetching: boolean }) {
  return (
    <span className="relative flex h-2 w-2 items-center justify-center">
      {fetching && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-60" />
      )}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${fetching ? "bg-[#2563EB]" : "bg-[#22C55E]"}`} />
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
  { value: "MONTHLY",     label: "Monthly"    },
  { value: "QUARTERLY",   label: "Quarterly"  },
  { value: "SEMI_ANNUAL", label: "Semi-Annual"},
  { value: "ANNUAL",      label: "Annual"     },
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
    if (statsQuery.error) {
      toast.error("Failed to load dashboard stats", { description: errorMessage(statsQuery.error) });
    }
  }, [statsQuery.error]);

  useEffect(() => {
    if (activityQuery.error) {
      toast.error("Failed to load dashboard activity", { description: errorMessage(activityQuery.error) });
    }
  }, [activityQuery.error]);

  const stats = statsQuery.data;
  const kpis = stats?.kpis;
  const secondsSinceUpdate = statsQuery.dataUpdatedAt
    ? Math.max(0, Math.floor((clockNow - statsQuery.dataUpdatedAt) / 1000))
    : null;

  const cards = useMemo(() => {
    if (!kpis) return [];

    const ticketsSummary = `New ${kpis.ticketsByStatus.NEW}  ·  In Progress ${kpis.ticketsByStatus.IN_PROGRESS}  ·  Resolved ${kpis.ticketsByStatus.RESOLVED}`;

    return [
      {
        key: "totalRegisteredDevices" as const,
        title: "Registered Devices",
        value: String(kpis.totalRegisteredDevices),
        subtitle: `Android ${kpis.totalRegisteredDevicesByPlatform.android}  ·  iOS ${kpis.totalRegisteredDevicesByPlatform.ios}`,
        icon: "devices" as const,
      },
      {
        key: "activeMobileUsers" as const,
        title: "Active Mobile Users",
        value: String(kpis.activeMobileUsers),
        subtitle: `Android ${kpis.activeMobileUsersByPlatform.android}  ·  iOS ${kpis.activeMobileUsersByPlatform.ios}`,
        icon: "active-users" as const,
      },
      {
        key: "totalComplaints" as const,
        title: "Total Complaints",
        value: String(kpis.totalComplaints),
        subtitle: `Period: ${stats.periodLabel}`,
        icon: "complaints-total" as const,
      },
      {
        key: "openComplaints" as const,
        title: "Open Complaints",
        value: String(kpis.openComplaints),
        subtitle: "Click to view open list",
        icon: "complaints-open" as const,
      },
      {
        key: "closedComplaints" as const,
        title: "Closed Complaints",
        value: String(kpis.closedComplaints),
        subtitle: `Period: ${stats.periodLabel}`,
        icon: "complaints-closed" as const,
      },
      {
        key: "ticketsByStatus" as const,
        title: "Tickets by Status",
        value: String(kpis.totalComplaints),
        subtitle: ticketsSummary,
        icon: "tickets" as const,
      },
      {
        key: "revenueCurrentMonth" as const,
        title: "Revenue",
        value: formatCurrencyEGP(kpis.revenueCurrentMonth),
        subtitle: `Paid invoices · ${stats.periodLabel}`,
        icon: "revenue" as const,
      },
      {
        key: "occupancyRate" as const,
        title: "Occupancy Rate",
        value: `${kpis.occupancyRate.toFixed(1)}%`,
        subtitle: "Occupied / total active units",
        icon: "occupancy" as const,
      },
      {
        key: "currentVisitors" as const,
        title: "Current Visitors",
        value: String(kpis.currentVisitors),
        subtitle: "Click to view checked-in visitors",
        icon: "visitors" as const,
      },
      {
        key: "blueCollarWorkers" as const,
        title: "Blue Collar Workers",
        value: String(kpis.blueCollarWorkers),
        subtitle: "Active workers on compound",
        icon: "workers" as const,
      },
      {
        key: "totalCars" as const,
        title: "Registered Vehicles",
        value: String(kpis.totalCars),
        subtitle: "Resident-registered vehicles",
        icon: "cars" as const,
      },
    ];
  }, [kpis, stats?.periodLabel]);

  const detailTitle = useMemo(() => {
    if (!selectedCard) return "";
    if (selectedCard === "openComplaints")     return "Open Complaints";
    if (selectedCard === "currentVisitors")    return "Checked-In Visitors";
    if (selectedCard === "revenueCurrentMonth") return "Revenue Breakdown";
    return "Detail View";
  }, [selectedCard]);

  /* ── Skeleton KPI grid while loading ── */
  const showSkeleton = statsQuery.isLoading;

  return (
    <>
      {/* ── Display header — reference style ────────────────────── */}
      <div className="flex items-start justify-between px-6 pt-8 pb-6 border-b border-[#E5E7EB] bg-white">
        {/* Left: huge title + period row */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold text-[#111827] mb-1">
              Dashboard
            </h1>
            <LivePulse fetching={statsQuery.isFetching} />
          </div>

          {/* Period selector row */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex items-center gap-1 bg-[#F3F4F6] rounded p-0.5">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={
                    period === option.value
                      ? "px-3 py-1.5 text-[13px] font-medium bg-white text-[#111827] rounded shadow-sm"
                      : "px-3 py-1.5 text-[13px] font-medium text-[#6B7280] rounded hover:text-[#111827] transition-colors"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Last updated / syncing */}
            <span className="text-[11.5px] text-[#9CA3AF]">
              {statsQuery.isFetching ? (
                <span className="text-[#2563EB]">Syncing…</span>
              ) : secondsSinceUpdate !== null ? (
                <>
                  Updated{" "}
                  <span style={{ fontFamily: "'DM Mono', monospace" }}>{secondsSinceUpdate}s</span> ago
                </>
              ) : null}
            </span>

            <button
              type="button"
              onClick={() => void statsQuery.refetch()}
              disabled={statsQuery.isFetching}
              className="flex items-center gap-1.5 rounded-[4px] border border-[#E5E7EB] bg-white px-3 py-[6px] text-[11.5px] font-semibold text-[#6B7280] transition-colors hover:border-[#D1D5DB] hover:text-[#111827] disabled:opacity-40"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              {statsQuery.isFetching ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 01-9 9M3 12a9 9 0 019-9M21 12H17M7 12H3" strokeLinecap="round" />
                </svg>
              )}
              Refresh
            </button>
          </div>
        </div>

        {/* Right: headline KPI widgets (reference-style large numbers) */}
        {kpis && (
          <div className="flex items-start gap-8">
            {/* Active Users */}
            <div className="text-right">
              <div className="flex items-baseline gap-2 justify-end">
                <span
                  className="text-[40px] font-extrabold text-[#111827] leading-none tracking-[-0.025em]"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {kpis.activeMobileUsers.toLocaleString()}
                </span>
                <span className="rounded-[4px] bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                  {kpis.activeMobileUsersByPlatform.android}A / {kpis.activeMobileUsersByPlatform.ios}i
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[#9CA3AF]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Active Mobile Users
              </p>
            </div>

            {/* Divider */}
            <div className="h-12 w-px bg-[#E5E7EB] self-start mt-1" />

            {/* Open Complaints */}
            <div className="text-right">
              <div className="flex items-baseline gap-2 justify-end">
                <span
                  className="text-[40px] font-extrabold text-[#111827] leading-none tracking-[-0.025em]"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {kpis.openComplaints.toLocaleString()}
                </span>
                <span className="rounded-[4px] bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#D97706]">
                  of {kpis.totalComplaints}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[#9CA3AF]" style={{ fontFamily: "'Work Sans', sans-serif" }}>
                Open Complaints
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-2 space-y-5">

      {/* KPI grid */}
      {showSkeleton ? (
        <div className="grid grid-cols-4 gap-4 xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-[108px] animate-pulse rounded-[6px] bg-[#F5F4F1] border border-[#EBEBEB]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1">
          {cards.map((card) => (
            <StatCard
              key={card.key}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              onClick={() => setSelectedCard(card.key)}
            />
          ))}
        </div>
      )}
      </div>{/* end px-6 section */}

      {/* ── Operations section ─────────────────────────────────────── */}
      <div className="px-6 pb-6 mt-8">
        {/* Section header row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#EFF6FF]">
              <Activity className="h-4 w-4 text-[#2563EB]" />
            </div>
            <div>
              <h2
                className="text-[15px] font-semibold text-[#111827] leading-none"
                style={{ fontFamily: "'Work Sans', sans-serif" }}
              >
                Operations
              </h2>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                Live activity and quick actions
              </p>
            </div>
          </div>
          {!activityQuery.isLoading && (activityQuery.data?.length ?? 0) > 0 && (
            <span
              className="text-[11px] font-medium text-[#9CA3AF]"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {activityQuery.data!.length} recent events
            </span>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
          <ActivityFeed
            activities={activityQuery.data ?? []}
            loading={activityQuery.isLoading}
          />
          <QuickActions onNavigate={onNavigate} />
        </div>
      </div>

      {/* ── Drilldown Modal ────────────────────────────────────────── */}
      <Dialog open={selectedCard !== null} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Work Sans', sans-serif", fontWeight: 700 }}>
              {detailTitle}
            </DialogTitle>
            <DialogDescription>
              {selectedCard === "openComplaints" ||
              selectedCard === "currentVisitors" ||
              selectedCard === "revenueCurrentMonth"
                ? `Latest records for ${stats?.periodLabel ?? period}.`
                : "Detail view coming soon for this metric."}
            </DialogDescription>
          </DialogHeader>

          {selectedCard === "openComplaints" && (
            <OpenComplaintsTable
              rows={openComplaintsDetailQuery.data ?? []}
              loading={openComplaintsDetailQuery.isLoading}
            />
          )}

          {selectedCard === "currentVisitors" && (
            <CurrentVisitorsTable
              rows={currentVisitorsDetailQuery.data ?? []}
              loading={currentVisitorsDetailQuery.isLoading}
            />
          )}

          {selectedCard === "revenueCurrentMonth" && (
            <RevenueTable
              rows={revenueDetailQuery.data ?? []}
              loading={revenueDetailQuery.isLoading}
            />
          )}

          {selectedCard !== "openComplaints" &&
           selectedCard !== "currentVisitors" &&
           selectedCard !== "revenueCurrentMonth" && (
            <p className="text-sm text-[#9E9B96] py-4">
              Detailed drill-down for this metric is coming soon.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Drilldown tables ─────────────────────────────────────────── */

function DrilldownTable({ children, loading, colSpan }: {
  children: React.ReactNode;
  loading: boolean;
  colSpan: number;
}) {
  if (loading) {
    return (
      <div className="space-y-2 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-[4px] bg-[#F0EFEB]" />
        ))}
      </div>
    );
  }
  return <div className="max-h-[420px] overflow-auto rounded-[4px] border border-[#E0DED9]">{children}</div>;
}

function OpenComplaintsTable({ rows, loading }: { rows: OpenComplaintDrilldownItem[]; loading: boolean }) {
  if (loading) return <DrilldownTable loading colSpan={6}>{null}</DrilldownTable>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-[4px] border border-[#E0DED9]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F6F5F2]">
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Number</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Category</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Priority</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Status</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Unit</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-[#9E9B96] py-8 text-sm">
                Nothing here — all clear.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-[#FBFAF9]">
                <TableCell className="font-['DM_Mono'] text-[12.5px]">{row.complaintNumber}</TableCell>
                <TableCell className="text-[13px]">{row.category}</TableCell>
                <TableCell className="text-[13px]">{humanizeEnum(row.priority)}</TableCell>
                <TableCell className="text-[13px]">{humanizeEnum(row.status)}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[12.5px]">{row.unitNumber ?? "—"}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[11.5px] text-[#9E9B96]">{formatDateTime(row.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CurrentVisitorsTable({ rows, loading }: { rows: CurrentVisitorDrilldownItem[]; loading: boolean }) {
  if (loading) return <DrilldownTable loading colSpan={5}>{null}</DrilldownTable>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-[4px] border border-[#E0DED9]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F6F5F2]">
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Visitor</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Unit</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Checked In</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Valid To</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Relative</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[#9E9B96] py-8 text-sm">
                No visitors checked in right now.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-[#FBFAF9]">
                <TableCell className="text-[13px]">{row.visitorName ?? "Visitor"}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[12.5px]">{row.unitNumber ?? "—"}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[11.5px]">{row.checkedInAt ? formatDateTime(row.checkedInAt) : "—"}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[11.5px]">{formatDateTime(row.validTo)}</TableCell>
                <TableCell className="text-[11.5px] text-[#9E9B96]">{row.checkedInAt ? relativeTime(row.checkedInAt) : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function RevenueTable({ rows, loading }: { rows: RevenueDrilldownItem[]; loading: boolean }) {
  if (loading) return <DrilldownTable loading colSpan={5}>{null}</DrilldownTable>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-[4px] border border-[#E0DED9]">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F6F5F2]">
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Invoice</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Amount</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Resident</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Unit</TableHead>
            <TableHead className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#9E9B96]">Paid At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[#9E9B96] py-8 text-sm">
                No revenue records for this period.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-[#FBFAF9]">
                <TableCell className="font-['DM_Mono'] text-[12.5px]">{row.invoiceNumber}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[13px] font-medium">{formatCurrencyEGP(row.amount)}</TableCell>
                <TableCell className="text-[13px]">{row.residentName ?? "—"}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[12.5px]">{row.unitNumber ?? "—"}</TableCell>
                <TableCell className="font-['DM_Mono'] text-[11.5px] text-[#9E9B96]">{formatDateTime(row.paidDate)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
