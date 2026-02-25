import { handleApiError } from "./api-client";

export type PagedMeta = {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

export function extractRows<T = any>(payload: any): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  return [];
}

export function extractMeta(payload: any): PagedMeta {
  if (payload?.meta && typeof payload.meta === "object") {
    return payload.meta as PagedMeta;
  }
  return {};
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB");
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

export function formatCurrencyEGP(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "EGP 0";
  const n = Number(value);
  if (Number.isNaN(n)) return `EGP ${value}`;
  return `EGP ${n.toLocaleString()}`;
}

export function humanizeEnum(value?: string | null): string {
  if (!value) return "—";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toInitials(value?: string | null): string {
  if (!value) return "NA";
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function maskNationalId(value?: string | null): string {
  if (!value) return "—";
  const raw = String(value);
  if (raw.length <= 4) return raw;
  return `****${raw.slice(-4)}`;
}

export function getStatusColorClass(status?: string | null): string {
  const normalized = String(status || "").toUpperCase();
  if (
    ["ACTIVE", "AVAILABLE", "PAID", "RESOLVED", "SENT", "ONLINE", "OPEN", "APPROVED", "CONFIRMED"].includes(
      normalized,
    )
  ) {
    return "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20";
  }
  if (
    ["PENDING", "NEW", "SCHEDULED", "IN_PROGRESS", "PROCESSING"].includes(
      normalized,
    )
  ) {
    return "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20";
  }
  if (["OVERDUE", "FAILED", "ERROR", "CANCELLED", "SUSPENDED", "DISABLED", "REJECTED"].includes(normalized)) {
    return "bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20";
  }
  if (["EXPIRED", "OFFLINE", "CLOSED"].includes(normalized)) {
    return "bg-[#64748B]/10 text-[#64748B] hover:bg-[#64748B]/20";
  }
  return "bg-[#3B82F6]/10 text-[#3B82F6] hover:bg-[#3B82F6]/20";
}

export function getPriorityColorClass(priority?: string | null): string {
  const normalized = String(priority || "").toUpperCase();
  if (normalized === "CRITICAL" || normalized === "HIGH") {
    return "bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20";
  }
  if (normalized === "MEDIUM") {
    return "bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20";
  }
  if (normalized === "LOW") {
    return "bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20";
  }
  return "bg-[#F3F4F6] text-[#1E293B]";
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function errorMessage(error: unknown): string {
  return handleApiError(error);
}

