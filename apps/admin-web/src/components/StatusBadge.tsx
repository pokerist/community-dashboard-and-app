import { Badge } from "./ui/badge";
import { cn } from "./ui/utils";

interface StatusBadgeProps {
  value: string | null | undefined;
  className?: string;
}

const toneByStatus: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  PAID: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  RESOLVED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  CLOSED: "bg-slate-500/10 text-slate-400 border border-slate-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  IN_PROGRESS: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  NEW: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  OPEN: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border border-red-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border border-red-500/20",
  SUSPENDED: "bg-red-500/10 text-red-400 border border-red-500/20",
  APPEALED: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
};

export function StatusBadge({ value, className }: StatusBadgeProps) {
  const key = String(value || "UNKNOWN").toUpperCase();
  const tone =
    toneByStatus[key] ?? "bg-slate-500/10 text-slate-400 border border-slate-500/20";
  return (
    <Badge className={cn("text-xs font-medium rounded-full", tone, className)}>
      {value || "UNKNOWN"}
    </Badge>
  );
}
