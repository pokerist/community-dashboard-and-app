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
import { cn } from "./ui/utils";

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
  className?: string;
}

const iconMap: Record<StatIcon, ComponentType<{ className?: string }>> = {
  devices: QrCode,
  "active-users": UserCheck,
  "complaints-total": ClipboardList,
  "complaints-open": ClipboardList,
  "complaints-closed": ClipboardList,
  tickets: Ticket,
  revenue: Wallet,
  occupancy: Building2,
  visitors: UserRound,
  workers: Wrench,
  cars: Car,
};

/* Semantic color per stat type */
const toneMap: Record<
  StatIcon,
  { accentColor: string; iconBg: string; iconColor: string }
> = {
  devices:              { accentColor: "#2563EB", iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
  "active-users":       { accentColor: "#059669", iconBg: "bg-emerald-50",iconColor: "text-emerald-600"},
  "complaints-total":   { accentColor: "#6366F1", iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
  "complaints-open":    { accentColor: "#D97706", iconBg: "bg-amber-50",  iconColor: "text-amber-600"  },
  "complaints-closed":  { accentColor: "#059669", iconBg: "bg-emerald-50",iconColor: "text-emerald-600"},
  tickets:              { accentColor: "#2563EB", iconBg: "bg-blue-50",   iconColor: "text-blue-600"   },
  revenue:              { accentColor: "#059669", iconBg: "bg-emerald-50",iconColor: "text-emerald-600"},
  occupancy:            { accentColor: "#8B5CF6", iconBg: "bg-violet-50", iconColor: "text-violet-600" },
  visitors:             { accentColor: "#0891B2", iconBg: "bg-cyan-50",   iconColor: "text-cyan-600"   },
  workers:              { accentColor: "#EA580C", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
  cars:                 { accentColor: "#64748B", iconBg: "bg-slate-50",  iconColor: "text-slate-500"  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  onClick,
  variant = "light",
  className,
}: StatCardProps) {
  const IconComponent = iconMap[icon];
  const tone = toneMap[icon];

  if (variant === "dark") {
    return (
      <div
        className={cn(
          "group relative bg-[#1C1B27] rounded-[6px] border border-white/[0.07] p-5 transition-colors",
          onClick ? "cursor-pointer hover:border-white/[0.12]" : "",
          className,
        )}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="flex items-start justify-between mb-3">
          <p className="text-[10px] font-bold text-white/38 uppercase tracking-[0.14em]">{title}</p>
          <div className={cn("w-8 h-8 rounded-[4px] flex items-center justify-center", tone.iconBg, "bg-opacity-10")}>
            <IconComponent className="w-4 h-4 text-white/50" />
          </div>
        </div>
        <p
          className="text-[28px] font-bold text-white/92 leading-none tracking-[-0.025em]"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {value}
        </p>
        {subtitle && <p className="text-[10.5px] text-white/32 mt-2 leading-relaxed">{subtitle}</p>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden bg-white rounded-[6px] border border-[#EBEBEB]",
        "transition-all duration-200",
        onClick
          ? "cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] hover:-translate-y-px"
          : "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
        className,
      )}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* 4px left accent border */}
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: tone.accentColor }}
      />

      <div className="p-4 pl-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#9CA3AF] leading-none mt-0.5"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            {title}
          </p>
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] transition-transform duration-150 group-hover:scale-110",
              tone.iconBg,
            )}
          >
            <IconComponent className={cn("h-3.5 w-3.5", tone.iconColor)} />
          </div>
        </div>

        {/* Value — DM Mono, 28px bold */}
        <p
          className="text-[28px] font-bold leading-none tracking-[-0.025em] text-[#111827]"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {value}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF] line-clamp-2"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            {subtitle}
          </p>
        )}

        {/* Click hint — uniform blue accent */}
        {onClick && (
          <div className="mt-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <span
              className="text-[11px] font-semibold text-[#2563EB]"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              View details
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#2563EB]">
              <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
