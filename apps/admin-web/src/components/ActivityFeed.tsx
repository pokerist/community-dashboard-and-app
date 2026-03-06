import {
  AlertTriangle,
  ClipboardList,
  FilePlus2,
  Receipt,
  UserPlus,
} from "lucide-react";
import type { ComponentType } from "react";
import { DashboardActivityItem, DashboardActivityType } from "../lib/dashboard-service";
import { relativeTime } from "../lib/live-data";
import { Card } from "./ui/card";

interface ActivityFeedProps {
  activities: DashboardActivityItem[];
  loading?: boolean;
}

const iconByType: Record<
  DashboardActivityType,
  { icon: ComponentType<{ className?: string }>; color: string }
> = {
  COMPLAINT: {
    icon: ClipboardList,
    color: "bg-[#0B5FFF]/10 text-[#0B5FFF]",
  },
  SERVICE_REQUEST: {
    icon: FilePlus2,
    color: "bg-[#00B386]/10 text-[#00B386]",
  },
  VIOLATION: {
    icon: AlertTriangle,
    color: "bg-[#F59E0B]/10 text-[#F59E0B]",
  },
  INVOICE: {
    icon: Receipt,
    color: "bg-[#10B981]/10 text-[#10B981]",
  },
  REGISTRATION: {
    icon: UserPlus,
    color: "bg-[#6366F1]/10 text-[#6366F1]",
  },
};

export function ActivityFeed({ activities, loading = false }: ActivityFeedProps) {
  return (
    <Card className="rounded-lg border border-[#E2E8F0] p-6 shadow-[0_10px_22px_-20px_rgba(15,23,42,0.8)]">
      <h3 className="text-[#1E293B]">Recent Activity</h3>
      <div className="mt-4 space-y-3">
        {loading ? <p className="text-sm text-[#64748B]">Loading activity...</p> : null}
        {!loading && activities.length === 0 ? (
          <p className="text-sm text-[#64748B]">No recent activity found.</p>
        ) : null}
        {activities.map((activity) => {
          const config = iconByType[activity.type];
          const Icon = config.icon;
          return (
            <div key={activity.id} className="flex items-start gap-3 rounded-md border border-[#E2E8F0] p-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[#0F172A]">{activity.description}</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  {activity.actorName ?? "System"}{" "}
                  {activity.unitNumber ? `• Unit ${activity.unitNumber}` : ""} •{" "}
                  {relativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
