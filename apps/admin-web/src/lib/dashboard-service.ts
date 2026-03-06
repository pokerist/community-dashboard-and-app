import apiClient from "./api-client";

export type DashboardPeriod = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL";
export type DashboardComplaintStatus = "NEW" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type DashboardActivityType =
  | "COMPLAINT"
  | "SERVICE_REQUEST"
  | "VIOLATION"
  | "INVOICE"
  | "REGISTRATION";

export type DashboardPlatformBreakdown = {
  android: number;
  ios: number;
};

export type DashboardStatsResponse = {
  period: DashboardPeriod;
  periodLabel: string;
  kpis: {
    totalRegisteredDevices: number;
    totalRegisteredDevicesByPlatform: DashboardPlatformBreakdown;
    activeMobileUsers: number;
    activeMobileUsersByPlatform: DashboardPlatformBreakdown;
    totalComplaints: number;
    openComplaints: number;
    closedComplaints: number;
    ticketsByStatus: Record<DashboardComplaintStatus, number>;
    revenueCurrentMonth: number;
    occupancyRate: number;
    currentVisitors: number;
    blueCollarWorkers: number;
    totalCars: number;
  };
  generatedAt: string;
};

export type DashboardActivityItem = {
  id: string;
  type: DashboardActivityType;
  description: string;
  actorName: string | null;
  unitNumber: string | null;
  timestamp: string;
};

export type OpenComplaintDrilldownItem = {
  id: string;
  complaintNumber: string;
  category: string;
  priority: string;
  status: DashboardComplaintStatus;
  unitNumber: string | null;
  createdAt: string;
};

export type CurrentVisitorDrilldownItem = {
  id: string;
  visitorName: string | null;
  unitNumber: string | null;
  checkedInAt: string | null;
  validTo: string;
};

export type RevenueDrilldownItem = {
  id: string;
  invoiceNumber: string;
  amount: number;
  residentName: string | null;
  unitNumber: string | null;
  paidDate: string;
};

const dashboardService = {
  async getStats(period: DashboardPeriod): Promise<DashboardStatsResponse> {
    const response = await apiClient.get<DashboardStatsResponse>("/dashboard/stats", {
      params: { period },
    });
    return response.data;
  },

  async getActivity(): Promise<DashboardActivityItem[]> {
    const response = await apiClient.get<DashboardActivityItem[]>("/dashboard/activity");
    return Array.isArray(response.data) ? response.data : [];
  },

  async getOpenComplaintsDrilldown(
    period: DashboardPeriod,
    limit = 20,
  ): Promise<OpenComplaintDrilldownItem[]> {
    const response = await apiClient.get<OpenComplaintDrilldownItem[]>(
      "/dashboard/drilldown/open-complaints",
      {
        params: { period, limit },
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async getCurrentVisitorsDrilldown(
    period: DashboardPeriod,
    limit = 20,
  ): Promise<CurrentVisitorDrilldownItem[]> {
    const response = await apiClient.get<CurrentVisitorDrilldownItem[]>(
      "/dashboard/drilldown/current-visitors",
      {
        params: { period, limit },
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  },

  async getRevenueDrilldown(
    period: DashboardPeriod,
    limit = 20,
  ): Promise<RevenueDrilldownItem[]> {
    const response = await apiClient.get<RevenueDrilldownItem[]>(
      "/dashboard/drilldown/revenue",
      {
        params: { period, limit },
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  },
};

export default dashboardService;

