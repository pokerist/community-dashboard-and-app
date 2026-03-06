import { Badge } from "./ui/badge";

interface StatusBadgeProps {
  value: string | null | undefined;
}

const toneByStatus: Record<string, string> = {
  ACTIVE: "bg-[#DCFCE7] text-[#166534]",
  APPROVED: "bg-[#DCFCE7] text-[#166534]",
  INVITED: "bg-[#E0E7FF] text-[#4338CA]",
  PENDING: "bg-[#FEF3C7] text-[#92400E]",
  IN_PROGRESS: "bg-[#DBEAFE] text-[#1D4ED8]",
  SUSPENDED: "bg-[#FEE2E2] text-[#B91C1C]",
  REJECTED: "bg-[#FEE2E2] text-[#B91C1C]",
  CANCELLED: "bg-[#FEE2E2] text-[#B91C1C]",
  EXPIRED: "bg-[#E2E8F0] text-[#334155]",
  TERMINATED: "bg-[#E2E8F0] text-[#334155]",
  DISABLED: "bg-[#E2E8F0] text-[#334155]",
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const key = String(value || "UNKNOWN").toUpperCase();
  const tone = toneByStatus[key] ?? "bg-[#E2E8F0] text-[#334155]";
  return <Badge className={`${tone} border-none`}>{value || "UNKNOWN"}</Badge>;
}

