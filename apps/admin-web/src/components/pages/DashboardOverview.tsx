import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ActivityFeed } from "../ActivityFeed";
import { QuickActions } from "../QuickActions";
import { StatCard } from "../StatCard";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
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
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI_ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
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
      toast.error("Failed to load dashboard stats", {
        description: errorMessage(statsQuery.error),
      });
    }
  }, [statsQuery.error]);

  useEffect(() => {
    if (activityQuery.error) {
      toast.error("Failed to load dashboard activity", {
        description: errorMessage(activityQuery.error),
      });
    }
  }, [activityQuery.error]);

  const stats = statsQuery.data;
  const kpis = stats?.kpis;
  const secondsSinceUpdate = statsQuery.dataUpdatedAt
    ? Math.max(0, Math.floor((clockNow - statsQuery.dataUpdatedAt) / 1000))
    : null;

  const cards = useMemo(() => {
    if (!kpis) return [];

    const ticketsSummary = `NEW ${kpis.ticketsByStatus.NEW} | IN_PROGRESS ${kpis.ticketsByStatus.IN_PROGRESS} | RESOLVED ${kpis.ticketsByStatus.RESOLVED} | CLOSED ${kpis.ticketsByStatus.CLOSED}`;

    return [
      {
        key: "totalRegisteredDevices" as const,
        title: "Total Registered Devices",
        value: String(kpis.totalRegisteredDevices),
        subtitle: `Android ${kpis.totalRegisteredDevicesByPlatform.android} | iOS ${kpis.totalRegisteredDevicesByPlatform.ios}`,
        icon: "devices" as const,
      },
      {
        key: "activeMobileUsers" as const,
        title: "Active Mobile Users",
        value: String(kpis.activeMobileUsers),
        subtitle: `Android ${kpis.activeMobileUsersByPlatform.android} | iOS ${kpis.activeMobileUsersByPlatform.ios}`,
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
        subtitle: "Tap to view open complaint list",
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
        title: "Tickets By Status",
        value: String(kpis.totalComplaints),
        subtitle: ticketsSummary,
        icon: "tickets" as const,
      },
      {
        key: "revenueCurrentMonth" as const,
        title: "Revenue",
        value: formatCurrencyEGP(kpis.revenueCurrentMonth),
        subtitle: `Paid invoices in ${stats.periodLabel}`,
        icon: "revenue" as const,
      },
      {
        key: "occupancyRate" as const,
        title: "Occupancy Rate",
        value: `${kpis.occupancyRate.toFixed(2)}%`,
        subtitle: "Occupied / total active units",
        icon: "occupancy" as const,
      },
      {
        key: "currentVisitors" as const,
        title: "Current Visitors",
        value: String(kpis.currentVisitors),
        subtitle: "Tap to view checked-in visitors",
        icon: "visitors" as const,
      },
      {
        key: "blueCollarWorkers" as const,
        title: "Blue Collar Workers",
        value: String(kpis.blueCollarWorkers),
        subtitle: "Active workers",
        icon: "workers" as const,
      },
      {
        key: "totalCars" as const,
        title: "Total Cars",
        value: String(kpis.totalCars),
        subtitle: "Vehicles of active residents",
        icon: "cars" as const,
      },
    ];
  }, [kpis, stats?.periodLabel]);

  const detailTitle = useMemo(() => {
    if (!selectedCard) return "";
    if (selectedCard === "openComplaints") return "Open Complaints Detail";
    if (selectedCard === "currentVisitors") return "Current Visitors Detail";
    if (selectedCard === "revenueCurrentMonth") return "Revenue Detail";
    return "Detail View";
  }, [selectedCard]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-[#64748B]">
            Period: <span className="font-medium">{stats?.periodLabel ?? "-"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20">
            {statsQuery.isFetching ? "Refreshing..." : "Live"}
          </Badge>
          <span className="text-xs text-[#64748B]">
            Last updated:{" "}
            {secondsSinceUpdate === null ? "-" : `${secondsSinceUpdate} seconds ago`}
          </span>
          <Button
            variant="outline"
            onClick={() => void statsQuery.refetch()}
            disabled={statsQuery.isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Card className="rounded-lg border border-[#DDE5EF] bg-gradient-to-r from-white to-[#F8FBFF] p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.7)]">
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={period === option.value ? "default" : "outline"}
              className={period === option.value ? "bg-[#0B5FFF] text-white" : "border-[#D4DEE9]"}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <QuickActions onNavigate={onNavigate} />

      <ActivityFeed
        activities={activityQuery.data ?? []}
        loading={activityQuery.isLoading}
      />

      <Dialog open={selectedCard !== null} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
            <DialogDescription>
              {selectedCard === "openComplaints" ||
              selectedCard === "currentVisitors" ||
              selectedCard === "revenueCurrentMonth"
                ? `Showing latest records for ${stats?.periodLabel ?? period}.`
                : "Detail view coming soon for this metric."}
            </DialogDescription>
          </DialogHeader>

          {selectedCard === "openComplaints" ? (
            <OpenComplaintsTable
              rows={openComplaintsDetailQuery.data ?? []}
              loading={openComplaintsDetailQuery.isLoading}
            />
          ) : null}

          {selectedCard === "currentVisitors" ? (
            <CurrentVisitorsTable
              rows={currentVisitorsDetailQuery.data ?? []}
              loading={currentVisitorsDetailQuery.isLoading}
            />
          ) : null}

          {selectedCard === "revenueCurrentMonth" ? (
            <RevenueTable
              rows={revenueDetailQuery.data ?? []}
              loading={revenueDetailQuery.isLoading}
            />
          ) : null}

          {selectedCard !== "openComplaints" &&
          selectedCard !== "currentVisitors" &&
          selectedCard !== "revenueCurrentMonth" ? (
            <p className="text-sm text-[#64748B]">Detail view coming soon.</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OpenComplaintsTable({
  rows,
  loading,
}: {
  rows: OpenComplaintDrilldownItem[];
  loading: boolean;
}) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC]">
            <TableHead>Number</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-[#64748B]">
                Loading...
              </TableCell>
            </TableRow>
          ) : null}
          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-[#64748B]">
                No records.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.complaintNumber}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell>{humanizeEnum(row.priority)}</TableCell>
              <TableCell>{humanizeEnum(row.status)}</TableCell>
              <TableCell>{row.unitNumber ?? "-"}</TableCell>
              <TableCell>{formatDateTime(row.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CurrentVisitorsTable({
  rows,
  loading,
}: {
  rows: CurrentVisitorDrilldownItem[];
  loading: boolean;
}) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC]">
            <TableHead>Visitor</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Checked In</TableHead>
            <TableHead>Valid To</TableHead>
            <TableHead>Relative</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[#64748B]">
                Loading...
              </TableCell>
            </TableRow>
          ) : null}
          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[#64748B]">
                No records.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.visitorName ?? "Visitor"}</TableCell>
              <TableCell>{row.unitNumber ?? "-"}</TableCell>
              <TableCell>{row.checkedInAt ? formatDateTime(row.checkedInAt) : "-"}</TableCell>
              <TableCell>{formatDateTime(row.validTo)}</TableCell>
              <TableCell>{row.checkedInAt ? relativeTime(row.checkedInAt) : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RevenueTable({
  rows,
  loading,
}: {
  rows: RevenueDrilldownItem[];
  loading: boolean;
}) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8FAFC]">
            <TableHead>Invoice</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Resident</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Paid At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[#64748B]">
                Loading...
              </TableCell>
            </TableRow>
          ) : null}
          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[#64748B]">
                No records.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.invoiceNumber}</TableCell>
              <TableCell>{formatCurrencyEGP(row.amount)}</TableCell>
              <TableCell>{row.residentName ?? "-"}</TableCell>
              <TableCell>{row.unitNumber ?? "-"}</TableCell>
              <TableCell>{formatDateTime(row.paidDate)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
