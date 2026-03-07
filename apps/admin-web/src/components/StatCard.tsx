import {
  Building2,
  Car,
  ClipboardList,
  QrCode,
  Ticket,
  UserCheck,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { formatCurrencyEGP } from "../lib/live-data";
import type { DashboardKPIs } from "../lib/dashboard-service";

// ─── Types ────────────────────────────────────────────────────

type StatIcon =
  | "devices"
  | "active-users"
  | "complaints-total"
  | "complaints-open"
  | "complaints-closed"
  | "tickets"
  | "revenue"
  | "occupancy"
  | "visitors"
  | "workers"
  | "cars";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: StatIcon;
  onClick?: () => void;
  variant?: "light" | "dark";
}

// ─── Maps ─────────────────────────────────────────────────────

const iconMap: Record<StatIcon, ComponentType<{ style?: React.CSSProperties }>> = {
  devices:             QrCode,
  "active-users":      UserCheck,
  "complaints-total":  ClipboardList,
  "complaints-open":   ClipboardList,
  "complaints-closed": ClipboardList,
  tickets:             Ticket,
  revenue:             Wallet,
  occupancy:           Building2,
  visitors:            UserRound,
  workers:             Wrench,
  cars:                Car,
};

const toneMap: Record<StatIcon, { accentColor: string; iconBg: string; iconColor: string }> = {
  "devices":            { accentColor: "#2563EB", iconBg: "#EFF6FF", iconColor: "#2563EB" },
  "active-users":       { accentColor: "#059669", iconBg: "#ECFDF5", iconColor: "#059669" },
  "complaints-total":   { accentColor: "#D97706", iconBg: "#FFFBEB", iconColor: "#D97706" },
  "complaints-open":    { accentColor: "#DC2626", iconBg: "#FEF2F2", iconColor: "#DC2626" },
  "complaints-closed":  { accentColor: "#059669", iconBg: "#ECFDF5", iconColor: "#059669" },
  "tickets":            { accentColor: "#2563EB", iconBg: "#EFF6FF", iconColor: "#2563EB" },
  "revenue":            { accentColor: "#059669", iconBg: "#ECFDF5", iconColor: "#059669" },
  "occupancy":          { accentColor: "#7C3AED", iconBg: "#F5F3FF", iconColor: "#7C3AED" },
  "visitors":           { accentColor: "#0891B2", iconBg: "#ECFEFF", iconColor: "#0891B2" },
  "workers":            { accentColor: "#D97706", iconBg: "#FFFBEB", iconColor: "#D97706" },
  "cars":               { accentColor: "#64748B", iconBg: "#F8FAFC", iconColor: "#64748B" },
};

// ─── StatCard ─────────────────────────────────────────────────

export function StatCard({ title, value, subtitle, icon, onClick, variant = "light" }: StatCardProps) {
  const IconComponent = iconMap[icon];
  const tone = toneMap[icon];

  /* Dark variant */
  if (variant === "dark") {
    return (
      <div
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        style={{
          background: "#1C1B27",
          borderRadius: "8px",
          border: "1px solid rgba(255,255,255,0.07)",
          padding: "20px",
          cursor: onClick ? "pointer" : "default",
          fontFamily: "'Work Sans', sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
            {title}
          </p>
          <div style={{ width: "28px", height: "28px", borderRadius: "4px", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconComponent style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.4)" }} />
          </div>
        </div>
        <p style={{ fontSize: "26px", fontWeight: 700, color: "rgba(255,255,255,0.92)", lineHeight: 1, letterSpacing: "-0.025em", fontFamily: "'DM Mono', monospace" }}>
          {value}
        </p>
        {subtitle && <p style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.32)", marginTop: "8px", lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
    );
  }

  /* Light variant */
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #EBEBEB",
        padding: "16px 18px 18px",
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 180ms ease, transform 180ms ease, border-color 180ms ease",
        fontFamily: "'Work Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
        el.style.transform = "translateY(-1px)";
        el.style.borderColor = "#D1D5DB";
        const hint = el.querySelector(".view-hint") as HTMLElement | null;
        if (hint) hint.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "none";
        el.style.transform = "translateY(0)";
        el.style.borderColor = "#EBEBEB";
        const hint = el.querySelector(".view-hint") as HTMLElement | null;
        if (hint) hint.style.opacity = "0";
      }}
    >
      {/* Accent bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: tone.accentColor, borderRadius: "8px 8px 0 0", opacity: 0.7 }} />

      {/* Icon + title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: tone.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconComponent style={{ width: "14px", height: "14px", color: tone.iconColor }} />
        </div>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "#9CA3AF", textAlign: "right", lineHeight: 1.3, maxWidth: "120px" }}>
          {title}
        </p>
      </div>

      {/* Value */}
      <p style={{ fontSize: "30px", fontWeight: 700, color: "#111827", lineHeight: 1, letterSpacing: "-0.03em", fontFamily: "'DM Mono', monospace", marginBottom: "6px" }}>
        {value}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p style={{ fontSize: "11.5px", color: "#9CA3AF", lineHeight: 1.4, marginTop: "2px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {subtitle}
        </p>
      )}

      {/* Hover hint */}
      {onClick && (
        <div className="view-hint" style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "4px", opacity: 0, transition: "opacity 150ms ease" }}>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: tone.accentColor, fontFamily: "'Work Sans', sans-serif" }}>View details</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5h6M5 2l3 3-3 3" stroke={tone.accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KpiGrid — replaces the inline grid in DashboardOverview.tsx
//
// Usage in DashboardOverview:
//   import { KpiGrid, KpiGridSkeleton } from "../StatCard";
//   ...
//   {statsQuery.isLoading
//     ? <KpiGridSkeleton />
//     : <KpiGrid kpis={kpis} periodLabel={stats.periodLabel} onCardClick={setSelectedCard} />
//   }
// ─────────────────────────────────────────────────────────────

interface KpiGridProps {
  kpis: DashboardKPIs;
  periodLabel: string;
  onCardClick: (key: string) => void;
}

export function KpiGrid({ kpis, periodLabel, onCardClick }: KpiGridProps) {
  const cards: Array<{ key: string; title: string; value: string; subtitle: string; icon: StatIcon }> = [
    {
      key: "totalRegisteredDevices",
      title: "Registered Devices",
      value: String(kpis.totalRegisteredDevices),
      subtitle: `Android ${kpis.totalRegisteredDevicesByPlatform.android}  ·  iOS ${kpis.totalRegisteredDevicesByPlatform.ios}`,
      icon: "devices",
    },
    {
      key: "activeMobileUsers",
      title: "Active Mobile Users",
      value: String(kpis.activeMobileUsers),
      subtitle: `Android ${kpis.activeMobileUsersByPlatform.android}  ·  iOS ${kpis.activeMobileUsersByPlatform.ios}`,
      icon: "active-users",
    },
    {
      key: "totalComplaints",
      title: "Total Complaints",
      value: String(kpis.totalComplaints),
      subtitle: `Period: ${periodLabel}`,
      icon: "complaints-total",
    },
    {
      key: "openComplaints",
      title: "Open Complaints",
      value: String(kpis.openComplaints),
      subtitle: "Click to view open list",
      icon: "complaints-open",
    },
    {
      key: "closedComplaints",
      title: "Closed Complaints",
      value: String(kpis.closedComplaints),
      subtitle: `Period: ${periodLabel}`,
      icon: "complaints-closed",
    },
    {
      key: "ticketsByStatus",
      title: "Tickets by Status",
      value: String(kpis.ticketsByStatus.NEW + kpis.ticketsByStatus.IN_PROGRESS + kpis.ticketsByStatus.RESOLVED),
      subtitle: `New ${kpis.ticketsByStatus.NEW}  ·  In Progress ${kpis.ticketsByStatus.IN_PROGRESS}  ·  Resolved ${kpis.ticketsByStatus.RESOLVED}`,
      icon: "tickets",
    },
    {
      key: "revenueCurrentMonth",
      title: "Revenue",
      value: formatCurrencyEGP(kpis.revenueCurrentMonth),
      subtitle: `Paid invoices · ${periodLabel}`,
      icon: "revenue",
    },
    {
      key: "occupancyRate",
      title: "Occupancy Rate",
      value: `${kpis.occupancyRate.toFixed(1)}%`,
      subtitle: "Occupied / total active units",
      icon: "occupancy",
    },
    {
      key: "currentVisitors",
      title: "Current Visitors",
      value: String(kpis.currentVisitors),
      subtitle: "Click to view checked-in visitors",
      icon: "visitors",
    },
    {
      key: "blueCollarWorkers",
      title: "Blue Collar Workers",
      value: String(kpis.blueCollarWorkers),
      subtitle: "Active workers on compound",
      icon: "workers",
    },
    {
      key: "totalCars",
      title: "Registered Vehicles",
      value: String(kpis.totalCars),
      subtitle: "Resident-registered vehicles",
      icon: "cars",
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
      {cards.map((card) => (
        <StatCard
          key={card.key}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          onClick={() => onCardClick(card.key)}
        />
      ))}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

export function KpiGridSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
      {Array.from({ length: 11 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: "110px",
            borderRadius: "8px",
            background: "linear-gradient(90deg, #F3F4F6 25%, #E9EAEC 50%, #F3F4F6 75%)",
            backgroundSize: "200% 100%",
            border: "1px solid #EBEBEB",
            animation: "shimmer 1.5s infinite",
          }}
        />
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </div>
  );
}