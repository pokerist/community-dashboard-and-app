import {
  AlertTriangle,
  ClipboardList,
  FilePlus2,
  Receipt,
  UserPlus,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { DashboardActivityItem, DashboardActivityType } from "../lib/dashboard-service";
import { relativeTime } from "../lib/live-data";

interface ActivityFeedProps {
  activities: DashboardActivityItem[];
  loading?: boolean;
}

const iconByType: Record<
  DashboardActivityType,
  {
    icon: ComponentType<{ style?: CSSProperties }>;
    circleStyle: { background: string; color: string };
    badgeStyle: { background: string; color: string };
    label: string;
  }
> = {
  COMPLAINT: {
    icon: ClipboardList,
    circleStyle: { background: "#FFFBEB", color: "#D97706" },
    badgeStyle: { background: "#FFFBEB", color: "#92400E" },
    label: "Complaint",
  },
  SERVICE_REQUEST: {
    icon: FilePlus2,
    circleStyle: { background: "#EFF6FF", color: "#2563EB" },
    badgeStyle: { background: "#EFF6FF", color: "#1E40AF" },
    label: "Service",
  },
  VIOLATION: {
    icon: AlertTriangle,
    circleStyle: { background: "#FEF2F2", color: "#DC2626" },
    badgeStyle: { background: "#FEF2F2", color: "#991B1B" },
    label: "Violation",
  },
  INVOICE: {
    icon: Receipt,
    circleStyle: { background: "#ECFDF5", color: "#059669" },
    badgeStyle: { background: "#ECFDF5", color: "#065F46" },
    label: "Invoice",
  },
  REGISTRATION: {
    icon: UserPlus,
    circleStyle: { background: "#F5F3FF", color: "#7C3AED" },
    badgeStyle: { background: "#F5F3FF", color: "#5B21B6" },
    label: "Registration",
  },
};

// ─── Skeleton row ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#F3F4F6", flexShrink: 0, animation: "shimmer 1.5s infinite", backgroundSize: "200% 100%", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingTop: "2px" }}>
        <div style={{ height: "13px", width: "70%", borderRadius: "4px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ height: "10px", width: "52px", borderRadius: "4px", backgroundImage: "linear-gradient(90deg,#F9FAFB 25%,#F3F4F6 50%,#F9FAFB 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
          <div style={{ height: "10px", width: "80px", borderRadius: "4px", backgroundImage: "linear-gradient(90deg,#F9FAFB 25%,#F3F4F6 50%,#F9FAFB 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
        </div>
      </div>
      <div style={{ height: "10px", width: "36px", borderRadius: "4px", backgroundImage: "linear-gradient(90deg,#F3F4F6 25%,#EBEBEB 50%,#F3F4F6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", marginTop: "4px", flexShrink: 0 }} />
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function ActivityFeed({ activities, loading = false }: ActivityFeedProps) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "10px",
        border: "1px solid #EBEBEB",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Work Sans', sans-serif",
      }}
    >
      {/* ── Panel header ─────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
        borderBottom: "1px solid #F3F4F6",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Icon */}
          <div style={{
            width: "28px", height: "28px",
            borderRadius: "7px",
            background: "#F5F5F5",
            border: "1px solid #EBEBEB",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>

          <div>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#111827", lineHeight: 1, letterSpacing: "-0.01em" }}>
              Recent Activity
            </h3>
            <p style={{ marginTop: "3px", fontSize: "10.5px", color: "#9CA3AF", lineHeight: 1 }}>
              Live feed of compound events
            </p>
          </div>
        </div>

        {/* Event count badge */}
        {!loading && activities.length > 0 && (
          <span style={{
            background: "#111827",
            color: "#FFFFFF",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: "6px",
            fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.02em",
          }}>
            {activities.length} events
          </span>
        )}
      </div>

      {/* ── Feed body ────────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)

        ) : activities.length === 0 ? (
          // Empty state
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "#F9FAFB", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p style={{ fontSize: "13.5px", fontWeight: 600, color: "#6B7280" }}>All quiet for now</p>
            <p style={{ marginTop: "4px", fontSize: "12px", color: "#9CA3AF", maxWidth: "200px", lineHeight: 1.5 }}>
              Nothing here yet — check back shortly.
            </p>
          </div>

        ) : (
          activities.map((activity, idx) => {
            const config = iconByType[activity.type];
            const Icon = config.icon;
            const isLast = idx === activities.length - 1;

            return (
              <div
                key={activity.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 16px",
                  borderBottom: isLast ? "none" : "1px solid #F9FAFB",
                  transition: "background 100ms ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
              >
                {/* Circle icon */}
                <div style={{
                  marginTop: "1px",
                  width: "32px", height: "32px",
                  borderRadius: "50%",
                  background: config.circleStyle.background,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon style={{ width: "13px", height: "13px", color: config.circleStyle.color }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Description */}
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", lineHeight: 1.35, letterSpacing: "-0.005em" }}>
                    {activity.description}
                  </p>

                  {/* Meta row: badge + actor + unit */}
                  <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    {/* Category badge */}
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      background: config.badgeStyle.background,
                      color: config.badgeStyle.color,
                    }}>
                      {config.label}
                    </span>

                    {activity.actorName && (
                      <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
                        by{" "}
                        <span style={{ fontWeight: 600, color: "#6B7280" }}>
                          {activity.actorName}
                        </span>
                      </span>
                    )}

                    {activity.unitNumber && (
                      <span style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", fontFamily: "'DM Mono', monospace" }}>
                        Unit {activity.unitNumber}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <span style={{
                  flexShrink: 0,
                  fontSize: "11px",
                  color: "#9CA3AF",
                  fontFamily: "'DM Mono', monospace",
                  whiteSpace: "nowrap",
                  paddingTop: "2px",
                }}>
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