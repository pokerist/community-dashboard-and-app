import {
  Activity,
  AlertTriangle,
  ClipboardList,
  FilePlus2,
  Receipt,
  UserPlus,
} from "lucide-react";
import type { ComponentType } from "react";
import { DashboardActivityItem, DashboardActivityType } from "../lib/dashboard-service";
import { relativeTime } from "../lib/live-data";

interface ActivityFeedProps {
  activities: DashboardActivityItem[];
  loading?: boolean;
}

const iconByType: Record<
  DashboardActivityType,
  {
    icon: ComponentType<{ className?: string }>;
    circleBg: string;
    circleIcon: string;
    badgeBg: string;
    badgeText: string;
    label: string;
  }
> = {
  COMPLAINT: {
    icon: ClipboardList,
    circleBg: "bg-blue-50",
    circleIcon: "text-blue-500",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-600",
    label: "Complaint",
  },
  SERVICE_REQUEST: {
    icon: FilePlus2,
    circleBg: "bg-emerald-50",
    circleIcon: "text-emerald-600",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    label: "Service",
  },
  VIOLATION: {
    icon: AlertTriangle,
    circleBg: "bg-amber-50",
    circleIcon: "text-amber-500",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-600",
    label: "Violation",
  },
  INVOICE: {
    icon: Receipt,
    circleBg: "bg-teal-50",
    circleIcon: "text-teal-600",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    label: "Invoice",
  },
  REGISTRATION: {
    icon: UserPlus,
    circleBg: "bg-violet-50",
    circleIcon: "text-violet-500",
    badgeBg: "bg-violet-50",
    badgeText: "text-violet-600",
    label: "Registration",
  },
};

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-[#F3F4F6] last:border-0">
      <div className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#F3F4F6]" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 w-3/4 animate-pulse rounded-[3px] bg-[#F3F4F6]" />
        <div className="flex gap-2 mt-2">
          <div className="h-2.5 w-16 animate-pulse rounded-[3px] bg-[#F9FAFB]" />
          <div className="h-2.5 w-24 animate-pulse rounded-[3px] bg-[#F9FAFB]" />
        </div>
      </div>
      <div className="h-2.5 w-10 animate-pulse rounded-[3px] bg-[#F3F4F6] mt-1" />
    </div>
  );
}

export function ActivityFeed({ activities, loading = false }: ActivityFeedProps) {
  return (
    <div
      className="flex flex-col bg-white rounded-[6px] overflow-hidden"
      style={{ border: "1px solid #EBEBEB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[5px] bg-[#F5F4F1] border border-[#EBEBEB]">
            <Activity className="h-3.5 w-3.5 text-[#6B7280]" />
          </div>
          <div>
            <h3
              className="text-[13px] font-bold text-[#111827] leading-none"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              Recent Activity
            </h3>
            <p className="mt-0.5 text-[10.5px] text-[#9CA3AF]">Live feed of compound events</p>
          </div>
        </div>

        {/* Blue accent event count pill */}
        {!loading && activities.length > 0 && (
          <span
            className="rounded-[4px] bg-[#2563EB] px-2.5 py-[3px] text-[10.5px] font-bold text-white tabular-nums"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            {activities.length} events
          </span>
        )}
      </div>

      {/* Feed rows */}
      <div className="flex-1 divide-y divide-[#F5F4F1]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F9FAFB] border border-[#E5E7EB]">
              <Activity className="h-5 w-5 text-[#D1D5DB]" />
            </div>
            <p
              className="text-[13.5px] font-semibold text-[#6B7280]"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              All quiet for now
            </p>
            <p className="mt-1 text-[12px] text-[#9CA3AF] max-w-[220px]">
              Nothing here yet — check back shortly.
            </p>
          </div>
        ) : (
          activities.map((activity) => {
            const config = iconByType[activity.type];
            const Icon = config.icon;
            return (
              <div
                key={activity.id}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[#FAFAF9]"
              >
                {/* Circle icon */}
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.circleBg}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${config.circleIcon}`} />
                </div>

                {/* Content — two-tier hierarchy */}
                <div className="min-w-0 flex-1">
                  {/* PRIMARY: description — bold, prominent */}
                  <p
                    className="text-[13.5px] font-semibold text-[#111827] leading-snug"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}
                  >
                    {activity.description}
                  </p>

                  {/* SECONDARY: category + actor + unit — softer, smaller */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {/* Colored category badge */}
                    <span
                      className={`inline-flex items-center rounded-[4px] px-2 py-[2px] text-[10.5px] font-semibold ${config.badgeBg} ${config.badgeText}`}
                      style={{ fontFamily: "'Work Sans', sans-serif" }}
                    >
                      {config.label}
                    </span>

                    {activity.actorName && (
                      <span className="text-[11px] text-[#9CA3AF]">
                        by{" "}
                        <span className="font-medium text-[#6B7280]">
                          {activity.actorName}
                        </span>
                      </span>
                    )}

                    {activity.unitNumber && (
                      <span
                        className="text-[11px] font-medium text-[#9CA3AF]"
                        style={{ fontFamily: "'DM Mono', monospace" }}
                      >
                        Unit {activity.unitNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp — DM Mono, right-aligned, muted */}
                <span
                  className="shrink-0 mt-0.5 text-[11px] text-[#B0ADA7] tabular-nums"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                >
                  {relativeTime(activity.timestamp)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
