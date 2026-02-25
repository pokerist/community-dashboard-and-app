import { useCallback, useEffect, useMemo, useState } from "react";
import { StatCard } from "../StatCard";
import { ActivityFeed } from "../ActivityFeed";
import { QuickActions } from "../QuickActions";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import apiClient, { isAuthenticated } from "../../lib/api-client";
import { errorMessage, extractRows, formatCurrencyEGP, humanizeEnum, relativeTime } from "../../lib/live-data";

type DashboardSummary = any;

const PIE_COLORS = ["#0B5FFF", "#00B386", "#3B82F6", "#F59E0B", "#64748B"];

interface DashboardOverviewProps {
  onNavigate?: (section: string) => void;
}

export function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [occupancyBlocks, setOccupancyBlocks] = useState<any[]>([]);
  const [incidentRows, setIncidentRows] = useState<any[]>([]);
  const [notificationRows, setNotificationRows] = useState<any[]>([]);
  const [serviceRequestRows, setServiceRequestRows] = useState<any[]>([]);
  const [qrRows, setQrRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!isAuthenticated()) {
      setLoadError("Sign in to load live dashboard data.");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const [
        summaryRes,
        revenueRes,
        occupancyRes,
        incidentsRes,
        notificationsRes,
        serviceReqRes,
        accessRes,
      ] = await Promise.all([
        apiClient.get("/dashboard/summary"),
        apiClient.get("/dashboard/revenue"),
        apiClient.get("/dashboard/occupancy"),
        apiClient.get("/incidents/list", { params: { page: 1, limit: 10 } }),
        apiClient.get("/notifications/admin/all", { params: { page: 1, limit: 10 } }),
        apiClient.get("/service-requests"),
        apiClient.get("/access-qrcodes"),
      ]);

      setSummary(summaryRes.data ?? null);

      const rawChartData = Array.isArray(revenueRes.data?.chartData) ? revenueRes.data.chartData : [];
      setRevenueData(
        rawChartData.map((row: any) => ({
          month: row.month ?? row.label ?? row.name ?? "—",
          revenue: Number(row.revenue ?? row.amount ?? row.value ?? row.total ?? 0),
        })),
      );

      setOccupancyBlocks(Array.isArray(occupancyRes.data?.byLocation) ? occupancyRes.data.byLocation : []);
      setIncidentRows(extractRows(incidentsRes.data));
      setNotificationRows(extractRows(notificationsRes.data));
      setServiceRequestRows(extractRows(serviceReqRes.data));
      setQrRows(extractRows(accessRes.data));
    } catch (error) {
      const msg = errorMessage(error);
      setLoadError(msg);
      toast.error("Failed to load dashboard", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onUnauthorized = () => {
      setSummary(null);
      setLoadError("Session expired. Sign in again to load dashboard.");
    };
    window.addEventListener("auth:unauthorized", onUnauthorized as EventListener);
    return () => {
      window.removeEventListener("auth:unauthorized", onUnauthorized as EventListener);
    };
  }, []);

  const dashboardStats = useMemo(() => {
    const occupancyRate = Number(summary?.occupancyRate ?? 0);
    const activeIncidents = Number(summary?.activeIncidents ?? 0);
    const openComplaints = Number(summary?.openComplaints ?? 0);
    const revenueThisMonth = Number(summary?.revenueThisMonth ?? 0);
    const smartOnline = Number(summary?.smartDevices?.online ?? 0);
    const smartOffline = Number(summary?.smartDevices?.offline ?? 0);
    const cctvOnline = Number(summary?.cctvCameras?.online ?? 0);
    const cctvOffline = Number(summary?.cctvCameras?.offline ?? 0);

    return [
      {
        id: 1,
        title: "Active Incidents",
        value: String(activeIncidents),
        change: activeIncidents > 0 ? "Needs attention" : "0",
        trend: activeIncidents > 0 ? ("up" as const) : ("neutral" as const),
        icon: "shield",
      },
      {
        id: 2,
        title: "Open Complaints",
        value: String(openComplaints),
        change: `${openComplaints}`,
        trend: openComplaints > 0 ? ("up" as const) : ("neutral" as const),
        icon: "clipboard",
      },
      {
        id: 3,
        title: "Occupancy Rate",
        value: `${occupancyRate.toFixed(1)}%`,
        change: `${occupancyRate.toFixed(1)}%`,
        trend: occupancyRate > 0 ? ("up" as const) : ("neutral" as const),
        icon: "building",
      },
      {
        id: 4,
        title: "Revenue This Month",
        value: formatCurrencyEGP(revenueThisMonth),
        change: formatCurrencyEGP(revenueThisMonth),
        trend: revenueThisMonth > 0 ? ("up" as const) : ("neutral" as const),
        icon: "wallet",
      },
      {
        id: 5,
        title: "Smart Devices",
        value: `${smartOnline} online`,
        change: `${smartOffline} offline`,
        trend: smartOffline > 0 ? ("down" as const) : ("neutral" as const),
        icon: "users",
      },
      {
        id: 6,
        title: "CCTV Cameras",
        value: `${cctvOnline} online`,
        change: `${cctvOffline} offline`,
        trend: cctvOffline > 0 ? ("down" as const) : ("neutral" as const),
        icon: "shield",
      },
    ];
  }, [summary]);

  const visitorTrafficData = useMemo(() => {
    const counts = new Map<string, number>();
    qrRows.forEach((row: any) => {
      const createdAt = row.createdAt ?? row.generatedAt ?? row.validFrom;
      if (!createdAt) return;
      const d = new Date(createdAt);
      if (Number.isNaN(d.getTime())) return;
      const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([date, visitors]) => ({ date, visitors }))
      .slice(-14);
  }, [qrRows]);

  const serviceRequestsData = useMemo(() => {
    const counts = new Map<string, number>();
    serviceRequestRows.forEach((row: any) => {
      const key = humanizeEnum(row.category ?? row.service?.name ?? row.status ?? "Other");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value], index) => ({
      name,
      value,
      fill: PIE_COLORS[index % PIE_COLORS.length],
    }));
  }, [serviceRequestRows]);

  const monthlyRevenueData = useMemo(() => revenueData.slice(-6), [revenueData]);

  const recentActivities = useMemo(() => {
    const activitySeed: any[] = [];

    incidentRows.forEach((incident: any) => {
      activitySeed.push({
        id: `incident-${incident.id}`,
        user: "Security",
        action: "reported incident",
        target: incident.incidentNumber ?? incident.type ?? "Incident",
        timestamp: relativeTime(incident.reportedAt ?? incident.createdAt),
        type: "security",
        at: new Date(incident.reportedAt ?? incident.createdAt ?? 0).getTime(),
      });
    });

    notificationRows.forEach((notification: any) => {
      activitySeed.push({
        id: `notification-${notification.id}`,
        user: notification.sender?.nameEN ?? "Admin",
        action: "sent notification",
        target: notification.title ?? "Announcement",
        timestamp: relativeTime(notification.sentAt ?? notification.createdAt),
        type: "access",
        at: new Date(notification.sentAt ?? notification.createdAt ?? 0).getTime(),
      });
    });

    serviceRequestRows.forEach((request: any) => {
      activitySeed.push({
        id: `service-${request.id}`,
        user: request.requester?.nameEN ?? "Resident",
        action: "created service request",
        target: request.service?.name ?? humanizeEnum(request.status),
        timestamp: relativeTime(request.createdAt),
        type: "maintenance",
        at: new Date(request.createdAt ?? 0).getTime(),
      });
    });

    return activitySeed
      .filter((a) => Number.isFinite(a.at))
      .sort((a, b) => b.at - a.at)
      .slice(0, 6)
      .map((a, index) => ({
        id: index + 1,
        user: a.user,
        action: a.action,
        target: a.target,
        timestamp: a.timestamp,
        type: a.type,
      }));
  }, [incidentRows, notificationRows, serviceRequestRows]);

  const hasOccupancy = occupancyBlocks.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[#1E293B]">Dashboard Overview</h1>
          <p className="text-[#64748B] mt-1">Live operational snapshot from the backend API.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20">Live Data</Badge>
          <Button variant="outline" onClick={() => void loadDashboard()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {loadError ? (
        <Card className="p-4 border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] rounded-xl">
          {loadError}
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-card rounded-xl">
          <h3 className="mb-6 text-[#1E293B]">QR Generation Traffic</h3>
          {visitorTrafficData.length === 0 ? (
            <div className="h-[300px] grid place-items-center text-[#64748B] text-sm">
              No QR activity yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={visitorTrafficData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#64748B" style={{ fontSize: "12px" }} />
                <YAxis stroke="#64748B" style={{ fontSize: "12px" }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="visitors"
                  stroke="#0B5FFF"
                  strokeWidth={2}
                  dot={{ fill: "#0B5FFF", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 shadow-card rounded-xl">
          <h3 className="mb-6 text-[#1E293B]">Service Request Distribution</h3>
          {serviceRequestsData.length === 0 ? (
            <div className="h-[300px] grid place-items-center text-[#64748B] text-sm">
              No service requests yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={serviceRequestsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {serviceRequestsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 shadow-card rounded-xl">
          <h3 className="mb-6 text-[#1E293B]">Monthly Revenue Collection (EGP)</h3>
          {monthlyRevenueData.length === 0 ? (
            <div className="h-[300px] grid place-items-center text-[#64748B] text-sm">
              No revenue chart data available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#64748B" style={{ fontSize: "12px" }} />
                <YAxis
                  stroke="#64748B"
                  style={{ fontSize: "12px" }}
                  tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}K`}
                />
                <Tooltip formatter={(value: number) => formatCurrencyEGP(value)} />
                <Bar dataKey="revenue" fill="#00B386" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 shadow-card rounded-xl">
          <h3 className="mb-6 text-[#1E293B]">Occupancy by Block</h3>
          {!hasOccupancy ? (
            <div className="h-[300px] grid place-items-center text-[#64748B] text-sm">
              No occupancy breakdown available yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {occupancyBlocks.map((row: any, index: number) => {
                  const rate = Number(row.occupancyRate ?? 0);
                  const blockLabel = row.block ? `Block ${row.block}` : `Block ${index + 1}`;
                  const color =
                    rate >= 90
                      ? "bg-[#00B386]"
                      : rate >= 75
                      ? "bg-[#3B82F6]"
                      : rate >= 60
                      ? "bg-[#F59E0B]"
                      : "bg-[#EF4444]";
                  return (
                    <div key={`${row.projectName}-${row.block}-${index}`} className={`${color} rounded-lg p-4 text-white text-center`}>
                      <div className="font-semibold text-sm">{blockLabel}</div>
                      <div className="text-xs opacity-90 mt-1">{row.projectName ?? "Project"}</div>
                      <div className="text-xl font-bold mt-2">{rate.toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-[#64748B] mt-4">
                Source: <code>/dashboard/occupancy</code>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {recentActivities.length > 0 ? (
            <ActivityFeed activities={recentActivities} />
          ) : (
            <Card className="p-6 shadow-card rounded-xl">
              <h3 className="mb-3 text-[#1E293B]">Recent Activity</h3>
              <p className="text-sm text-[#64748B]">
                No recent activity was found yet. Activity will appear here after incidents, invoices, notifications,
                or service requests are created.
              </p>
            </Card>
          )}
        </div>
        <div>
          <QuickActions onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
