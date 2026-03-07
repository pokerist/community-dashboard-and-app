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
import { Card } from "./ui/card";
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

const toneMap: Record<
  StatIcon,
  { accent: string; accentSoft: string; iconWrap: string; iconColor: string }
> = {
  devices: {
    accent: "bg-[#1D4ED8]",
    accentSoft: "bg-[#DBEAFE]",
    iconWrap: "bg-[#EFF6FF]",
    iconColor: "text-[#1D4ED8]",
  },
  "active-users": {
    accent: "bg-[#047857]",
    accentSoft: "bg-[#D1FAE5]",
    iconWrap: "bg-[#ECFDF5]",
    iconColor: "text-[#047857]",
  },
  "complaints-total": {
    accent: "bg-[#2563EB]",
    accentSoft: "bg-[#DBEAFE]",
    iconWrap: "bg-[#EFF6FF]",
    iconColor: "text-[#1D4ED8]",
  },
  "complaints-open": {
    accent: "bg-[#B45309]",
    accentSoft: "bg-[#FDE68A]",
    iconWrap: "bg-[#FFFBEB]",
    iconColor: "text-[#B45309]",
  },
  "complaints-closed": {
    accent: "bg-[#047857]",
    accentSoft: "bg-[#D1FAE5]",
    iconWrap: "bg-[#ECFDF5]",
    iconColor: "text-[#047857]",
  },
  tickets: {
    accent: "bg-[#4F46E5]",
    accentSoft: "bg-[#E0E7FF]",
    iconWrap: "bg-[#EEF2FF]",
    iconColor: "text-[#4338CA]",
  },
  revenue: {
    accent: "bg-[#0369A1]",
    accentSoft: "bg-[#DBEAFE]",
    iconWrap: "bg-[#F0F9FF]",
    iconColor: "text-[#0369A1]",
  },
  occupancy: {
    accent: "bg-[#7C3AED]",
    accentSoft: "bg-[#EDE9FE]",
    iconWrap: "bg-[#F5F3FF]",
    iconColor: "text-[#6D28D9]",
  },
  visitors: {
    accent: "bg-[#0F766E]",
    accentSoft: "bg-[#CCFBF1]",
    iconWrap: "bg-[#F0FDFA]",
    iconColor: "text-[#0F766E]",
  },
  workers: {
    accent: "bg-[#B45309]",
    accentSoft: "bg-[#FDE68A]",
    iconWrap: "bg-[#FFF7ED]",
    iconColor: "text-[#B45309]",
  },
  cars: {
    accent: "bg-[#334155]",
    accentSoft: "bg-[#E2E8F0]",
    iconWrap: "bg-[#F8FAFC]",
    iconColor: "text-[#334155]",
  },
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
      <Card
        className={cn(
          "bg-[#181c27] rounded-xl border border-white/5 p-6 cursor-pointer hover:border-white/10 transition-colors",
          onClick ? "cursor-pointer" : "cursor-default",
          className,
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <IconComponent className="w-5 h-5 text-blue-400" />
          </div>
        </div>
        <p className="text-3xl font-semibold text-slate-100 font-['DM_Mono']">
          {value}
        </p>
        <p className="text-xs text-slate-500 mt-1">{subtitle ?? " "}</p>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        `relative min-h-[108px] overflow-hidden gap-0 rounded-md border border-[#D6DEE8] bg-white p-4 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.7)] transition hover:-translate-y-[1px] hover:border-[#C7D1DE] hover:shadow-[0_12px_22px_-18px_rgba(15,23,42,0.7)] ${
          onClick ? "cursor-pointer" : ""
        }`,
        className,
      )}
      onClick={onClick}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[#E2E8F0]" />
      <div className={`absolute inset-y-0 left-0 w-1 ${tone.accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">
            {title}
          </p>
          <h3 className="text-[24px] font-semibold leading-tight text-[#0F172A]">{value}</h3>
          {subtitle ? (
            <p className="line-clamp-2 pt-1 text-[11px] leading-relaxed text-[#64748B]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#D6DEE8] ${tone.iconWrap}`}
        >
          <IconComponent className={`h-4 w-4 ${tone.iconColor}`} />
        </div>
      </div>
      <div className={`absolute right-0 top-0 h-14 w-14 -translate-y-6 translate-x-6 rounded-full ${tone.accentSoft} opacity-50`} />
    </Card>
  );
}
