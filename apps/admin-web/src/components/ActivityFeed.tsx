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
    circleBg: "bg-[#FFFBEB]",
    circleIcon: "text-[#D97706]",
    badgeBg: "bg-[#FFFBEB]",
    badgeText: "text-[#92400E]",
    label: "Complaint",
  },
  SERVICE_REQUEST: {
    icon: FilePlus2,
    circleBg: "bg-[#EFF6FF]",
    circleIcon: "text-[#2563EB]",
    badgeBg: "bg-[#EFF6FF]",
    badgeText: "text-[#1E40AF]",
    label: "Service",
  },
  VIOLATION: {
    icon: AlertTriangle,
    circleBg: "bg-[#FEF2F2]",
    circleIcon: "text-[#DC2626]",
    badgeBg: "bg-[#FEF2F2]",
    badgeText: "text-[#991B1B]",
    label: "Violation",
  },
  INVOICE: {
    icon: Receipt,
    circleBg: "bg-[#ECFDF5]",
    circleIcon: "text-[#059669]",
    badgeBg: "bg-[#ECFDF5]",
    badgeText: "text-[#065F46]",
    label: "Invoice",
  },
  REGISTRATION: {
    icon: UserPlus,
    circleBg: "bg-[#F5F3FF]",
    circleIcon: "text-[#7C3AED]",
    badgeBg: "bg-[#F5F3FF]",
    badgeText: "text-[#5B21B6]",
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
                className="flex items-start gap-3 px-4 py-3 border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
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
                  <p className="text-[13px] font-semibold text-[#111827]">
                    {activity.description}
                  </p>

                  {/* SECONDARY: category + actor + unit — softer, smaller */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {/* Colored category badge */}
                    <span
                      className={`inline px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${config.badgeBg} ${config.badgeText}`}
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
                <span className="ml-auto text-[11px] text-[#9CA3AF] font-mono whitespace-nowrap pt-0.5 flex-shrink-0">
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
